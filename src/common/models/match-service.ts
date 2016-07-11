import debug = require('debug');
import Match, {MatchType} from './match';

const log = debug('dfw:MatchService');

export default class MatchService {
    getAll(query = {}) {
        log('getAll(); query=%o', query);
        return MatchType.find(query);
    }

    count(query = {}) {
        return MatchType.count(query);
    }

    removeAll(matches: Match[]) {
        log('removeAll(); matches=%o', matches);
        const ids = matches.map((match) => match.id);
        return MatchType.remove({_id: {$in: ids}});
    }

    saveAll(matches: Match[]) {
        log('saveAll(); matches=%o', matches);
        const promises = matches.map((match) => {
            return match.save();
        });
        return <Promise<Match[]>> <any> Promise.all(promises);
    }
}
