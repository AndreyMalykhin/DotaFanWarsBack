import debug = require('debug');
import {CountryType} from './country';

const log = debug('dfw:CountryService');

export default class CountryService {
    getAll(query = {}) {
        return CountryType.find(query);
    }
}
