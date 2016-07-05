import mongoose = require('mongoose');

interface Country extends mongoose.Document {
    name: string;
    flagUrl: string;
}

export default Country;

const schema = new mongoose.Schema(
    {
        name: {type: String, required: true, index: true},
        flagUrl: {type: String, required: true}
    },
    {
        collection: 'countries',
        strict: 'throw'
    }
);
export const CountryType = mongoose.model<Country>('Country', schema);
