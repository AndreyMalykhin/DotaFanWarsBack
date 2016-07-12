import debug = require('debug');
import User, {UserType} from './user';

const log = debug('dfw:UserService');

export default class UserService {
    get(query = {}) {
        return UserType.findOne(query);
    }

    getAll(query = {}) {
        return UserType.find(query);
    }

    save(user: User) {
        log('save()');
        return <Promise<User>> <any> user.save();
    }

    updateById(id: string, data: Object) {
        log('updateById()');
        return <Promise<User>> <any> UserType.findByIdAndUpdate(
            id, data).exec();
    }
}
