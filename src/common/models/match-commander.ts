import debug = require('debug');
import events = require('events');
import {MATCH_START, MATCH_UPDATE, MATCH_END} from '../utils/event-type';
import {MatchStartEvent, MatchUpdateEvent, MatchEndEvent} from
    '../utils/events';
import Match from './match';
import MatchService from './match-service';

const log = debug('dfw:MatchCommander');

export default class MatchCommander {
    constructor(private matchService: MatchService,
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
        return this.matchService.saveAll(matches).then((matches) => {
            this.eventBus.emit(
                MATCH_START,
                <MatchStartEvent> {matchIds: this.getMatchIds(matches)}
            );
        });
    }

    private getMatchIds(matches: Match[]) {
        return matches.map((match) => <string> match.id);
    }
}
