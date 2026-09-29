import {style} from '../util/style.js'

// Bundles are shared visual membership arrays, never semantic pins.
export function bundleRepresentative(pin) {
    return pin.bundle?.[0] ?? pin
}

export function bundleMembers(pin) {
    return pin.bundle ?? [pin]
}

export function bundleEligibility(pins, existingBundle = null) {
    if (pins.length < 2 || new Set(pins).size !== pins.length) return 'Select at least two distinct pins.'
    const first = pins[0]
    if (!first?.is.pin) return 'Select pins only.'
    const iface = first.node.look.findIfNameAbove(first.rect.y)
    for (const pin of pins) {
        if (!pin.is.pin || pin.node !== first.node || pin.is.left !== first.is.left ||
            pin.is.input !== first.is.input || pin.is.channel !== first.is.channel ||
            pin.node.look.findIfNameAbove(pin.rect.y) !== iface) {
            return 'Bundle members must share a node, interface, side, and pin kind.'
        }
        if (pin.bundle && pin.bundle !== existingBundle) return 'Expand existing bundles before regrouping.'
    }
    return null
}

export function reconcilePinBundles(look, diagnostic = message => console.warn(message)) {
    const bundles = new Set(look.widgets.map(pin => pin.bundle).filter(Boolean))
    for (const bundle of bundles) {
        const members = bundle.filter(pin => look.widgets.includes(pin) && !pin.is.zombie)
        if (members.length !== bundle.length) diagnostic('Missing pin bundle members were removed.')
        const error = bundleEligibility(members, bundle)
        if (error) {
            expandBundle(bundle[0])
            diagnostic(`Pin bundle expanded after model changes: ${error}`)
        } else {
            for (const pin of bundle) if (!members.includes(pin)) pin.bundle = null
            bundle.splice(0, bundle.length, ...members)
        }
    }
}

export function createBundle(pins) {
    const error = bundleEligibility(pins)
    if (error) throw new Error(error)
    const bundle = pins.slice()
    for (const pin of bundle) pin.bundle = bundle
    return bundle
}

export function expandBundle(pin) {
    const bundle = pin.bundle
    if (!bundle) return null
    for (const member of bundle) member.bundle = null
    return bundle
}

export function removeBundleMember(pin) {
    const bundle = pin.bundle
    if (!bundle) return
    pin.bundle = null
    bundle.splice(bundle.indexOf(pin), 1)
    if (bundle.length < 2) for (const member of bundle) member.bundle = null
}

export function restorePinBundles(pins, declarations, diagnostic = message => console.warn(message)) {
    const byWid = new Map(pins.map(pin => [pin.wid, pin]))
    const claims = new Map()
    for (const {wids} of declarations) for (const wid of new Set(wids)) claims.set(wid, (claims.get(wid) ?? 0) + 1)
    for (const {pin, wids} of declarations) {
        if (new Set(wids).size !== wids.length || wids.some(wid => claims.get(wid) > 1)) {
            diagnostic('Invalid overlapping pin bundle; showing separate pins.')
            continue
        }
        const members = wids.map(wid => byWid.get(wid)).filter(Boolean)
        if (members.length !== wids.length) diagnostic('Missing pin bundle members were removed.')
        const error = bundleEligibility(members)
        if (error || !members.includes(pin)) {
            diagnostic(`Invalid pin bundle; showing separate pins. ${error ?? 'Missing declaring pin.'}`)
            continue
        }
        createBundle(members)
    }
}

// Expanded rectangles remain authoritative for serialization and interface membership.
export function bundleRect(widget) {
    const look = widget.node?.look
    if (!look) return widget.rect
    const representative = widget.is.pin ? bundleRepresentative(widget) : widget
    const rect = {...representative.rect}
    const hidden = look.widgets.filter(pin => pin.bundle && bundleRepresentative(pin) !== pin)
    if (widget.is.box) rect.h -= hidden.reduce((sum, pin) => sum + pin.rect.h, 0)
    else rect.y -= hidden.filter(pin => pin.rect.y < representative.rect.y).reduce((sum, pin) => sum + pin.rect.h, 0)
    if (representative.bundle) {
        rect.w = look.rect.w
        rect.x = representative.is.left ? look.rect.x - style.pin.wOutside : look.rect.x + style.pin.wOutside
    }
    return rect
}

