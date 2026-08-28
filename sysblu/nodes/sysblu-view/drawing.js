import {systemStyle} from './system-style.js'

export function roundedRect(ctx, rect, radius) {
    const {x, y, w, h} = rect
    const r = Math.min(radius, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

export function topRoundedRect(ctx, rect, radius) {
    const {x, y, w, h} = rect
    const r = Math.min(radius, w / 2, h)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

export function inside(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
}

export function pointSegmentDistance(point, a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y)
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

export function drawArrow(ctx, from, to, color) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const {arrowAngle, arrowLength} = systemStyle.route
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - arrowLength * Math.cos(angle - arrowAngle), to.y - arrowLength * Math.sin(angle - arrowAngle))
    ctx.lineTo(to.x - arrowLength * Math.cos(angle + arrowAngle), to.y - arrowLength * Math.sin(angle + arrowAngle))
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
}
