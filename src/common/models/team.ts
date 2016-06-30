import mongoose = require('mongoose');

interface Team extends mongoose.Document {
    dotaId: string;
    name: string;
    logoUrl: string;
    rating: number;
}
export default Team;

const schema = new mongoose.Schema(
    {
        name: {type: String, required: true},
        dotaId: {type: String, required: true, index: true},
        logoUrl: String,
        rating: {type: Number, required: true, default: 0}
    },
    {
        collection: 'teams',
        strict: 'throw',
        timestamps: true
    }
);
export const TeamType = mongoose.model<Team>('Team', schema);
