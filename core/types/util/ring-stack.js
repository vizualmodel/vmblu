// the undo stack is actually a ring buffer of a given size
// The size of the buffer is MAX + 1
export function RingStack(size) {

    // if next == bottom there is no data on the ring stack
    this.bottom = 0
    this.top = 0
    this.next = 0
    this.max = size > 0 ? size-1 : 1
    this.ring = new Array(this.max+1)
    this.ring.fill(null)
}
RingStack.prototype = {

    reset() {
        this.bottom = 0
        this.top = 0
        this.next = 0
        this.ring.fill(null)        
    },

    push( item ) {

        // the top of the stack changes
        this.top = this.next

        // top points to the first available slot - store the item
        this.ring[ this.top ] = item

        // change next
        this.next = (this.next == this.max) ? 0 : this.next + 1
        
        // bottom might also have to shift..
        if (this.next == this.bottom) {
            this.bottom = (this.bottom == this.max) ? 0 : this.bottom + 1
        }
    },

    last(){
        return this.ring[this.top]
    },

    back() {

        // if at the bottom return null
        if (this.next == this.bottom) return null

        this.next = (this.next == 0) ? this.max : this.next - 1

        return this.ring[this.next]
    },

    forward() {

        // if past the top return null
        if (this.next == this.top + 1) return null

        const item = this.ring[this.next]

        this.next = this.next == this.max ? 0 : this.next + 1

        return item
    }
}