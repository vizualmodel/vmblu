import {convert, eject, style, shape} from '../util/index.js'

//const SEPARATOR = ' '

export const pinNameHandling = {

    startEdit(ctx, click=null) {

        // before editing we remove the post or prefix from the name
        if (this.pxlen) {
            this.name = this.withoutPrefix()
            this.pxlen = 0
        }

        if (!click) return {prop: 'name', index: this.name.length};

        // the text starts here
        const xText = this.is.left  ? this.rect.x + style.pin.wMargin 
                                    : this.rect.x + this.rect.w - style.pin.wMargin - ctx.measureText(this.name).width

        // determine the character where the cursor has to be placed
        const index = shape.cursorIndex(ctx, this.name,xText, click.x) 

        // return the field that will be edited and the alignment
        return {prop: 'name', index}
    },

    // returns the cursor position for a given index in the text
    cursorPos(ctx, i) {
        const rc = this.rect
        return this.is.left ? {x: rc.x + style.pin.wMargin + ctx.measureText(this.name.slice(0,i)).width, y: rc.y}
                            : {x: rc.x + rc.w - style.pin.wMargin - ctx.measureText(this.name).width + ctx.measureText(this.name.slice(0,i)).width, y: rc.y}
    },

    endEdit(saved) {
        this.checkNewName() ? this.nameChanged(saved) : this.restoreSavedName(saved)      
    },

    // a function to get the displayname
    displayName() {

        let dName = this.pxlen == 0 ? this.name : this.withoutPrefix()

        if (!this.is.capability) return dName

        const mark = this.is.input ? '\u24E3' : '\u24D4'

        return this.is.left ?  mark + ' ' + dName : dName + ' ' + mark 
    },

    // check for a name clash
    nameClash(other) {

        // both should be input or output
        if (this.is.input != other.is.input) return false

        // Check for lowercase identity
        if (this.lowerCase() == other.lowerCase()) return true

        // for inputs also check the handler name
        return (this.is.input) ? (convert.pinToHandler(this.name) == convert.pinToHandler(other.name)) : false
    },

    lowerCase() {
        return this.name.toLowerCase()
    },


    // when after editing the pin.name has changed, we might have to add a prefix and/or change the look 
    // return true when the name change can be accepted, otherwise false
    checkNewName() {

        // clean the user input
        this.name = convert.cleanInput(this.name)

        // the new name is empty - allowed only if no routes
        if (this.name.length == 0) return (this.routes?.length == 0)

        // if the newName starts or ends with a special character
        if (convert.needsPrefix(this.name) || convert.needsPostfix(this.name)) {

            // the name should be longer than just the one character
            if (this.name.length == 1) return false

            // add the prefix/postfix to the name
            this.addIfName()
        }
        // no prefix naming - reset the prefix/postfix length
        else this.pxlen = 0

        // check the route usage
        this.checkRouteUsage()

        // adjust the size of the widget and the look as needed
        this.node.look?.adjustPinWidth(this)

        // check the name for duplicates
        this.node.look.setDuplicatePin(this)

        // done
        return true
    },

    // After changing the name, we have to adapt the rx tx table 
    nameChanged(previousName) {

        // find the 'unchanged' name in the tx / rx table
        const rxtx = this.is.input  ? this.node.rxTable.find( rx => rx.pin == this) 
                                    : this.node.txTable.find( tx => tx.pin == this)

        // if the name has zero length, remove the pin
        if (this.name.length == 0) {

            // remove entry in rx or tx table 
            this.is.input ? eject(this.node.rxTable, rxtx) : eject(this.node.txTable, rxtx)

            // remove the widget from the look
            this.node.look.removePin(this) 

            // done
            return
        }
    },

    // restore the saved name 
    restoreSavedName(savedName) {

        // restore the name
        this.name = savedName

        // if the saved name has a +, handle it
        if (convert.needsPrefix(savedName) || convert.needsPostfix(savedName)) this.addIfName()
    },

    // there is a prefix or a postfix that is not displayed
    withoutPrefix() {

        // change a space into a subscript '+' sign
        const smallPlus = '\u208A'

        if (this.pxlen == 0) {
            return this.name
        }
        else if (this.pxlen > 0) {

            let noPrefix = this.name.slice(this.pxlen)
            return noPrefix[0] !== ' ' ? noPrefix : smallPlus + noPrefix.trim()
        }
        else if (this.pxlen < 0) {
            let noPostfix = this.name.slice(0,this.pxlen)
            return noPostfix.at(-1) !== ' ' ? noPostfix : noPostfix.trim() + smallPlus
        }
    },

    // get the prefix or postfix for this pin
    getPrefix() {
        return    (this.pxlen > 0) ? this.name.slice(0,this.pxlen) 
                : (this.pxlen < 0) ? this.name.slice(this.pxlen)
                : null
    },


    // This is for pins that have pxlen 0 but their postfix or prefix might match the ifName
    ifNamePrefixCheck() {

        // reset pxlen
        this.pxlen = 0

        // find the relevant ifName
        const text = this.node.look.findIfNameAbove(this.rect.y)?.text.toLowerCase()

        // check
        if (!text) return

        // Get the lowercase name
        const lowerCase = this.lowerCase()

        // check if the name of the ifName is a prefix to the pin
        if (convert.prefixMatch(text, lowerCase))
            this.pxlen = text.length
        else if (convert.postfixMatch(text, lowerCase))
            this.pxlen = -text.length
    },

    // after typing the name with a + at the beginning or the end, we have to set the prefixlength
    // the name has a prefix - find the prefix (ifName) and add it to the name - the name has been trimmed
    
    addIfName() {

        // find the ifName above
        const ifName = this.node.look.findIfNameAbove(this.rect.y)

        // check
        if (convert.needsPrefix(this.name)) {

            if (ifName) {

                this.name = convert.combineWithPrefix(ifName.text, this.name)
                this.pxlen = ifName.text.length
            }
            else {
                this.name = this.name.slice(1).trimStart()
                this.pxlen = 0
            }
        }
        else if (convert.needsPostfix(this.name)) {

            if (ifName) {
                this.name = convert.combineWithPostfix(ifName.text, this.name)
                this.pxlen = -ifName.text.length
            }
            else {
                this.name = this.name.slice(0,-1).trimEnd()
                this.pxlen = 0
            }
        }
    },

    // when we copy a node from another node it could be that we have not copied the ifName
    // so we have to check if pxlen has to be set to zero or not
    checkPrefix() {

        // check
        if (this.pxlen == 0) return;

        // get the prefix
        const prefix = this.getPrefix()

        // find the ifName above
        const ifName = this.node.look.findIfNameAbove(this.rect.y)

        // if the prefix and the ifName correspond all is well
        if (ifName && prefix == ifName.text) return;

        // cancel the prefix
        this.pxlen = 0
    },

    // change the prefix or postfix of the pin
    // Note that the pin is supposed to have a prefix
    changePrefix(newPrefix) {

        // if there is no prefix nothing to do
        if (this.pxlen == 0) return;

        // if the new prefix has length 0 we simply set pxlen to 0
        if (newPrefix.length == 0) {
            this.pxlen = 0
            return;
        }

        // strip away the old prefix and add the plus to make combine work !
        //const baseName = this.pxlen > 0 ?  '+' + this.name.slice(this.pxlen+1) : this.name.slice(0, this.pxlen-1) + '+'
        const baseName = this.pxlen > 0 ?  this.name.slice(this.pxlen) : this.name.slice(0, this.pxlen)

        // recombine with the new prefix
        this.name = convert.combineWithPrefix(newPrefix, baseName)

        // and reset pxlen
        this.pxlen = this.pxlen > 0 ? newPrefix.length : -newPrefix.length
    },

    checkRouteUsage() {

        // reset all the routes to used
        for(const route of this.routes) route.is.notUsed = false

        // check the routes
        for(const route of this.routes) {

            // get the other side of the route
            const other = route.from == this ? route.to : route.from;

            if (other.is.tack) {

                // check all the bus routes
                let found = false
                for(const tack of other.cable.tacks) {

                    // skip 
                    if (tack == other) continue

                    // get the pin or pad at the other end 
                    const busWidget = tack.route.to == tack ? tack.route.from : tack.route.to

                    // it could be that the route was not used
                    if (other.cable.areConnected(this, busWidget)) {
                        tack.route.is.notUsed = false
                        found = true
                    }
                }
                // if we have not found one connection..
                if (!found) route.is.notUsed = true
            }
        }
    },

    // is used to check if two pins are logically connected via a cable
    hasFullNameMatch(pin) {
        return this.lowerCase() == pin.lowerCase()
    }
}
