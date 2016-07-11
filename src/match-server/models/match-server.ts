import _ = require('lodash');
import uuid = require('node-uuid');
import jwt = require('jsonwebtoken');
import debug = require('debug');
import os = require('os');
import events = require('events');
import {ROOM_ADD, MATCH_UPDATE, MATCH_END} from
    '../../common/utils/event-type';
import {RoomAddEvent, MatchUpdateEvent, MatchEndEvent} from
    '../../common/utils/events';
import MatchCommander from '../../common/models/match-commander';
import UserService from '../../common/models/user-service';
import RoomService from '../../common/models/room-service';
import MatchService from '../../common/models/match-service';
import ItemService from '../../common/models/item-service';
import CountryService from '../../common/models/country-service';
import User from '../../common/models/user';
import Room from '../../common/models/room';
import Match from '../../common/models/match';
import Country from '../../common/models/country';
import Item, {ItemBehavior} from '../../common/models/item';
import Team from '../../common/models/team';

const log = debug('dfw:MatchServer');

export default class MatchServer {
    private socketIONamespace: SocketIO.Namespace;
    private url = `http://${os.hostname()}/match`;
    private maxClientsPerRoom = 16;
    private maxClientsPerTeam = this.maxClientsPerRoom / 2;
    private userSessions: {[socketId: string]: UserSession} = {};
    private roomSessions: {[id: string]: RoomSession} = {};
    private matches: {[id: string]: Match} = {};
    private matchRooms: {[matchId: string]: string[]} = {};
    private countries: Country[] = [];
    private items: {[id: string]: Item} = {};
    private projectileDamage = 7;
    private projectileLifetime = 1000;
    private firstAidPower = 7;

    constructor(
        private socketIO: SocketIO.Server,
        private eventBus: events.EventEmitter,
        private matchCommander: MatchCommander,
        private secretKey: string,
        private userService: UserService,
        private roomService: RoomService,
        private matchService: MatchService,
        private itemService: ItemService,
        private countryService: CountryService
    ) {}

    start() {
        return this.restoreRooms()
        .then((rooms) => this.getMatchesByRooms(rooms))
        .then((matches) => {
            this.matches = _.keyBy(matches, 'id');
            return this.itemService.getAll().exec();
        })
        .then((items) => {
            this.items = _.keyBy(items, 'id');
            return this.countryService.getAll().exec();
        })
        .then((countries) => {
            this.countries = countries;
        })
        .then(() => {
            this.eventBus.on(ROOM_ADD, this.onRoomAdd.bind(this));
            this.eventBus.on(MATCH_UPDATE, this.onMatchUpdate.bind(this));
            this.eventBus.on(MATCH_END, this.onMatchEnd.bind(this));
            this.socketIONamespace = this.socketIO.of('/match')
                .use(this.onPreConnect.bind(this))
                .on('connection', this.onConnect.bind(this));
        });
    }

    private onPreConnect(
        socket: SocketIO.Socket, next: (error?: any) => void) {
        const {accessToken, roomId, teamId} = socket.handshake.query;
        this.authorizeUser(accessToken).then((user) => {
            if (!this.roomSessions[roomId]) {
                next(new Error(`Room ${roomId} not exists`));
                return;
            }

            if (user.isLeaver()) {
                next(new Error('leaver'));
                return;
            }

            if (!this.isTeamFull(roomId, teamId)) {
                next(new Error('no_free_slots'));
                return;
            }

            this.addUser(roomId, socket.id, user, teamId);
            next();
        });
    }

