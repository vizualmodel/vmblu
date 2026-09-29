import {parseBundleNames, createBundle, expandBundle} from '../../types/widget/pin-bundle.js'
import {redoxWidget} from './redox-widget.js'

export function planBundleEdit(pin, text) {
    const previous = (pin.bundle ?? [pin]).slice()
    const drafts = text.trim() ? parseBundleNames(pin, text, previous) : []
    const parts = text.split(',').map(value => value.trim())
    const members = drafts.map((draft, index) => ({draft, pin: previous.find(member =>
        member.displayName(false) === parts[index] || member.name === draft.name)}))
    if (new Set(members.filter(item => item.pin).map(item => item.pin)).size !== members.filter(item => item.pin).length)
        throw new Error('Duplicate bundle member.')
    const unmatched = previous.filter(pin => !members.some(item => item.pin === pin))
    for (const item of members) if (!item.pin && unmatched.length) item.pin = unmatched.shift()
    return {previous, members, removed: previous.filter(pin => !members.some(item => item.pin === pin))}
}

function captureBundleLayout(node) {
    const widgets = node.look.widgets.slice()
    const routes = new Set(widgets.flatMap(widget => widget.routes ?? []))
    for (const pad of node.pads ?? []) for (const route of pad.routes) routes.add(route)
    return {node, widgets, pads: node.pads?.slice(), rect: {...node.look.rect},
        names: widgets.filter(widget => widget.is.pin).map(pin => [pin, pin.name, pin.pxlen]),
        padStates: (node.pads ?? []).map(pad => [pad, pad.text, {...pad.rect}]),
        positions: widgets.map(widget => [widget, {...widget.rect}]),
        wires: [...routes].map(route => [route, route.copyWire()])}
}

function restoreBundleLayout(snapshot) {
    const {node, widgets, pads, rect, positions, wires, names, padStates} = snapshot
    node.look.widgets.splice(0, node.look.widgets.length, ...widgets)
    if (pads) node.pads.splice(0, node.pads.length, ...pads)
    Object.assign(node.look.rect, rect)
    for (const [widget, position] of positions) Object.assign(widget.rect, position)
    for (const [route, wire] of wires) route.restoreWire(wire)
    for (const [pin, name, pxlen] of names) Object.assign(pin, {name, pxlen})
    for (const [pad, text, position] of padStates) {
        pad.text = text
        Object.assign(pad.rect, position)
    }
    for (const [pin] of names) {
        pin.checkRouteUsage()
        node.look.setDuplicatePin(pin)
    }
}

function restoreBundleMembers(members) {
    for (const pin of members) if (pin.bundle) expandBundle(pin)
    if (members.length > 1) createBundle(members)
}

function removeBundleAddition(pin) {
    pin.node.look.removePin(pin)
    pin.is.proxy ? pin.node.removePad(pin.pad) : pin.node.rxtxRemovePin(pin)
}

function restoreBundleAddition(pin) {
    const wid = pin.wid
    pin.node.look.restorePin(pin)
    pin.wid = wid
    pin.is.proxy ? pin.node.restorePad(pin.pad) : pin.node.rxtxAddPin(pin)
}

function selectBundleResult(view, members) {
    view.selection.reset()
    if (members.length) view.selection.switchToWidget(members[0])
}

export const bundleEditAction = {
    doit({view, pin, text}) {
        if (pin.node.cannotBeModified?.()) return
        let plan
        try { plan = planBundleEdit(pin, text) }
        catch (error) {
            this.manager?.tx?.send('info popup', {title: 'Pin bundle', message: error.message, duration: 5000})
            return
        }
        const {previous, members, removed} = plan
        if (members.length === previous.length && members.every((item, i) => item.pin === previous[i] &&
            item.draft.name === item.pin.name && item.draft.pxlen === item.pin.pxlen)) return
        const node = pin.node, look = node.look
        const before = captureBundleLayout(node)
        const selection = view.selection.shallowCopy()
        const deleted = [], added = []
        const history = {saveEdit(verb, param) { deleted.push(param) }}
        const top = Math.min(...previous.map(member => member.rect.y))
        expandBundle(pin)
        // Reuse the existing deletion transaction, including proxy pads and cable collapse.
        for (const member of removed.slice().sort((a, b) => b.rect.y - a.rect.y))
            redoxWidget.deletePin.doit.call(history, {view, pin: member, bundleMember: true})
        for (const item of members) {
            if (item.pin) {
                const member = item.pin
                if (member.name !== item.draft.name || member.pxlen !== item.draft.pxlen) {
                    const previousName = member.name
                    const contact = member.pad?.center()
                    member.name = item.draft.name
                    member.pxlen = item.draft.pxlen
                    member.nameChanged(previousName)
                    // A longer pad label must not move its route attachment.
                    if (contact) member.pad.rect.x = contact.x - (member.pad.is.leftText ? member.pad.rect.w : 0)
                    look.adjustPinWidth(member)
                }
                continue
            }
            const y = Math.max(top, ...members.filter(item => item.pin).map(item => item.pin.rect.y + item.pin.rect.h))
            const member = look.addPin(item.draft.name, {x: pin.rect.x, y}, {
                input: pin.is.input, channel: pin.is.channel, proxy: pin.is.proxy, left: pin.is.left,
            })
            member.pxlen = item.draft.pxlen
            member.is.proxy ? node.addPad(member) : node.rxtxAddPin(member)
            look.adjustPinWidth(member)
            item.pin = member
            added.push(member)
        }
        const next = members.map(item => item.pin)
        // Use the members' expanded row slots; unrelated rows keep their positions.
        const slots = next.map(member => member.rect.y).sort((a, b) => a - b)
        next.forEach((member, index) => { member.rect.y = slots[index] })
        restoreBundleMembers(next)
        for (const member of next) {
            member.checkRouteUsage()
            look.setDuplicatePin(member)
        }
        look.adjustRoutes()
        const after = captureBundleLayout(node)
        selectBundleResult(view, next)
        this.saveEdit('editBundle', {view, previous, next, deleted, added, before, after, selection})
    },
    undo({view, previous, next, deleted, added, before, selection}) {
        for (const member of next) if (member.bundle) expandBundle(member)
        for (const member of added.slice().reverse()) removeBundleAddition(member)
        for (const edit of deleted.slice().reverse())
            redoxWidget.deletePin.undo({...edit, padRoutes: edit.padRoutes?.slice()})
        restoreBundleLayout(before)
        restoreBundleMembers(previous)
        view.selection.reset()
        Object.assign(view.selection, selection.shallowCopy())
        for (const node of view.selection.nodes) node.doSelect()
        for (const widget of view.selection.widgets) widget.doSelect()
    },
    redo({view, previous, next, deleted, added, after}) {
        for (const member of previous) if (member.bundle) expandBundle(member)
        for (const edit of deleted) redoxWidget.deletePin.redo(edit)
        for (const member of added) restoreBundleAddition(member)
        restoreBundleLayout(after)
        restoreBundleMembers(next)
        selectBundleResult(view, next)
    },
}
