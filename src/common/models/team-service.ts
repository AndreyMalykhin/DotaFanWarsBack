import debug = require('debug');
import Team, {TeamType} from './team';

const log = debug('dfw:TeamService');

export default class TeamService {
    getAll(query: Object = {}) {
        log('getAll(); query=%o', query);
        return TeamType.find(query);
    }

    saveAll(teams: Team[]) {
        log('saveAll(); teams=%o', teams);
        const promises: Promise<Team>[] = [];

        for (let team of teams) {
            promises.push(<any> team.save<Team>());
        }

        return Promise.all(promises);
    }
}
