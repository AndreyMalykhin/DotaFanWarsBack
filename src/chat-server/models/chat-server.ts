import _ = require('lodash');
import uuid = require('node-uuid');
import jwt = require('jsonwebtoken');
import debug = require('debug');
import events = require('events');
import User from '../../common/models/user';
import Room from '../../common/models/room';
import {ROOM_ADD, MATCH_END} from '../../common/utils/event-type';
import {RoomAddEvent, MatchEndEvent} from '../../common/utils/events';
import SocketAuthorizationService from
    '../../common/utils/socket-authorization-service';
import RoomService from '../../common/models/room-service';
import MatchCommander from '../../common/models/match-commander';
import CircularBuffer from '../../common/utils/circular-buffer';
import Translator from '../../common/utils/translator';

const log = debug('dfw:ChatServer');

export default class ChatServer {
    private url: string;
    private socketIONamespace: SocketIO.Namespace;
    private roomSessions: {[roomId: string]: RoomSession} = {};
    private matchRooms: {[matchId: string]: string[]} = {};
    private clientSessions: {[socketId: string]: ClientSession} = {};
    private maxClientsPerTeam = 8;

    constructor(
        host: string,
        port: string,
        private socketIO: SocketIO.Server,
        private eventBus: events.EventEmitter,
        private authorizationService: SocketAuthorizationService,
        private roomService: RoomService,
        private matchCommander: MatchCommander,
        private translator: Translator
    ) {
        this.url = `http://${host}:${port}/chat`;
    }

    start() {
        log('start()');
        return <Promise<any>> <any> this.restoreRooms().then(() => {
            this.eventBus.on(ROOM_ADD, this.onRoomAdd.bind(this));
            this.eventBus.on(MATCH_END, this.onMatchEnd.bind(this));
            this.socketIONamespace = this.socketIO.of('/chat')
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

            this.addClient(roomId, socket.id, user, teamId);
            next();
        }, next);
    }

    private onRoomAdd(event: RoomAddEvent) {
        const {roomIds} = event;
        log('onRoomAdd(); ids=%o', roomIds);
        this.takeRooms(roomIds);
    }

    private onMatchEnd(event: MatchEndEvent) {
        const {matchIds} = event;
        log('onMatchEnd(); ids=%o', matchIds);

        matchIds.forEach((matchId) => {
            _.forEach(this.matchRooms[matchId], (roomId) => {
                _.forEach(this.getRoomClients(roomId), (dummy, socketId) => {
                    const socket = this.socketIONamespace.connected[socketId];
                    socket.disconnect(true);
                });

                delete this.roomSessions[roomId];
            });

            delete this.matchRooms[matchId];
        });
    }

    private onConnect(socket: SocketIO.Socket) {
        log('onConnect');
        this.initClient(socket);
        this.presentClientToOthers(socket);
        this.listenClient(socket);
    }

    private initClient(socket: SocketIO.Socket) {
        const {roomId} = this.clientSessions[socket.id];
        socket.join(roomId);

        const updateUsersMsgData =
            _.map(this.getRoomClients(roomId), (dummy, socketId) => {
                return this.serializeUser(this.clientSessions[socketId].user);
            });

        const updateMessagesMsgData = this.roomSessions[roomId].messages.map(
            (msg: ChatMsg) => this.serializeMsg(msg));

        if (!updateMessagesMsgData.length) {
            updateMessagesMsgData.push(this.serializeMsg({
                id: uuid.v4(),
                body: this.translator.t('chat.greeting'),
                date: new Date()
            }));
        }

        this.send(socket, [
            <Msg> {type: 'start'},
            <UpdateUsersMsg> {type: 'updateUsers', data: updateUsersMsgData},
            <UpdateMessagesMsg> {
                type: 'updateMessages',
                data: updateMessagesMsgData
            }
        ]);
    }

    private presentClientToOthers(socket: SocketIO.Socket) {
        const {roomId, user} = this.clientSessions[socket.id];
        this.send(socket.broadcast.to(roomId), [
            <UpdateUsersMsg> {
                type: 'updateUsers',
                data: [this.serializeUser(user)]
            }
        ]);
    }

    private listenClient(socket: SocketIO.Socket) {
        socket.on('disconnect', this.onDisconnect.bind(this));
        socket.on('sendMsg', this.onSendMsg.bind(this, socket));
    }

