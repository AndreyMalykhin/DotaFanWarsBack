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
import SocketAuthorizationService from
    '../../common/utils/socket-authorization-service';

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
    // TODO
    private defensiveItemPower = 16;
    private offensiveItemPower = this.defensiveItemPower;
    private victoryRatingDelta = 16;
    private defeatRatingDelta = this.victoryRatingDelta;
    private characterMaxHealth = 100;

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
        private translator: Translator,
        private authorizationService: SocketAuthorizationService
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
        this.authorizationService.authorize(accessToken).then((user) => {
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

            const isUserAlreadyConnected = _.find(
                this.clientSessions, (session) => session.user.id == user.id);

            if (isUserAlreadyConnected) {
                next(new Error('duplicate_user'));
                return;
            }

            this.addClient(roomId, socket.id, user, teamId);
            next();
        }, next);
    }

    private addClient(
        roomId: string, socketId: string, user: User, teamId: string) {
        log('addClient(); roomId=%o; socketId=%o; teamId=%o',
            roomId, socketId, teamId);
        const items = _.mapValues(this.items, (item) => {
            return {id: <string> item.id, count: 0};
        });
        const characterId = uuid.v4();
        this.clientSessions[socketId] = {
            roomId,
            user,
            character: {
                id: characterId,
                teamId,
                seatId: null,
                health: this.characterMaxHealth,
                money: 0,
                items
            }
        };
        this.roomSessions[roomId].characterClients[characterId] = socketId;
    }

    private onRoomAdd(event: RoomAddEvent) {
        const {roomIds} = event;
        log('onRoomAdd(); ids=%o', roomIds);
        this.takeRooms(roomIds);
    }

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

                _.forEach(this.matchRooms[newMatch.id], (roomId) => {
                    _.forEach(
                        this.getRoomClients(roomId),
                        (dummy, socketId) => {
                            const character =
                                this.clientSessions[socketId].character;
                            const {seatId: characterSeatId, id: characterId, teamId: characterTeamId, health: characterHealth} = character;
                            const teamScoreDiff =
                                newTeamScores[characterTeamId] -
                                oldTeamScores[characterTeamId];
                            const messages: Msg[] = [updateTeamsMsg];

                            if (characterSeatId
                                && characterHealth > 0
                                && teamScoreDiff > 0
                            ) {
                                character.money += teamScoreDiff;
                                const updateCharactersMsg =
                                    <UpdateCharactersMsg> {
                                        type: 'updateCharacters',
                                        data: [
                                            {
                                                id: characterId,
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
            _.forEach(this.matchRooms[matchId], (roomId) => {
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

                if (winnerId) {
                    [radiantTeamId, direTeamId].forEach((teamId) => {
                        const teamRatingDelta = teamId == winnerId ?
                            this.victoryRatingDelta : -this.defeatRatingDelta;
                        const promise = this.teamCommander.updateById(
                            teamId, {$inc: {rating: teamRatingDelta}});
                        saveTeamPromises.push(promise);
                    });
                }

                _.forEach(
                    this.getRoomClients(roomId),
                    (dummy, socketId) => {
                        const {character, user} = this.clientSessions[socketId];
                        let userRatingDelta: number = 0;

                        if (winnerId) {
                            userRatingDelta =
                                character.teamId == winnerId ?
                                this.victoryRatingDelta :
                                -this.defeatRatingDelta;
                            const promise = this.userCommander.updateById(
                                <string> user.id,
                                {$inc: {rating: userRatingDelta}}
                            );
                            saveUserPromises.push(promise);
                        }

                        infoForClients.push(
                            {socketId, winnerId, userRatingDelta});
                    }
                );

                delete this.roomSessions[roomId];
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
                setTimeout(() => {
                    socket.disconnect(true);
                }, 8000);
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

        _.forEach(this.getRoomClients(roomId), (dummy, roomSocketId) => {
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
                data: [
                    this.serializeCharacter(clientSession, includePrivateData)
                ]
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
        const clientSession = this.clientSessions[socket.id];

        if (!clientSession) {
            responseSender([]);
            return;
        }

        const {roomId, character} = clientSession;
        const seatId = cmd.seatId;
        const roomSession = this.roomSessions[roomId];

        if (!roomSession) {
            responseSender([]);
            return;
        }

        const seat = roomSession.seats[seatId];
        const isAlreadyTaken = seat.characterId != null;

        if (isAlreadyTaken) {
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
        const clientSession = this.clientSessions[socket.id];

        if (!clientSession) {
            responseSender([]);
            return;
        }

        const {character} = clientSession;
        const {id: characterId, money: characterMoney, items: characterItems, health: characterHealth} = character;

        if (characterHealth <= 0) {
            responseSender([]);
            return;
        }

        const {itemId} = cmd;
        const price = this.items[itemId].price;

        if (characterMoney < price) {
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
        const clientSession = this.clientSessions[socket.id];

        if (!clientSession) {
            responseSender([]);
            return;
        }

        const {character, roomId} = clientSession;
        const {items: characterItems, id: characterId, health: characterHealth} = character;

        if (characterHealth <= 0) {
            responseSender([]);
            return;
        }

        const {itemId} = cmd;

        if (!characterItems[itemId].count) {
            responseSender([]);
            return;
        }

        switch (this.items[itemId].behavior) {
        case ItemBehavior.OFFENSIVE:
            this.useOffensiveItem(
                itemId, clientSession, cmd.targetId, socket, responseSender);
            break;
        case ItemBehavior.DEFENSIVE:
            this.useDefensiveItem(
                itemId, clientSession, socket, responseSender);
            break;
        default:
            console.assert(false);
        }
    }

    private useDefensiveItem(
        itemId: string,
        clientSession: ClientSession,
        socket: SocketIO.Socket,
        responseSender: ResponseSender
    ) {
        const {character, roomId} = clientSession;

        if (character.health >= this.characterMaxHealth) {
            return responseSender([]);
        }

        character.health = Math.min(
            character.health + this.defensiveItemPower,
            this.characterMaxHealth
        );
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
        clientSession: ClientSession,
        targetId: string,
        socket: SocketIO.Socket,
        responseSender: ResponseSender
    ) {
        const {character, roomId} = clientSession;
        const roomSession = this.roomSessions[roomId];

        if (!roomSession) {
            responseSender([]);
            return;
        }

        const targetSocketId = roomSession.characterClients[targetId];
        const targetClientSession = this.clientSessions[targetSocketId];

        if (!targetClientSession) {
            responseSender([]);
            return;
        }

        const target = targetClientSession.character;

        if (target.health <= 0) {
            responseSender([]);
            return;
        }

        const {items: characterItems, id: characterId} = character;
        const characterItemCount = --characterItems[itemId].count;
        const projectileId = uuid.v4();
        roomSession.projectiles[projectileId] = {id: projectileId, targetId};
        setTimeout(() => {
            this.hitProjectile(projectileId, target, roomSession);
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
        projectileId: string, target: Character, roomSession: RoomSession) {
        log('hitProjectile()');
        delete roomSession.projectiles[projectileId];
        const messages: Msg[] =
            [{type: 'removeProjectiles', data: [projectileId]}];
        const {health: targetOldHealth, teamId: targetTeamId} = target;

        if (targetOldHealth > 0) {
            target.health =
                Math.max(targetOldHealth - this.offensiveItemPower, 0);
            const targetNewHealth = target.health;

            if (targetNewHealth <= 0) {
                ++roomSession.teams[targetTeamId].score;
            }

            messages.push(<UpdateCharactersMsg> {
                type: 'updateCharacters',
                data: [{id: target.id, health: targetNewHealth}]
            });
        }

        this.send(this.socketIONamespace.to(<string> roomSession.room.id),
            messages);
    }

    private onDisconnect(socket: SocketIO.Socket) {
        log('onDisconnect()');
        const {character, roomId, user} = this.clientSessions[socket.id];
        delete this.clientSessions[socket.id];
        const roomSession = this.roomSessions[roomId];

        if (!roomSession) {
            return;
        }

        const {id: characterId, seatId: characterSeatId} = character;
        delete roomSession.characterClients[characterId];
        const messages: Msg[] =
            [{type: 'removeCharacters', data: [characterId]}];

        if (characterSeatId) {
            this.userCommander.punishForLeave(<string> user.id);
            roomSession.seats[characterSeatId].characterId = null;
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
        .then((rooms: any) => {
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
            },
            characterClients: {}
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

        _.forEach(this.getRoomClients(roomId), (dummy, socketId) => {
            const clientSession = this.clientSessions[socketId];

            if (clientSession && clientSession.character.teamId == teamId) {
                ++teamClientCount;
            }
        });

        return teamClientCount >= this.maxClientsPerTeam;
    }

    private getRoomClients(roomId: string) {
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
    characterClients: {[characterId: string]: string};
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
