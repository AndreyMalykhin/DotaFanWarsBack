import mongoose = require('mongoose');
import Team from './team';

interface Match extends mongoose.Document {
    dotaId: string;
    startDate: Date;
    radiant: Match.Side;
    dire: Match.Side;
}

namespace Match {
    export interface Side {
        team: string | Team;
        score: number;
    }
}

export default Match;

const sideSchema = new mongoose.Schema({
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    score: {type: Number, required: true}
}, {_id: false});
const schema = new mongoose.Schema(
    {
        dotaId: {type: String, required: true, index: true},
        startDate: {type: Date, required: true},
        radiant: {type: sideSchema, required: true},
        dire: {type: sideSchema, required: true}
    },
    {
        collection: 'matches',
        strict: 'throw',
        timestamps: true
    }
);
export const MatchType = mongoose.model<Match>('Match', schema);
