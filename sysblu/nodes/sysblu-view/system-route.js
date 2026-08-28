import {pointSegmentDistance, roundedRect} from './drawing.js'
import {systemStyle} from './system-style.js'

export class SystemRoute {
    constructor(connection, widgets) {
        this.connection = connection
        this.widgets = widgets
        this.selected = false
        this.broken = false
        this.points = []
        this.layout()
    }

    endpoint(end, fallbackSide) {
        const widget = this.widgets.get(end?.node)
        if (!widget) return null
        const endpoint = widget.endpoint(end?.endpoint)
        return {
            point: endpoint?.center() ?? widget.defaultConnectionPoint(fallbackSide),
            side: endpoint?.side ?? fallbackSide,
            widget,
        }
    }

    layout() {
        const start = this.endpoint(this.connection.from, 'right')
        const end = this.endpoint(this.connection.to, 'left')
        this.broken = !start || !end
        if (this.broken) {
            this.points = []
            return
        }

        if (this.connection.route?.length) {
            this.points = [start.point, ...this.connection.route.map(point => ({...point})), end.point]
            return
        }

        const startDirection = start.side === 'left' ? -1 : 1
        const endDirection = end.side === 'left' ? -1 : 1
        const style = systemStyle.route
        const departure = {x: start.point.x + startDirection * style.endpointStub, y: start.point.y}
        const arrival = {x: end.point.x + endDirection * style.endpointStub, y: end.point.y}
        const startFacesAway = (end.point.x - start.point.x) * startDirection < 0
        const endFacesAway = (start.point.x - end.point.x) * endDirection < 0

        if (startFacesAway || endFacesAway) {
            const bypassY = Math.min(start.widget.rect.y, end.widget.rect.y) - style.bypassGap
            this.points = [
                start.point,
                departure,
                {x: departure.x, y: bypassY},
                {x: arrival.x, y: bypassY},
                arrival,
                end.point,
            ]
            return
        }

        const middle = (departure.x + arrival.x) / 2
        this.points = [
            start.point,
            departure,
            {x: middle, y: departure.y},
            {x: middle, y: arrival.y},
            arrival,
            end.point,
        ]
    }

    hit(point, tolerance = systemStyle.route.hitTolerance) {
        for (let index = 1; index < this.points.length; index += 1) {
            if (pointSegmentDistance(point, this.points[index - 1], this.points[index]) <= tolerance) return true
        }
        return false
    }

    labelRect(ctx) {
        const style = systemStyle.route
        const point = this.points[Math.floor(this.points.length / 2)]
        const width = ctx.measureText(this.connection.transport ?? '').width + style.labelPaddingX * 2
        return {
            x: point.x - width / 2,
            y: point.y - style.labelHeight / 2,
            w: width,
            h: style.labelHeight,
        }
    }

    render(ctx) {
        if (this.points.length < 2) return
        const style = systemStyle.route
        const color = this.broken ? style.broken : this.selected ? style.selected : style.normal
        ctx.strokeStyle = color
        ctx.lineWidth = this.selected ? style.selectedWidth : style.width
        ctx.setLineDash(this.broken ? style.brokenDash : [])
        ctx.beginPath()
        ctx.moveTo(this.points[0].x, this.points[0].y)
        for (const point of this.points.slice(1)) ctx.lineTo(point.x, point.y)
        ctx.stroke()
        ctx.setLineDash([])

        const text = this.connection.transport ?? ''
        ctx.font = style.labelFont
        const labelRect = this.labelRect(ctx)
        roundedRect(ctx, labelRect, style.labelCornerRadius)
        ctx.fillStyle = style.labelBackground
        ctx.fill()
        ctx.strokeStyle = style.labelBorder
        ctx.lineWidth = style.labelBorderWidth
        ctx.stroke()
        ctx.fillStyle = color
        ctx.textAlign = style.labelTextAlign
        ctx.textBaseline = style.labelTextBaseline
        ctx.fillText(text, labelRect.x + labelRect.w / 2, labelRect.y + labelRect.h / 2)
    }
}
