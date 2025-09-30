// The first four bits of the hix are used for the type of the target
export const HIX_HANDLER =   0x00000000
export const HIX_REPLY =     0x10000000
export const HIX_ROUTER =    0x20000000
export const HIX_TYPE_MASK = 0xF0000000;  // top 4 bits
export const HIX_MASK =      0x0FFFFFFF;  // lower 28 bits

export function Target(uid, pin, channel = false) {

    this.uid = uid                  // The uid of the actor
    this.actor = null               // The actor
    this.pin = pin                  // the name of the input pin
    this.channel = channel          // true if the input has a channel
    this.hix = HIX_HANDLER          // the index of the input in the rx table of the actor (where the handler is)
}

// arrows used for targets
const arrow = '->'
const channelArrow = '=>'

export const convert = {

    // just remove the arrow at the front and trim
    stringToInput(str) {

        const pure = str.trim()

        const symbol = pure.slice(0,2)

        const pin = pure.slice(2).trim();

        return {
            pin,
            channel: (symbol === arrow) ? false : true
        }
    },

    // make an output record for a single output string
    stringToOutput(str) {

        // helper function
        function singleTarget(str) {
            return str[0] == '[' && str.at(-1) == ']' ? false : true
        }

        // check if channel or not
        let channel = false

        let symbolIndex = str.indexOf(arrow)
        if (symbolIndex < 0) {
            symbolIndex = str.indexOf(channelArrow)
            channel = true
        }
        if (symbolIndex < 0) return null

        const output = str.slice(0,symbolIndex).trim()
        const targetString = str.slice(symbolIndex+2).trim()

        // check
        if (output.length == 0 || targetString.length == 0) return null

        // check if one or many
        if (singleTarget(targetString))   {

            const rawTarget = convert.stringToTarget(targetString)

            return rawTarget ? {output, channel, targets: [rawTarget]} : {output, channel, targets: []} 
        }
        else {

            // get all the targets between " "
            const regex = /"(?:\\.|[^"\\])*"/g;
            let matches = targetString.match(regex);
            
            // split in target strings
            const targetStringArray = matches ? matches.map(str => str.slice(1, -1).replace(/\\"/g, '"')) : []

            // The array to collect the targets
            const rawTargets = []

            // do all the target strings
            for (const  target of targetStringArray) {
                const rawTarget = convert.stringToTarget(target)
                if (rawTarget) rawTargets.push(rawTarget)
            }

            // done 
            return {output, channel, targets: rawTargets}
        }
    },

    // This function is used for the routertable
    stringToScope(str) {

        // selector and scope are seperated by a colon
        let colon = str.indexOf(':')
        if (colon < 0) return null

        const selector = str.slice(0,colon).trim()
        const scope = str.slice(colon+1).trim()

        // check
        if (selector.length == 0 || scope.length == 0) return null

        // get all the targets between " "
        const regex = /"(?:\\.|[^"\\])*"/g;
        let matches = scope.match(regex);
        
        // split in target strings
        const targetStringArray = matches ? matches.map(str => str.slice(1, -1).replace(/\\"/g, '"')) : []

        // The array to collect the targets
        const rawTargets = []

        // do all the target strings
        for (const  target of targetStringArray) {
            const rawTarget = convert.stringToTarget(target)
            if (rawTarget) rawTargets.push(rawTarget)
        }

        // done 
        return {selector, scope: rawTargets}
    },

    // format: pin name @ node name (uid)
    stringToTarget(str) {

        // get the uid at the end
        const uidStart = str.lastIndexOf('(')
        if (uidStart < 0) return null

        const uidEnd = str.lastIndexOf(')')
        if (uidEnd < 0) return null

        // check if there is anything
        if (uidEnd - uidStart < 2) return null

        const uid = str.slice(uidStart+1, uidEnd)

        const atIndex = str.indexOf('@')

        if (atIndex < 0) return null

        const pinName = str.slice(0,atIndex).trim()
        const nodeName = str.slice(atIndex+1,uidStart).trim()

        if (pinName.length == 0 || nodeName.length == 0) return null

        return {pinName, nodeName, uid}
    },

    // transforms a name to a valid javascript identifier
    pinToHandler(pinName) {

        const words = pinName
            // and split on space, dot, or hyphen
            .split(/[ .-]+/)
            // Remove illegal characters from each segment, but keep underscores
            .map(w => w.replace(/[^a-zA-Z0-9_]/g, ''));

        // Remove empty segments (e.g. from "foo..bar")
        const cleaned = words.filter(Boolean);

        // CamelCase construction
        return 'on' + cleaned.map(word  => word[0].toUpperCase() + word.slice(1)).join('');
    },
}