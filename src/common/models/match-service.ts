import debug = require('debug');
import Match, {MatchType} from './match';

const log = debug('dfw:MatchService');

export default class MatchService {
    getAll(query = {}) {
        return MatchType.find(query);
    }

    count(query = {}) {
        return MatchType.count(query);
    }

    removeAll(matches: Match[]) {
        log('removeAll()');
        const ids = matches.map((match) => match.id);
        return MatchType.remove({_id: {$in: ids}}).exec();
    }

    saveAll(matches: Match[]) {
        log('saveAll()');
        const promises = matches.map((match) => match.save());
        return <Promise<Match[]>> <any> Promise.all(promises);
    }
}