    private onDisconnect(socket: SocketIO.Socket) {
        log('onDisconnect()');
        const socketId = socket.id;
        const clientSession = this.clientSessions[socketId];

        if (!clientSession) {
            return;
        }

        const {roomId, user} = clientSession;
        delete this.clientSessions[socketId];

        if (!this.roomSessions[roomId]) {
            return;
        }

        this.send(socket.broadcast.to(roomId), [
            {type: 'removeUsers', data: [user.id]}
        ]);
    }

    private onSendMsg(
        socket: SocketIO.Socket,
        cmd: any,
        responseSender: (messages: Msg[]) => void
    ) {
        log('onSendMsg(); cmd=%o', cmd);
        const clientSession = this.clientSessions[socket.id];

        if (!clientSession) {
            responseSender([]);
            return;
        }

        const {roomId, user} = clientSession;

        const roomSession = this.roomSessions[roomId];

        if (!roomSession) {
            responseSender([]);
            return;
        }

        const msg = {
            id: uuid.v4(),
            body: cmd.msg,
            date: new Date(),
            senderId: <string> user.id
        };
        roomSession.messages.push(msg);
        const messages = [
            <UpdateMessagesMsg> {
                type: 'updateMessages',
                data: [this.serializeMsg(msg)]
            }
        ];
        this.send(socket.broadcast.to(roomId), messages);
        responseSender(messages);
    }

    private addClient(
        roomId: string, socketId: string, user: User, teamId: string) {
        log('addClient(); roomId=%o; socketId=%o; teamId=%o',
            roomId, socketId, teamId);
        this.clientSessions[socketId] = {roomId, user, teamId};
    }

    private isTeamFull(roomId: string, teamId: string) {
        log('isTeamFull()');
        let teamClientCount = 0;

        _.forEach(this.getRoomClients(roomId), (dummy, socketId) => {
            const clientSession = this.clientSessions[socketId];

            if (clientSession && clientSession.teamId == teamId) {
                ++teamClientCount;
            }
        });

        return teamClientCount >= this.maxClientsPerTeam;
    }

    private getRoomClients(roomId: string) {
        const room = this.socketIONamespace.adapter.rooms[roomId];
        return <{[socketId: string]: any}> (room ? room.sockets : {});
    }

    private takeRooms(ids: string[]) {
        log('takeRooms(); ids=%o', ids);
        this.roomService.getAll({_id: {$in: ids}}).exec()
        .then((rooms) => {
            rooms.forEach((room) => {
                room.chatServerUrl = this.url;
            });

            return this.matchCommander.saveRooms(rooms);
        })
        .then((rooms: any) => {
            this.addRooms(rooms);
        });
    }

    private restoreRooms() {
        log('restoreRooms()');
        return this.roomService.getAll({chatServerUrl: this.url}).exec()
        .then((rooms) => {
            this.addRooms(rooms);
        });
    }

    private addRooms(rooms: Room[]) {
        rooms.forEach((room) => {
            this.addRoom(room);
        });
    }

    private addRoom(room: Room) {
        const {id: roomId, match: matchId} = room;
        log('addRoom(); id=%o', roomId);
        this.roomSessions[roomId] = {
            room,
            messages: new CircularBuffer<ChatMsg>(64)
        };

        if (!this.matchRooms[<string> matchId]) {
            this.matchRooms[<string> matchId] = [];
        }

        this.matchRooms[<string> matchId].push(<string> roomId);
    }

    private serializeUser(user: User) {
        const {id, nickname} = user;
        return {id: <string> id, nickname};
    }

    private serializeMsg(msg: ChatMsg) {
        const {id, body, date, senderId} = msg;
        return {id, body, date: date.toISOString(), senderId};
    }

    private send(
        socket: SocketIO.Socket | SocketIO.Namespace, messages: Msg[]) {
        socket.emit('messages', messages);
    }
}

interface RoomSession {
    room: Room;
    messages: CircularBuffer<ChatMsg>;
}

interface ClientSession {
    roomId: string;
    teamId: string;
    user: User;
}

interface ChatMsg {
    id: string;
    body: string;
    date: Date;
    senderId?: string;
}

interface Msg {
    type: MsgType;
    data?: any;
}

type MsgType = 'start' | 'updateUsers' | 'removeUsers' | 'updateMessages';

interface UpdateUsersMsg {
    type: 'updateUsers';
    data: {
        id: string;
        nickname: string;
    }[];
}

interface UpdateMessagesMsg {
    type: 'updateMessages';
    data: {
        id: string;
        body: string;
        date: string;
        senderId?: string;
    }[];
}