export function bundleLabel(pin) {
    const members = bundleMembers(pin)
    const names = members.map(member => member.displayName(false)).join(', ')
    return pin.bundle ? `${names}  (${members.filter(member => member.routes.some(route => route.to)).length}/${members.length} connected)` : names
}

export function bundleLocalName(pin) {
    return pin.pxlen > 0 ? pin.name.slice(pin.pxlen + 1) : pin.pxlen < 0 ? pin.name.slice(0, pin.pxlen - 1) : pin.name
}

export function matchBundleConnections(from, to) {
    const result = {pairs: [], unmatched: [], error: null}
    if (!from?.is.pin || !to?.is.pin) {
        result.error = 'Expand bundles to connect to buses or pads.'
        return result
    }
    const source = bundleMembers(from), target = bundleMembers(to)
    for (const pin of source) {
        const name = bundleLocalName(pin)
        const matches = target.filter(other => bundleLocalName(other) === name)
        if (!matches.length) { result.unmatched.push(pin); continue }
        if (matches.length !== 1 || source.filter(other => bundleLocalName(other) === name).length !== 1) {
            result.error = 'Ambiguous bundle match. Expand and select individual members.'
            return result
        }
        const other = matches[0]
        if (pin === other || pin.is.input === other.is.input || pin.is.channel !== other.is.channel ||
            (!pin.haveRoute(other) && !pin.canConnect(other))) {
            result.error = `Invalid connection: ${pin.name} → ${other.name}.`
            return result
        }
        result.pairs.push([pin, other])
    }
    result.unmatched.push(...target.filter(pin => !result.pairs.some(pair => pair[1] === pin)))
    if (!result.pairs.length) result.error = 'No matching local member names.'
    return result
}

export function bundleConnectionPreview(match) {
    return match.error ?? [
        ...match.pairs.map(([a, b]) => `${a.name} @ ${a.node.name} → ${b.name} @ ${b.node.name}${a.haveRoute(b) ? ' (already connected)' : ''}`),
        ...(match.unmatched.length ? ['Unmatched: ' + match.unmatched.map(pin => pin.name).join(', ')] : []),
    ].join('\n')
}

// Validate using the normal naming implementation on detached drafts, without
// changing the existing pin, duplicate flags, routes, or widget-ID generator.
export function parseBundleNames(pin, text, excluded = [pin]) {
    const look = pin.node.look
    const parts = text.split(',').map(name => name.trim())
    const drafts = []
    for (const name of parts) {
        if (!name || /@|->|=>/.test(name)) throw new Error('Bundle members need nonempty valid names.')
        const draft = Object.create(pin)
        draft.name = name
        draft.pxlen = 0
        draft.rect = {...pin.rect}
        draft.is = {...pin.is}
        draft.routes = []
        const draftLook = Object.create(look)
        draftLook.adjustPinWidth = () => {}
        draftLook.setDuplicatePin = () => {}
        draft.node = {...pin.node, look: draftLook}
        const retained = (pin.bundle ?? [pin]).find(member => excluded.includes(member) && member.displayName(false) === name)
        if (retained) {
            draft.name = retained.name
            draft.pxlen = retained.pxlen
        } else if (!draft.checkNewName() || !draft.name) throw new Error(`Invalid bundle member: ${name}`)
        const others = [...look.widgets.filter(other => other.is.pin && !excluded.includes(other)), ...drafts]
        if (others.some(other => draft.nameClash(other) || draft.hasFullNameMatch(other))) {
            throw new Error(`Duplicate pin or handler name: ${name}`)
        }
        drafts.push(draft)
    }
    return drafts
}

