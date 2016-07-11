import mongoose = require('mongoose');
import Match, {MatchType} from './match';

// to prevent module elision
MatchType;

interface Room extends mongoose.Document {
    name: string;
    match: string | Match;
    matchServerUrl?: string;
    chatServerUrl?: string;
}

export default Room;

const schema = new mongoose.Schema(
    {
        name: {type: String, required: true},
        match: {
            type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true
        },
        matchServerUrl: {type: String},
        chatServerUrl: {type: String}
    },
    {
        collection: 'rooms',
        strict: 'throw'
    }
);
export const RoomType = mongoose.model<Room>('Room', schema);
