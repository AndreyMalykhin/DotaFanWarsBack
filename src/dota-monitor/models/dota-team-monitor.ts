import _ = require('lodash');
import debug = require('debug');
import DotaService, {GetLiveLeagueGamesResponse, GetUGCFileDetailsResponse} from
    '../../common/models/dota-service';
import {filterInterestingGames} from '../../common/utils/dota-service-utils';
import TeamService from '../../common/models/team-service';
import TeamCommander from '../../common/models/team-commander';
import Team, {TeamType} from '../../common/models/team';

const log = debug('dfw:DotaTeamMonitor');

export default class DotaTeamMonitor {
    private tickRate = 64000;

    constructor(
        private dotaService: DotaService,
        private teamService: TeamService,
        private teamCommander: TeamCommander
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
                return this.preProcessTeams(response.result.games);
            })
            .then(([dotaTeams, currentTeams, teamLogos]) => {
                return this.processTeams(
                    dotaTeams, currentTeams, teamLogos);
            }, (error) => {
                // TODO
                log(error);
            });
    }

    private preProcessTeams(games: GetLiveLeagueGamesResponse.Game[]) {
        log('preProcessTeams()');
        games = filterInterestingGames(games);
        const dotaTeams: GetLiveLeagueGamesResponse.Team[] = [];
        const dotaTeamIds: string[] = [];
        const teamLogoIds: string[] = [];

        games.forEach(({radiant_team, dire_team}) => {
            dotaTeams.push(radiant_team, dire_team);
            dotaTeamIds.push(radiant_team.team_id, dire_team.team_id);
            const team1LogoId = radiant_team.team_logo;
            const team2LogoId = dire_team.team_logo;

            if (team1LogoId) {
                teamLogoIds.push(team1LogoId);
            }

            if (team2LogoId) {
                teamLogoIds.push(team2LogoId);
            }
        });

        return Promise.all([
            dotaTeams,
            this.teamService.getAll({dotaId: {$in: dotaTeamIds}}).exec(),
            this.getTeamLogos(teamLogoIds)
        ]);
    }

    private processTeams(
        dotaTeams: GetLiveLeagueGamesResponse.Team[],
        currentTeams: Team[],
        teamLogos: TeamLogo[]
    ) {
        log('processTeams()');
        const teamLogoMap = _.keyBy(teamLogos, (logo) => logo && logo.id);
        const currentTeamMap = _.keyBy(currentTeams, 'dotaId');
        const nextTeams: Team[] = [];

        dotaTeams.forEach((dotaTeam) => {
            const dotaTeamId = dotaTeam.team_id;
            let team = currentTeamMap[dotaTeamId];

            if (!team) {
                team = new TeamType({dotaId: dotaTeamId});
            }

            team.name = dotaTeam.team_name;
            const logoId = dotaTeam.team_logo;
            team.logoUrl = logoId ? teamLogoMap[logoId].url : null;
            nextTeams.push(team);
        });

        return this.teamCommander.saveAll(nextTeams);
    }

    private getTeamLogos(logoIds: string[]) {
        log('getTeamLogos(); logoIds=%o', logoIds);
        const promises = logoIds.map((logoId) => {
            return this.dotaService.getUGCFileDetails(logoId)
                .then((response) => {
                    const {status, data} = response;

                    if (status && status.code == 9) {
                        return null;
                    }

                    return {id: logoId, url: data.url};
                });
        });

        return <Promise<TeamLogo[]>> <any> Promise.all(promises);
    }
}

interface TeamLogo {
    id: string;
    url: string;
}