    private authorizeUser(accessToken: string) {
        return <Promise<User>> new Promise((resolve, reject) => {
            jwt.verify(
                accessToken,
                this.secretKey,
                (error: Error, jwtPayload: any) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    const userId = jwtPayload.id;
                    this.userService.get({_id: userId}).exec()
                    .then((user) => {
                        user ? resolve(user) :
                            reject(new Error(`User ${userId} not found`));
                    }, reject);
                }
            );
        });
    }

    // TODO
    private addUser(
        roomId: string, socketId: string, user: User, teamId: string) {

    }

    private onRoomAdd(event: RoomAddEvent) {
        const roomPromises =
            event.roomIds.map((roomId) => this.takeRoom(roomId));
        Promise.all(roomPromises).then((rooms) => {
            this.getMatchesByRooms(rooms).then((matches) => {
                matches.forEach((match) => {
                    this.matches[match.id] = match;
                });
            });
        });
    }

    private getMatchesByRooms(rooms: Room[]) {
        const matchIds = rooms.map((room) => <string> room.match);
        return this.getMatches(matchIds);
    }

    private getMatches(ids: string[]) {
        return this.matchService.getAll({_id: {$in: ids}})
            .populate('radiant.team dire.team')
            .exec();
    }

    private onMatchUpdate(event: MatchUpdateEvent) {
        this.getMatches(event.matchIds).then((matches) => {
            matches.forEach((newMatch) => {
                const oldMatch = this.matches[newMatch.id];
                const radiantTeamId = (<Team> oldMatch.radiant.team).id;
                const direTeamId = (<Team> oldMatch.dire.team).id;
                const oldTeamScores = {
                    [radiantTeamId]: oldMatch.radiant.score,
                    [direTeamId]: oldMatch.dire.score
                };
                this.matches[newMatch.id] = newMatch;
                const newTeamScores = {
                    [radiantTeamId]: newMatch.radiant.score,
                    [direTeamId]: newMatch.dire.score
                };
                let isScoreChanged = false;

                _.forEach(oldTeamScores, (oldScore, teamId) => {
                    if (newTeamScores[teamId] != oldScore) {
                        isScoreChanged = true;
                        return false;
                    }
                });

                if (!isScoreChanged) {
                    return;
                }

                const updateTeamsMsg = <UpdateTeamsMsg> {
                    type: 'updateTeams',
                    data: [
                        {
                            id: radiantTeamId,
                            score: newTeamScores[radiantTeamId]
                        },
                        {
                            id: direTeamId,
                            score: newTeamScores[direTeamId]
                        }
                    ]
                };

                _.forEach(this.matchRooms[newMatch.id], (roomIds: string[]) => {
                    roomIds.forEach((roomId) => {
                        _.forEach(
                            this.getRoomSockets(roomId),
                            (dummy, socketId) => {
                                const character =
                                    this.userSessions[socketId].character;
                                const teamScoreDiff = newTeamScores[character.teamId] - oldTeamScores[character.teamId];
                                const messages: Msg[] = [updateTeamsMsg];

                                if (character.seatId && teamScoreDiff > 0) {
                                    character.money += teamScoreDiff;
                                    const updateCharactersMsg = <UpdateCharactersMsg> {
                                        type: 'updateCharacters',
                                        data: [
                                            {
                                                id: character.id,
                                                money: character.money
                                            }
                                        ]
                                    };
                                    messages.push(updateCharactersMsg);
                                }

                                const socket =
                                    this.socketIONamespace.connected[socketId];
                                this.send(socket, messages);
                            }
                        );
                    });
                });
            });
        });
    }

    // TODO
    private onMatchEnd(event: MatchEndEvent) {
        // socket.emit('messages', [
        //     {type: 'end', data: {winnerId: '1', myRatingDelta: 77}}
        // ]);
        // setTimeout(function() {
        //     socket.disconnect(true);
        // }, 10000);
    }

    private onConnect(socket: SocketIO.Socket) {
        this.initClient(socket);
        this.presentClientToOthers(socket);
        this.listenClient(socket);
    }

    private initClient(socket: SocketIO.Socket) {
        const socketId = socket.id;
        const userSession = this.userSessions[socketId];
        const {roomId, character} = userSession;
        socket.join(roomId);
        const {seats, room} = this.roomSessions[roomId];
        const {radiant, dire} = this.matches[<string> room.match];
        const updateCharactersMsg: UpdateCharactersMsg =
            {type: 'updateCharacters', data: []}
        const updateSeatsMsg: UpdateSeatsMsg = {type: 'updateSeats', data: []};
        const updateItemsMsg: Msg = {type: 'updateItems', data: []};

        _.forEach(this.getRoomSockets(roomId), (dummy, roomSocketId) => {
            const includePrivateData = roomSocketId == socketId;
            const serializedCharacter = this.serializeCharacter(
                this.userSessions[roomSocketId], includePrivateData);
            updateCharactersMsg.data.push(serializedCharacter);
        });

        _.forEach(this.items, (item) => {
            updateItemsMsg.data.push(this.serializeItem(item));
        });

        _.forEach(seats, (seat) => {
            updateSeatsMsg.data.push(this.serializeSeat(seat));
        });

        this.send(socket, [
            {type: 'start', data: {myCharacterId: character.id}},
            updateCharactersMsg,
            updateItemsMsg,
            updateSeatsMsg,
            <UpdateTeamsMsg> {
                type: 'updateTeams',
                data: [this.serializeTeam(radiant), this.serializeTeam(dire)]
            },
            {
                type: 'updateCountries',
                data: this.countries.map(
                    (country) => this.serializeCountry(country))
            }
        ]);
    }

    private presentClientToOthers(socket: SocketIO.Socket) {
        const userSession = this.userSessions[socket.id];
        const {roomId, character} = userSession;
        const includePrivateData = false;
        this.send(socket.broadcast.to(roomId), [
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [this.serializeCharacter(userSession, includePrivateData)]
            }
        ]);
    }

    private listenClient(socket: SocketIO.Socket) {
        socket.on('takeSeat', this.onTakeSeat.bind(this, socket));
        socket.on('buyItem', this.onBuyItem.bind(this, socket));
        socket.on('useItem', this.onUseItem.bind(this, socket));
        socket.on('disconnect', this.onDisconnect.bind(this, socket));
    }

    private onTakeSeat(
        socket: SocketIO.Socket, cmd: any, responseSender: ResponseSender) {
        const {roomId, character} = this.userSessions[socket.id];
        const seatId = cmd.seatId;
        const seat = this.roomSessions[roomId].seats[seatId];
        const isAlreadyTaken = seat.characterId != null;

        if (isAlreadyTaken) {
            // TODO
            log(`already taken; seat=%o`, seat);
            return;
        }

        const characterId = character.id;
        seat.characterId = characterId;
        character.seatId = seatId;
        const messages = [
            <UpdateSeatsMsg> {
                type: 'updateSeats',
                data: [{id: seatId, characterId}]
            },
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [{id: characterId, seatId: seatId}]
            }
        ];
        this.send(socket.broadcast.to(roomId), messages);
        responseSender(messages);
    }

    private onBuyItem(
        socket: SocketIO.Socket, cmd: any, responseSender: ResponseSender) {
        const itemId = cmd.itemId;
        const price = this.items[itemId].price;
        const character = this.userSessions[socket.id].character;
        const {id: characterId, money: characterMoney, items: characterItems} =
            character;

        if (characterMoney < price) {
            // TODO
            log('not enough money; money=%o; price=%o', characterMoney, price);
            return;
        }

        character.money -= price;
        const itemCount = ++characterItems[itemId].count;
        responseSender([
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [
                    {
                        id: characterId,
                        money: character.money,
                        items: [{id: itemId, count: itemCount}]
                    }
                ]
            }
        ]);
    }

    private onUseItem(
        socket: SocketIO.Socket, cmd: any, responseSender: ResponseSender) {
        const itemId = cmd.itemId;
        const {character, roomId} = this.userSessions[socket.id];
        const {items: characterItems, id: characterId} = character;

        if (!characterItems[itemId].count) {
            // TODO
            log('no item; id=%o', itemId);
            return;
        }

        switch (this.items[itemId].behavior) {
        case ItemBehavior.OFFENSIVE:
            this.useOffensiveItem(itemId, cmd.targetId, socket, responseSender);
            break;
        case ItemBehavior.DEFENSIVE:
            this.useDefensiveItem(itemId, socket, responseSender);
            break;
        default:
            console.assert(false);
        }
    }

    private useDefensiveItem(
        itemId: string,
        socket: SocketIO.Socket,
        responseSender: ResponseSender
    ) {
        const {character, roomId} = this.userSessions[socket.id];
        character.health = Math.min(character.health + this.firstAidPower, 100);
        const {health: characterHealth, items: characterItems, id: characterId}
            = character;
        const characterItemCount = --characterItems[itemId].count;
        this.send(socket.broadcast.to(roomId), [
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [{id: characterId, health: characterHealth}]
            }
        ]);
        responseSender([
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [
                    {
                        id: characterId,
                        health: characterHealth,
                        items: [
                            {id: itemId, count: characterItemCount}
                        ]
                    }
                ]
            }
        ]);
    }

    private useOffensiveItem(
        itemId: string,
        targetId: string,
        socket: SocketIO.Socket,
        responseSender: ResponseSender
    ) {
        const {character, roomId} = this.userSessions[socket.id];
        const {items: characterItems, id: characterId} = character;
        const characterItemCount = --characterItems[itemId].count;
        const projectileId = uuid.v4();
        const roomSession = this.roomSessions[roomId];
        roomSession.projectiles[projectileId] = {id: projectileId, targetId};
        setTimeout(() => {
            this.hitProjectile(projectileId, character, roomSession);
        }, this.projectileLifetime);
        const updateProjectilesMsg: Msg = {
            type: 'updateProjectiles',
            data: [{id: projectileId, targetId}]
        };
        this.send(socket.broadcast.to(roomId), [updateProjectilesMsg]);
        responseSender([
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [
                    {
                        id: characterId,
                        items: [
                            {id: itemId, count: characterItemCount}
                        ]
                    }
                ]
            },
            updateProjectilesMsg
        ]);
    }

    private hitProjectile(
        projectileId: string, character: Character, roomSession: RoomSession) {
        delete roomSession.projectiles[projectileId];
        character.health =
            Math.max(character.health - this.projectileDamage, 0);
        const {id: characterId, health: characterHealth} = character;
        this.send(this.socketIONamespace.to(<string> roomSession.room.id), [
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [{id: characterId, health: characterHealth}]
            },
            {
                type: 'removeProjectiles',
                data: [projectileId]
            }
        ]);
    }

    // TODO
    private onDisconnect(
        socket: SocketIO.Socket, cmd: any, responseSender: ResponseSender) {

    }

    private takeRoom(id: string) {
        return this.matchCommander.updateRoom(id, {matchServerUrl: this.url})
        .then((room) => {
            this.addRoom(room);
            return room;
        });
    }

    private restoreRooms() {
        return this.roomService.getAll({matchServerUrl: this.url}).exec()
        .then((rooms) => {
            rooms.forEach((room) => {
                this.addRoom(room);
            });
            return rooms;
        });
    }

    private addRoom(room: Room) {
        const seats: {[id: string]: Seat} = {};

        for (let i = 1; i <= this.maxClientsPerRoom; ++i) {
            seats[i] = {id: String(i), characterId: null};
        }

        this.roomSessions[room.id] = {room, seats, projectiles: {}};
        const matchId = <string> room.match;

        if (!this.matchRooms[matchId]) {
            this.matchRooms[matchId] = [];
        }

        this.matchRooms[matchId].push(<string> room.id);
    }

    private isTeamFull(roomId: string, teamId: string) {
        let teamSocketCount = 0;

        _.forEach(this.getRoomSockets(roomId), (dummy, socketId) => {
            if (this.userSessions[socketId].character.teamId == teamId) {
                ++teamSocketCount;
            }
        });

        return teamSocketCount >= this.maxClientsPerTeam;
    }

    private getRoomSockets(roomId: string) {
        return this.socketIO.sockets.adapter.rooms[roomId].sockets;
    }

    private send(
        socket: SocketIO.Socket | SocketIO.Namespace, messages: Msg[]) {
        socket.emit('messages', messages);
    }

    private serializeCountry(country: Country) {
        const {id, name, flagUrl} = country;
        return {id, name, flagUrl};
    }

    private serializeCharacter(
        userSession: UserSession, includePrivateData: boolean) {
        const {character, user} = userSession;
        const {id, teamId, health, money, seatId, items} = character;
        const {id: userId, photoUrl, nickname, country, rating} = user;
        const result = {
            id,
            teamId,
            health,
            seatId,
            user: {
                id: <string> userId,
                country: <string> country,
                photoUrl,
                nickname,
                rating
            }
        };

        if (includePrivateData) {
            const serializedItems = _.map(items, (item) => {
                const {id, count} = item;
                return {id, count};
            });
            Object.assign(result, {money, items: serializedItems});
        }

        return result;
    }

    private serializeItem(item: Item) {
        const {id, type, name, price, photoUrl} = item;
        return {id, type, name, price, photoUrl};
    }

    private serializeSeat(seat: Seat) {
        const {id, characterId} = seat;
        return {id, characterId};
    }

    private serializeTeam(matchSide: Match.Side) {
        const {team, score} = matchSide;
        const {id, name, logoUrl} = <Team> team;
        return {id, name, logoUrl, score};
    }
}

