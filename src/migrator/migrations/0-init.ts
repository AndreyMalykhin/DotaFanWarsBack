import fs = require('fs');
import {CountryType} from '../../common/models/country';
import Migration from '../models/migration';

export default class extends Migration {
    up() {
        const data: {flagUrl: string}[] = JSON.parse(
            fs.readFileSync(this.getDataFilePath('countries.json'), 'utf8'));
        data.forEach((country) => {
            country.flagUrl = country.flagUrl.replace(
                '{staticUrl}', (<any> this.diContainer).staticUrl);
        });
        return <Promise<void>> (<any> CountryType).insertMany(data);
    }

    down() {
        return <Promise<void>> <any> CountryType.collection.drop();
    }
}
