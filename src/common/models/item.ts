import mongoose = require('mongoose');

interface Item extends mongoose.Document {
    name: string;
    behavior: ItemBehavior;
    price: number;
    photoUrl: string;
}

export default Item;
export enum ItemBehavior {DEFENSIVE = 0, OFFENSIVE = 1}

const schema = new mongoose.Schema(
    {
        name: {type: String, required: true},
        photoUrl: {type: String, required: true},
        behavior: {type: Number, required: true},
        price: {type: Number, required: true}
    },
    {
        collection: 'items',
        strict: 'throw',
        timestamps: true
    }
);

export const ItemType = mongoose.model<Item>('Item', schema);
