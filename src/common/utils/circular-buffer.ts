export default class CircularBuffer<T> {
    private buffer: T[] = [];
    private nextWriteIndex = 0;

    constructor(private capacity: number) {}

    push(elem: T) {
        this.buffer[this.nextWriteIndex] = elem;
        this.nextWriteIndex = (this.nextWriteIndex + 1) % this.capacity;
    }

    map<R>(callback: (elem: T) => R) {
        const {buffer, nextWriteIndex, capacity} = this;
        const {length} = buffer;
        const result = new Array<R>(length);

        for (let i = 0, j = nextWriteIndex % length;
            i < length;
            ++i, j = (j + 1) % length
        ) {
            result[i] = callback(buffer[j]);
        }

        return result;
    }
}
