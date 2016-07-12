import debug = require('debug');
import Room, {RoomType} from './room';

const log = debug('dfw:RoomService');

export default class RoomService {
    getAll(query = {}) {
        return RoomType.find(query);
    }

    saveAll(rooms: Room[]) {
        log('saveAll()');
        const promises = rooms.map((room) => room.save());
        return <Promise<Room[]>> <any> Promise.all(promises);
    }

    removeAll(query: Object) {
        log('removeAll(); query=%o', query);
        return RoomType.remove(query).exec();
    }
}
