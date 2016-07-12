import {ItemType} from './item';

export default class ItemService {
    getAll(query = {}) {
        return ItemType.find(query);
    }
}