export function createBundleFromList(pin, text) {
    const look = pin.node.look
    const drafts = parseBundleNames(pin, text)
    if (drafts.length < 2) throw new Error('A bundle needs at least two pins.')
    const members = [pin]
    pin.name = drafts[0].name
    pin.pxlen = drafts[0].pxlen
    pin.nameChanged('')
    look.adjustPinWidth(pin)
    for (const draft of drafts.slice(1)) {
        const previous = members.at(-1)
        const member = look.addPin(draft.name, {x: pin.rect.x, y: previous.rect.y + previous.rect.h}, pin.is)
        member.pxlen = draft.pxlen
        member.is.proxy ? pin.node.addPad(member) : pin.node.rxtxAddPin(member)
        members.push(member)
    }
    createBundle(members)
    pin.bundleCreation = members.slice()
    return members
}

export function bundleExpandedPosition(look, pos) {
    const rows = look.widgets.filter(widget => (widget.is.pin || widget.is.ifName) && (!widget.bundle || bundleRepresentative(widget) === widget))
        .sort((a, b) => bundleRect(a).y - bundleRect(b).y)
    const row = rows.find(widget => pos.y < bundleRect(widget).y + widget.rect.h)
    if (row) return {...pos, y: pos.y + row.rect.y - bundleRect(row).y}
    const hiddenHeight = look.widgets.filter(pin => pin.bundle && bundleRepresentative(pin) !== pin).reduce((sum, pin) => sum + pin.rect.h, 0)
    return {...pos, y: pos.y + hiddenHeight}
}

export function bundleLastMember(pin) {
    return bundleMembers(pin).reduce((last, member) => member.rect.y > last.rect.y ? member : last, pin)
}

export function bundleInsertionPosition(look, pos) {
    const row = look.widgets.find(pin => pin.bundle?.[0] === pin && pos.y >= bundleRect(pin).y && pos.y < bundleRect(pin).y + pin.rect.h)
    if (!row) return bundleExpandedPosition(look, pos)
    if (pos.y >= bundleRect(row).y + row.rect.h / 2) {
        const last = bundleLastMember(row)
        return {...pos, y: last.rect.y + last.rect.h}
    }
    return {...pos, y: Math.min(...row.bundle.map(pin => pin.rect.y))}
}

export function dragBundle(pin, pos) {
    const look = pin.node.look
    const bundle = pin.bundle ?? [pin]
    const interfaces = new Map(look.widgets.filter(widget => widget.is.pin).map(member => [member, look.findIfNameAbove(member.rect.y)]))
    pos = bundleExpandedPosition(look, pos)
    const left = pos.x < look.rect.x + look.rect.w / 2
    for (const member of bundle) if (member.is.pin && member.is.left !== left) member.leftRightSwap()
    const next = look.findNextWidget(pin, pos, widget => (widget.is.pin || widget.is.ifName) && !bundle.includes(widget) && (!widget.bundle || widget.bundle[0] === widget))
    if (!next) return
    const members = bundle.slice().sort((a, b) => a.rect.y - b.rect.y)
    const rows = look.widgets.filter(widget => widget.is.pin || widget.is.ifName).sort((a, b) => a.rect.y - b.rect.y)
    const offsets = new Map(members.map(member => [member, member.rect.y - members[0].rect.y]))
    const height = offsets.get(members.at(-1)) + members.at(-1).rect.h
    const remaining = rows.filter(widget => !bundle.includes(widget))
    const down = next.rect.y > pin.rect.y
    const boundary = down && next.bundle ? next.bundle.at(-1) : next
    const index = remaining.indexOf(boundary) + (down ? 1 : 0)
    remaining.splice(index, 0, bundle)
    let y = rows[0].rect.y
    const oldBottom = rows.at(-1).rect.y + rows.at(-1).rect.h
    for (const row of remaining) {
        if (row === bundle) {
            for (const member of members) member.rect.y = y + offsets.get(member)
            y += height
        } else {
            row.rect.y = y
            y += row.rect.h
        }
    }
    look.rect.h += y - oldBottom
    const box = look.widgets.find(widget => widget.is.box)
    if (box) box.rect.h += y - oldBottom
    for (const [member, before] of interfaces) if (look.findIfNameAbove(member.rect.y) !== before) member.moveToInterface()
    look.adjustRoutes()
}
