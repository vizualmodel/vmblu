export const HIX_HANDLER =   0x00000000
export const HIX_REPLY =     0x10000000
export const HIX_TYPE_MASK = 0xF0000000
export const HIX_MASK =      0x0FFFFFFF

export function Target(uid, pin, channel = false) {

    this.uid = uid
    this.actor = null
    this.pin = pin
    this.channel = channel
    this.hix = HIX_HANDLER
}

const arrow = '->'
const channelArrow = '=>'

export const convert = {

    stringToInput(str) {

        const pure = str.trim()
        const symbol = pure.slice(0,2)
        const pin = pure.slice(2).trim()

        return {
            pin,
            channel: (symbol === arrow) ? false : true
        }
    },

    stringToOutput(str) {

        function singleTarget(targetString) {
            return targetString[0] == '[' && targetString.at(-1) == ']' ? false : true
        }

        let channel = false

        let symbolIndex = str.indexOf(arrow)
        if (symbolIndex < 0) {
            symbolIndex = str.indexOf(channelArrow)
            channel = true
        }
        if (symbolIndex < 0) return null

        const output = str.slice(0,symbolIndex).trim()
        const targetString = str.slice(symbolIndex+2).trim()

        if (output.length == 0 || targetString.length == 0) return null

        if (singleTarget(targetString)) {

            const rawTarget = convert.stringToTarget(targetString)

            return rawTarget ? {output, channel, targets: [rawTarget]} : {output, channel, targets: []}
        }

        const regex = /"(?:\\.|[^"\\])*"/g
        const matches = targetString.match(regex)
        const targetStringArray = matches ? matches.map(part => part.slice(1, -1).replace(/\\"/g, '"')) : []
        const rawTargets = []

        for (const target of targetStringArray) {
            const rawTarget = convert.stringToTarget(target)
            if (rawTarget) rawTargets.push(rawTarget)
        }

        return {output, channel, targets: rawTargets}
    },

    stringToTarget(str) {

        const uidStart = str.lastIndexOf('(')
        if (uidStart < 0) return null

        const uidEnd = str.lastIndexOf(')')
        if (uidEnd < 0) return null

        if (uidEnd - uidStart < 2) return null

        const uid = str.slice(uidStart+1, uidEnd)
        const atIndex = str.indexOf('@')

        if (atIndex < 0) return null

        const pinName = str.slice(0,atIndex).trim()
        const nodeName = str.slice(atIndex+1,uidStart).trim()

        if (pinName.length == 0 || nodeName.length == 0) return null

        return {pinName, nodeName, uid}
    },

    pinToHandler(pinName) {

        const words = pinName
            .split(/[ .-]+/)
            .map(word => word.replace(/[^a-zA-Z0-9_]/g, ''))

        const cleaned = words.filter(Boolean)

        return 'on' + cleaned.map(word => word[0].toUpperCase() + word.slice(1)).join('')
    },
}
