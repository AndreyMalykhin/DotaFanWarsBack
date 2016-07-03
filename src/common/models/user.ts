import mongoose = require('mongoose');
import validator = require('validator');
import Country, {CountryType} from './country';

// to prevent module elision
CountryType;

interface User extends mongoose.Document {
    nickname: string;
    email: string;
    photoUrl?: string;
    rating: number;
    country?: string | Country;
    facebookId?: string;
    googleId?: string;
}

export default User;

const schema = new mongoose.Schema(
    {
        nickname: {
            type: String,
            required: [true, 'validationErrors.required'],
            maxlength: [64, 'validationErrors.length']
        },
        email: {type: String, required: true, index: true},
        photoUrl: String,
        rating: {type: Number, required: true, default: 0},
        country: {type: mongoose.Schema.Types.ObjectId, ref: 'Country'},
        facebookId: String,
        googleId: String
    },
    {
        collection: 'users',
        strict: 'throw',
        timestamps: true
    }
);
export const UserType = mongoose.model<User>('User', schema);
