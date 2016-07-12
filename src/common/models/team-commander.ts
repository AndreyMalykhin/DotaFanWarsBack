import debug = require('debug');
import _ = require('lodash');
import Team from './team';
import TeamService from './team-service';

const log = debug('dfw:TeamCommander');

export default class TeamCommander {
    constructor(private teamService: TeamService) {}

    saveAll(teams: Team[]) {
        log('saveAll(); ids=%o', _.map(teams, 'id'));
        return this.teamService.saveAll(teams);
    }

    updateById(id: string, data: Object) {
        log('updateById(); id=%o', id);
        return this.teamService.updateById(id, data);
    }
}
