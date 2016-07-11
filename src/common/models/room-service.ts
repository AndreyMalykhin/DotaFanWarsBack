import debug = require('debug');
import Room, {RoomType} from './room';

const log = debug('dfw:RoomService');

export default class RoomService {
    getAll(query = {}) {
        log('getAll(); query=%o', query);
        return RoomType.find(query);
    }

    saveAll(rooms: Room[]) {
        log('saveAll(); rooms=%o', rooms);
        const promises = rooms.map((room) => {
            return room.save();
        });
        return <Promise<Room[]>> <any> Promise.all(promises);
    }

    update(query: Object, fields: Object) {
        return <Promise<Room>> <any> RoomType.findOneAndUpdate(
            query, fields).exec();
    }
}