interface RoomSession {
    room: Room;
    seats: {[id: string]: Seat};
    projectiles: {[id: string]: Projectile};
}

interface UserSession {
    roomId: string;
    character: Character;
    user: User;
}

interface Projectile {
    id: string;
    targetId: string;
}

interface Seat {
    id: string;
    characterId?: string;
}

interface Character {
    id: string;
    teamId: string;
    health: number;
    money: number;
    seatId?: string;
    items: {[id: string]: {
        id: string;
        count: number
    }};
}

interface Msg {
    type: MsgType;
    data: any;
}

type MsgType =
    'start'
    | 'end'
    | 'updateTeams'
    | 'updateCharacters'
    | 'removeCharacters'
    | 'updateSeats'
    | 'updateItems'
    | 'updateCountries'
    | 'updateProjectiles'
    | 'removeProjectiles';

interface UpdateTeamsMsg extends Msg {
    type: 'updateTeams';
    data: {
        id: string;
        name?: string;
        score?: number;
        logoUrl?: string;
    }[];
}

interface UpdateCharactersMsg extends Msg {
    type: 'updateCharacters';
    data: {
        id: string;
        teamId?: string;
        health?: number;
        money?: number;
        seatId?: string;
        items?: {
            id: string;
            count: number
        }[];
        user?: {
            id: string;
            photoUrl?: string;
            nickname?: string;
            country?: string;
            rating?: number;
        };
    }[];
}

interface UpdateSeatsMsg {
    type: 'updateSeats';
    data: {
        id: string;
        characterId?: string;
    }[];
}

interface ResponseSender {
    (messages: Msg[]): void;
}
