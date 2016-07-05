import {CountryType} from './country';

export default class CountryService {
    getAll(query = {}) {
        return CountryType.find(query);
    }
}
