import _ = require('lodash');
import debug = require('debug');
import events = require('events');
import {ROOM_ADD, MATCH_UPDATE, MATCH_END} from '../utils/event-type';
import {RoomAddEvent, MatchUpdateEvent, MatchEndEvent} from
    '../utils/events';
import Match from './match';
import MatchService from './match-service';
import Room, {RoomType} from './room';
import RoomService from './room-service';

const log = debug('dfw:MatchCommander');

export default class MatchCommander {
    constructor(
        private matchService: MatchService,
        private roomService: RoomService,
        private eventBus: events.EventEmitter) {}

    endAll(matches: Match[]) {
        const ids = this.getMatchIds(matches);
        log('endAll(); ids=%o', ids);

        if (!matches.length) {
            return Promise.resolve();
        }

        return <Promise<void>> <any> Promise.all([
            this.matchService.removeAll(matches),
            this.roomService.removeAll({match: {$in: ids}})
        ]).then(() => {
            this.eventBus.emit(MATCH_END, <MatchEndEvent> {matchIds: ids});
        });
    }

    updateAll(matches: Match[]) {
        const ids = this.getMatchIds(matches);
        log('updateAll(); ids=%o', ids);

        if (!matches.length) {
            return Promise.resolve();
        }

        return this.matchService.saveAll(matches).then((matches) => {
            this.eventBus.emit(
                MATCH_UPDATE, <MatchUpdateEvent> {matchIds: ids});
        });
    }

    startAll(matches: Match[]) {
        log('startAll(); ids=%o', this.getMatchIds(matches));

        if (!matches.length) {
            return Promise.resolve();
        }

        return this.matchService.saveAll(matches)
            .then((matches) => {
                const rooms = matches.map((match) => {
                    return new RoomType({name: 'Room 1', match});
                });
                return this.roomService.saveAll(rooms);
            })
            .then((rooms) => {
                const roomIds = rooms.map((room) => <string> room.id);
                this.eventBus.emit(
                    ROOM_ADD, <RoomAddEvent> {roomIds: roomIds});
            });
    }

    saveRooms(rooms: Room[]) {
        log('saveRooms(); ids=%o', _.map(rooms, 'id'));
        return this.roomService.saveAll(rooms);
    }

    private getMatchIds(matches: Match[]) {
        return matches.map((match) => <string> match.id);
    }
}
