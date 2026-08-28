import {inside} from '../drawing.js'
import {systemStyle} from '../system-style.js'

const endpointColors = {
    server: systemStyle.endpoint.server,
    client: systemStyle.endpoint.client,
    peer: systemStyle.endpoint.peer,
}

function protocolLabel(protocol) {
    const target = String(protocol ?? '').split(/[?#]/, 1)[0]
    const filename = target.split(/[\\/]/).at(-1) ?? ''
    if (/\.protocol\.json$/i.test(filename)) return filename.replace(/\.protocol\.json$/i, '')
    return filename.replace(/\.[^.]+$/, '')
}

export class EndpointWidget {
    constructor(endpoint, row, nodeRect) {
        this.endpoint = endpoint
        this.row = {...row}
        this.nodeRect = nodeRect
        this.side = endpoint.role === 'server' ? 'left' : 'right'
    }

    center() {
        return {
            x: this.side === 'left' ? this.nodeRect.x : this.nodeRect.x + this.nodeRect.w,
            y: this.row.y + this.row.h / 2,
        }
    }

    hit(point) {
        return this.hitConnector(point) || this.hitRow(point)
    }

    hitConnector(point) {
        const center = this.center()
        return Math.hypot(point.x - center.x, point.y - center.y) <= systemStyle.endpoint.hitRadius
    }

    hitRow(point) {
        return inside(point, this.row)
    }

    render(ctx) {
        const style = systemStyle.endpoint
        const center = this.center()
        const protocol = protocolLabel(this.endpoint.protocol)
        const name = this.endpoint.name || protocol

        ctx.fillStyle = endpointColors[this.endpoint.role] ?? style.detailText
        ctx.beginPath()
        ctx.arc(center.x, center.y, style.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = style.border
        ctx.lineWidth = style.borderWidth
        ctx.stroke()

        const left = this.side === 'left'
        ctx.textBaseline = style.textBaseline
        ctx.textAlign = left ? style.leftTextAlign : style.rightTextAlign
        ctx.fillStyle = style.text
        ctx.font = style.textFont
        ctx.fillText(name, left ? this.row.x + style.horizontalPadding : this.row.x + this.row.w - style.horizontalPadding, this.row.y + style.nameOffsetY)

        const detail = protocol
        if (detail) {
            ctx.fillStyle = style.detailText
            ctx.font = style.detailFont
            ctx.fillText(detail, left ? this.row.x + style.horizontalPadding : this.row.x + this.row.w - style.horizontalPadding, this.row.y + style.detailOffsetY)
        }
    }
}
