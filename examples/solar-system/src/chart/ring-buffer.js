export class RingBuffer {

constructor(size) {
    this.size = size;
    this.buffer = new Array(size);
    this.index = 0;
    this.count = 0; // Track the number of elements added
}

reset() {
    this.index = 0;
    this.count = 0;
}

add(item) {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.size; // Move the index in a circular fashion
    if (this.count < this.size) {
        this.count++;
    }
}

getLast() {
    return this.index > 0 ? this.buffer[this.index-1] : this.buffer.at(-1)
}

asArray() {

    if (!this.count) return []
    return this.count == this.size  ? this.buffer.slice(this.index).concat(this.buffer.slice(0, this.index))
                                    : this.buffer.slice(0, this.count)
}

// Implement the iterator protocol
[Symbol.iterator]() {

    let count = this.count;
    let buffer = this.buffer;
    let start = this.index;
    let size = this.size;
    let i = 0;

    return {
        next() {
            if (i >= count) {
                return { done: true }; // End of iteration
            }
            // Calculate the current index in the circular buffer
            const idx = (start + i) % size;
            i++;
            return { value: buffer[idx], done: false };
        }
    };
}
}