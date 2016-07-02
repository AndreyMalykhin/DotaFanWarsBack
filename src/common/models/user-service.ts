import debug = require('debug');
import User, {UserType} from './user';

const log = debug('dfw:UserService');

export default class UserService {
    get(query = {}) {
        log('get(); query=%o', query);
        return UserType.findOne(query);
    }

    getAll(query = {}) {
        log('getAll(); query=%o', query);
        return UserType.find(query);
    }

    save(user: User) {
        log('save(); user=%o', user);
        return <Promise<User>> <any> user.save();
    }
}
