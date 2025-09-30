// reads and saves files to a given arl

export function FileHandler( tx, sx) {

    this.tx = tx
}
FileHandler.prototype = {

    async "-> open file"(arl) {
        const content = await arl.get()
        this.tx.send("content", {content, arl})
    },

    "-> save to file"({content, arl}) {
        arl.save(content)
    }
}