import debug = require('debug');
import Team, {TeamType} from './team';

const log = debug('dfw:TeamService');

export default class TeamService {
    getAll(query: Object = {}) {
        return TeamType.find(query);
    }

    saveAll(teams: Team[]) {
        log('saveAll()');
        const promises: Promise<Team>[] =
            teams.map((team) => <any> team.save<Team>());
        return Promise.all(promises);
    }

    updateById(id: string, data: Object) {
        log('updateById()');
        return <Promise<Team>> <any> TeamType.findByIdAndUpdate(
            id, data).exec();
    }
}
