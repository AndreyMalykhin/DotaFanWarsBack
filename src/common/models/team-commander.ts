import debug = require('debug');
import Team from './team';
import TeamService from './team-service';

const log = debug('dfw:TeamCommander');

export default class TeamCommander {
    constructor(private teamService: TeamService) {}

    saveAll(teams: Team[]) {
        log('saveAll(); teams=%o', teams);
        return this.teamService.saveAll(teams);
    }
}
