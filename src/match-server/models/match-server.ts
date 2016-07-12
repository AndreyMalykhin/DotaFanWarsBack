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
import TeamCommander from '../../common/models/team-commander';
import UserCommander from '../../common/models/user-commander';
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
import Translator from '../../common/utils/translator';

const log = debug('dfw:MatchServer');

export default class MatchServer {
    private url: string;
    private socketIONamespace: SocketIO.Namespace;
    private maxClientsPerRoom = 16;
    private maxClientsPerTeam = this.maxClientsPerRoom / 2;
    private clientSessions: {[socketId: string]: ClientSession} = {};
    private roomSessions: {[id: string]: RoomSession} = {};
    private matches: {[id: string]: Match} = {};
    private matchRooms: {[matchId: string]: string[]} = {};
    private countries: Country[] = [];
    private items: {[id: string]: Item} = {};
    private projectileLifetime = 1000;
    private defensiveItemPower = 7;
    private offensiveItemPower = this.defensiveItemPower;
    private victoryRatingDelta = 7;
    private defeatRatingDelta = this.victoryRatingDelta;

    constructor(
        host: string,
        port: string,
        private socketIO: SocketIO.Server,
        private eventBus: events.EventEmitter,
        private matchCommander: MatchCommander,
        private secretKey: string,
        private userService: UserService,
        private roomService: RoomService,
        private matchService: MatchService,
        private itemService: ItemService,
        private countryService: CountryService,
        private userCommander: UserCommander,
        private teamCommander: TeamCommander,
        private translator: Translator
    ) {
        this.url = `http://${host}:${port}/match`;
    }

