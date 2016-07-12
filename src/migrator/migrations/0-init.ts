import fs = require('fs');
import {CountryType} from '../../common/models/country';
import {ItemType} from '../../common/models/item';
import Migration from '../models/migration';

export default class extends Migration {
    up() {
        const countries: any[] = JSON.parse(
            fs.readFileSync(this.getDataFilePath('countries.json'), 'utf8'));
        const items: any[] = JSON.parse(
            fs.readFileSync(this.getDataFilePath('items.json'), 'utf8'));

        countries.forEach((country) => {
            country.flagUrl = country.flagUrl.replace(
                '{staticUrl}', (<any> this.diContainer).staticUrl);
        });

        items.forEach((item) => {
            item.photoUrl = item.photoUrl.replace(
                '{staticUrl}', (<any> this.diContainer).staticUrl);
        });

        return Promise.all([
            (<any> CountryType).insertMany(countries),
            (<any> ItemType).insertMany(items)
        ]);
    }

    down() {
        return <Promise<void>> <any> CountryType.collection.drop();
    }
}
