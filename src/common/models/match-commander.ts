import debug = require('debug');
import events = require('events');
import {ROOM_ADD, MATCH_UPDATE, MATCH_END} from '../utils/event-type';
import {RoomAddEvent, MatchUpdateEvent, MatchEndEvent} from
    '../utils/events';
import Match from './match';
import MatchService from './match-service';
import {RoomType} from './room';
import RoomService from './room-service';

const log = debug('dfw:MatchCommander');

export default class MatchCommander {
    constructor(
        private matchService: MatchService,
        private roomService: RoomService,
        private eventBus: events.EventEmitter) {}

    endAll(matches: Match[]) {
        log('endAll(); matches=%o', matches);
        return this.matchService.removeAll(matches).exec().then(() => {
            this.eventBus.emit(
                MATCH_END,
                <MatchEndEvent> {matchIds: this.getMatchIds(matches)}
            );
        });
    }

    updateAll(matches: Match[]) {
        log('updateAll(); matches=%o', matches);
        return this.matchService.saveAll(matches).then((matches) => {
            this.eventBus.emit(
                MATCH_UPDATE,
                <MatchUpdateEvent> {matchIds: this.getMatchIds(matches)}
            );
        });
    }

    startAll(matches: Match[]) {
        log('startAll(); matches=%o', matches);
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
                    ROOM_ADD,
                    <RoomAddEvent> {roomIds: roomIds}
                );
            });
    }

    updateRoom(id: string, fields: Object) {
        return this.roomService.update({_id: id}, fields);
    }

    private getMatchIds(matches: Match[]) {
        return matches.map((match) => <string> match.id);
    }
}