    start() {
        log('start()');
        return <Promise<void>> <any> this.restoreRooms()
        .then(() => {
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
        log('onPreConnect(); roomId=%o; teamId=%o', roomId, teamId);
        this.authorizeClient(accessToken).then((user) => {
            if (!this.roomSessions[roomId]) {
                next(new Error('room_not_found'));
                return;
            }

            if (user.isLeaver) {
                next(new Error('leaver'));
                return;
            }

            if (this.isTeamFull(roomId, teamId)) {
                next(new Error('no_free_slots'));
                return;
            }

            this.addClient(roomId, socket.id, user, teamId);
            next();
        }, next);
    }

    private authorizeClient(accessToken: string) {
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

    private addClient(
        roomId: string, socketId: string, user: User, teamId: string) {
        log('addClient(); roomId=%o; socketId=%o; teamId=%o',
            roomId, socketId, teamId);
        const items = _.mapValues(this.items, (item) => {
            return {id: <string> item.id, count: 0};
        });
        this.clientSessions[socketId] = {
            roomId,
            user,
            character: {
                id: uuid.v4(),
                teamId,
                seatId: null,
                health: 100,
                money: 0,
                items
            }
        };
    }

    private onRoomAdd(event: RoomAddEvent) {
        const {roomIds} = event;
        log('onRoomAdd(); ids=%o', roomIds);
        this.takeRooms(roomIds);
    }

    // TODO
    private onMatchUpdate(event: MatchUpdateEvent) {
        const {matchIds} = event;
        log('onMatchUpdate(); ids=%o', matchIds);
        this.matchService.getAll({_id: {$in: matchIds}})
        .populate('radiant.team dire.team')
        .exec()
        .then((matches) => {
            matches.forEach((newMatch) => {
                const oldMatch = this.matches[newMatch.id];
                const radiantTeamId =
                    <string> (<Team> oldMatch.radiant.team).id;
                const direTeamId = <string> (<Team> oldMatch.dire.team).id;
                const oldTeamScores: {[teamId: string]: number} = {
                    [radiantTeamId]: oldMatch.radiant.score,
                    [direTeamId]: oldMatch.dire.score
                };
                this.matches[newMatch.id] = newMatch;
                const newTeamScores: {[teamId: string]: number} = {
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
                                    this.clientSessions[socketId].character;
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

    private onMatchEnd(event: MatchEndEvent) {
        const {matchIds} = event;
        log('onMatchEnd(); ids=%o', matchIds);
        const infoForClients: {
            socketId: string;
            winnerId?: string;
            userRatingDelta: number
        }[] = [];
        const saveTeamPromises: Promise<any>[] = [];
        const saveUserPromises: Promise<any>[] = [];

        matchIds.forEach((matchId) => {
            _.forEach(this.matchRooms[matchId], (roomIds: string[]) => {
                roomIds.forEach((roomId) => {
                    let winnerId: string = null;
                    const match = this.matches[matchId];
                    const radiantTeamId =
                        <string> (<Team> match.radiant.team).id;
                    const direTeamId = <string> (<Team> match.dire.team).id;
                    const teams = this.roomSessions[roomId].teams;
                    const radiantScore = teams[radiantTeamId].score;
                    const direScore = teams[direTeamId].score;

                    if (radiantScore > direScore) {
                        winnerId = radiantTeamId;
                    } else if (direScore > radiantScore) {
                        winnerId = direTeamId;
                    }

                    [radiantTeamId, direTeamId].forEach((teamId) => {
                        const teamRatingDelta = teamId == winnerId ?
                            this.victoryRatingDelta : this.defeatRatingDelta;
                        const promise = this.teamCommander.updateById(
                            teamId, {$inc: {rating: teamRatingDelta}});
                        saveTeamPromises.push(promise);
                    });

                    _.forEach(
                        this.getRoomSockets(roomId),
                        (dummy, socketId) => {
                            const {character, user} =
                                this.clientSessions[socketId];
                            const userRatingDelta =
                                character.teamId == winnerId ?
                                this.victoryRatingDelta :
                                this.defeatRatingDelta;
                            const promise = this.userCommander.updateById(
                                <string> user.id,
                                {$inc: {rating: userRatingDelta}}
                            );
                            saveUserPromises.push(promise);
                            infoForClients.push(
                                {socketId, winnerId, userRatingDelta});
                            delete this.clientSessions[socketId];
                        }
                    );

                    delete this.roomSessions[roomId];
                });
            });

            delete this.matches[matchId];
            delete this.matchRooms[matchId];
        });

        Promise.all([...saveTeamPromises, ...saveUserPromises]).then(() => {
            infoForClients.forEach((infoForClient) => {
                const {socketId, winnerId, userRatingDelta} = infoForClient;
                const socket = this.socketIONamespace.connected[socketId];
                this.send(socket, [
                    {
                        type: 'end',
                        data: {winnerId, myRatingDelta: userRatingDelta}
                    }
                ]);
                socket.disconnect(true);
            });
        });
    }

    private onConnect(socket: SocketIO.Socket) {
        log('onConnect');
        this.initClient(socket);
        this.presentClientToOthers(socket);
        this.listenClient(socket);
    }

    private initClient(socket: SocketIO.Socket) {
        const socketId = socket.id;
        const {roomId, character} = this.clientSessions[socketId];
        socket.join(roomId);
        const {seats, room} = this.roomSessions[roomId];
        const {radiant, dire} = this.matches[(<Match> room.match).id];
        const updateCharactersMsg: UpdateCharactersMsg =
            {type: 'updateCharacters', data: []}
        const updateSeatsMsg: UpdateSeatsMsg = {type: 'updateSeats', data: []};
        const updateItemsMsg: Msg = {type: 'updateItems', data: []};

        _.forEach(this.getRoomSockets(roomId), (dummy, roomSocketId) => {
            const includePrivateData = roomSocketId == socketId;
            const serializedCharacter = this.serializeCharacter(
                this.clientSessions[roomSocketId], includePrivateData);
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
        const clientSession = this.clientSessions[socket.id];
        const {roomId, character} = clientSession;
        const includePrivateData = false;
        this.send(socket.broadcast.to(roomId), [
            <UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [this.serializeCharacter(clientSession, includePrivateData)]
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
        log('onTakeSeat(); cmd=%o', cmd);
        const {roomId, character} = this.clientSessions[socket.id];
        const seatId = cmd.seatId;
        const seat = this.roomSessions[roomId].seats[seatId];
        const isAlreadyTaken = seat.characterId != null;

        if (isAlreadyTaken) {
            // TODO
            log(`already taken; seat=%o`, seat);
            responseSender([]);
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
        log('onBuyItem(); cmd=%o', cmd);
        const itemId = cmd.itemId;
        const price = this.items[itemId].price;
        const character = this.clientSessions[socket.id].character;
        const {id: characterId, money: characterMoney, items: characterItems} =
            character;

        if (characterMoney < price) {
            // TODO
            log('not enough money; money=%o; price=%o', characterMoney, price);
            responseSender([]);
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
        log('onUseItem(); cmd=%o', cmd);
        const itemId = cmd.itemId;
        const {character, roomId} = this.clientSessions[socket.id];
        const {items: characterItems, id: characterId} = character;

        if (!characterItems[itemId].count) {
            // TODO
            log('no item; id=%o', itemId);
            responseSender([]);
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
        const {character, roomId} = this.clientSessions[socket.id];
        character.health =
            Math.min(character.health + this.defensiveItemPower, 100);
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
        const {character, roomId} = this.clientSessions[socket.id];
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
        log('hitProjectile()');
        delete roomSession.projectiles[projectileId];
        const messages: Msg[] =
            [{type: 'removeProjectiles', data: [projectileId]}];
        const {id: characterId, health: characterOldHealth, teamId: characterTeamId} = character;

        if (characterOldHealth > 0) {
            character.health =
                Math.max(characterOldHealth - this.offensiveItemPower, 0);
            const characterNewHealth = character.health;

            if (characterNewHealth <= 0) {
                ++roomSession.teams[characterTeamId].score;
            }

            messages.push(<UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [{id: characterId, health: characterNewHealth}]
            });
        }

        this.send(this.socketIONamespace.to(<string> roomSession.room.id),
            messages);
    }

    private onDisconnect(socket: SocketIO.Socket) {
        log('onDisconnect()');
        const {character, roomId, user} = this.clientSessions[socket.id];
        delete this.clientSessions[socket.id];
        const characterSeatId = character.seatId;
        const messages: Msg[] =
            [{type: 'removeCharacters', data: [character.id]}];

        if (characterSeatId) {
            if (this.roomSessions[roomId]) {
                this.userCommander.punishForLeave(<string> user.id);
            }

            this.roomSessions[roomId].seats[characterSeatId].characterId = null;
            messages.push(<UpdateSeatsMsg> {
                type: 'updateSeats',
                data: [{id: characterSeatId, characterId: null}]
            });
        }

        this.send(socket.broadcast.to(roomId), messages);
    }

    private takeRooms(ids: string[]) {
        log('takeRooms(); ids=%o', ids);
        this.getRooms({_id: {$in: ids}})
        .then((rooms) => {
            rooms.forEach((room) => {
                room.matchServerUrl = this.url;
            });
            return this.matchCommander.saveRooms(rooms);
        })
        .then((rooms) => {
            this.addRooms(rooms);
        });
    }

    private restoreRooms() {
        log('restoreRooms()');
        return this.getRooms({matchServerUrl: this.url}).then((rooms) => {
            this.addRooms(rooms);
            return rooms;
        });
    }

    private addRooms(rooms: Room[]) {
        rooms.forEach((room) => {
            this.addRoom(room);
        });
    }

    private addRoom(room: Room) {
        const {id: roomId, match} = room;
        log('addRoom(); id=%o', roomId);
        const seats: {[id: string]: Seat} = {};

        for (let i = 1; i <= this.maxClientsPerRoom; ++i) {
            seats[i] = {id: String(i), characterId: null};
        }

        const {radiant, dire, id: matchId} = <Match> match;
        this.roomSessions[room.id] = {
            room,
            seats,
            projectiles: {},
            teams: {
                [(<Team> radiant.team).id]: {score: 0},
                [(<Team> dire.team).id]: {score: 0}
            }
        };

        if (!this.matchRooms[matchId]) {
            this.matchRooms[matchId] = [];
        }

        this.matches[matchId] = <Match> match;
        this.matchRooms[matchId].push(<string> roomId);
    }

    private getRooms(query: Object) {
        return this.roomService.getAll(query)
        .populate(<any> {
            path: 'match',
            populate: {path: 'radiant.team dire.team'}
        })
        .exec();
    }

    private isTeamFull(roomId: string, teamId: string) {
        log('isTeamFull()');
        let teamClientCount = 0;

        _.forEach(this.getRoomSockets(roomId), (dummy, socketId) => {
            const clientSession = this.clientSessions[socketId];

            if (clientSession && clientSession.character.teamId == teamId) {
                ++teamClientCount;
            }
        });

        return teamClientCount >= this.maxClientsPerTeam;
    }

    private getRoomSockets(roomId: string) {
        const room = this.socketIONamespace.adapter.rooms[roomId];
        return room ? room.sockets : {};
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
        clientSession: ClientSession, includePrivateData: boolean) {
        const {character, user} = clientSession;
        const {id, teamId, health, money, seatId, items} = character;
        const {id: userId, photoUrl, nickname, country, rating} = user;
        const result = {
            id,
            teamId,
            health,
            seatId,
            user: {
                id: <string> userId,
                countryId: <string> country,
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
        const {id, behavior, name, price, photoUrl} = item;
        return {id, behavior, name: this.translator.t(name), price, photoUrl};
    }

    private serializeSeat(seat: Seat) {
        const {id, characterId} = seat;
        return {id, characterId};
    }

    private serializeTeam(matchSide: Match.Side) {
        const {team, score} = matchSide;
        const {id, name, logoUrl} = <Team> team;
        return {id: <string> id, name, logoUrl, score};
    }
}

interface RoomSession {
    room: Room;
    seats: {[id: string]: Seat};
    projectiles: {[id: string]: Projectile};
    teams: {[id: string]: {
        score: number;
    }};
}

interface ClientSession {
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
        characterId: string;
    }[];
}

interface ResponseSender {
    (messages: Msg[]): void;
}
