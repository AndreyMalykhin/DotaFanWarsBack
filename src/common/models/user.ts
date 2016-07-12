import mongoose = require('mongoose');
import Country, {CountryType} from './country';

// to prevent module elision
CountryType;

interface User extends mongoose.Document {
    isLeaver(): boolean;
    nickname: string;
    email: string;
    photoUrl?: string;
    rating: number;
    country?: string | Country;
    facebookId?: string;
    googleId?: string;
    unbanDate?: Date;
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
        googleId: String,
        unbanDate: Date
    },
    {
        collection: 'users',
        strict: 'throw',
        timestamps: true
    }
);
schema.virtual('isLeaver').get(function() {
    const user: User = this;
    return user.unbanDate ? user.unbanDate.getTime() > Date.now() : false;
});

export const UserType = mongoose.model<User>('User', schema);
