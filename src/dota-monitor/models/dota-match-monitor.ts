import debug = require('debug');
import _ = require('lodash');
import DotaService, {GetLiveLeagueGamesResponse} from
    '../../common/models/dota-service';
import MatchService from '../../common/models/match-service';
import TeamService from '../../common/models/team-service';
import MatchCommander from '../../common/models/match-commander';
import Match, {MatchType} from '../../common/models/match';
import Team from '../../common/models/team';
import {filterInterestingGames} from
    '../../common/utils/dota-service-utils';

const log = debug('dfw:DotaMatchMonitor');

export default class DotaMatchMonitor {
    // TODO
    private tickRate = 64000;

    constructor(
        private dotaService: DotaService,
        private matchService: MatchService,
        private teamService: TeamService,
        private matchCommander: MatchCommander
    ) {}

    start() {
        log('start()');
        let isTicking = false;

        setInterval(() => {
            if (isTicking) {
                return;
            }

            isTicking = true;
            const onTickDone = () => {isTicking = false;};
            this.tick().then(onTickDone, onTickDone)
        }, this.tickRate);
    }

    private tick() {
        log('tick()');
        return this.dotaService.getLiveLeagueGames()
            .then((response) => {
                return this.preProcessMatches(response);
            })
            .then(([dotaMatches, matches, teams]) => {
                return this.processMatches(dotaMatches, matches, teams);
            }, (error) => {
                // TODO
                log(error);
            });
    }

    private preProcessMatches(response: GetLiveLeagueGamesResponse) {
        log('preProcessMatches(); response=%o', response);
        const dotaMatches = filterInterestingGames(response.result.games);
        const playingTeamIds: string[] = [];

        for (let {radiant_team, dire_team} of dotaMatches) {
            playingTeamIds.push(radiant_team.team_id, dire_team.team_id);
        }

        return Promise.all([
            dotaMatches,
            this.matchService.getAll().exec(),
            this.teamService.getAll({dotaId: {$in: playingTeamIds}}).exec()
        ]);
    }

    private processMatches(
        dotaMatches: GetLiveLeagueGamesResponse.Game[],
        matches: Match[],
        teams: Team[]
    ) {
        log('processMatches(); dotaMatches=%o; matches=%o; teams=%o',
            dotaMatches, matches, teams);
        const dotaMatchMap = _.keyBy(dotaMatches, 'match_id');
        const matchMap = _.keyBy(matches, 'dotaId');
        const teamMap = _.keyBy(teams, 'dotaId');
        const matchesToUpdate: Match[] = [];
        const matchesToEnd: Match[] = [];
        const matchesToStart: Match[] = [];

        for (let dotaMatchId in matchMap) {
            if (!dotaMatchMap[dotaMatchId]) {
                matchesToEnd.push(matchMap[dotaMatchId]);
            }
        }

        for (let dotaMatchId in dotaMatchMap) {
            const {scoreboard, radiant_team, dire_team} =
                dotaMatchMap[dotaMatchId];
            let match = matchMap[dotaMatchId];
            let radiantScore = 0;
            let direScore = 0;

            if (scoreboard) {
                radiantScore = scoreboard.radiant.score;
                direScore = scoreboard.dire.score;
            }

            if (match) {
                const {radiant, dire} = match;
                radiant.score = radiantScore;
                dire.score = direScore;
                match.markModified('radiant.score');
                match.markModified('dire.score');
                matchesToUpdate.push(match);
            } else {
                const radiantTeam = teamMap[radiant_team.team_id];
                const direTeam = teamMap[dire_team.team_id];

                if (!radiantTeam || !direTeam) {
                    continue;
                }

                match = new MatchType();
                match.startDate = new Date();
                match.dotaId = dotaMatchId;
                match.radiant = {team: radiantTeam, score: radiantScore};
                match.dire = {team: direTeam, score: direScore};
                matchesToStart.push(match);
            }
        }

        const matchCommander = this.matchCommander;
        return Promise.all([
            matchCommander.startAll(matchesToStart),
            matchCommander.updateAll(matchesToUpdate),
            matchCommander.endAll(matchesToEnd)
        ]);
    }
}
