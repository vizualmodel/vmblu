import {inside, roundedRect, topRoundedRect} from '../drawing.js'
import {systemStyle} from '../system-style.js'
import {EndpointWidget} from './endpoint-widget.js'
import {ReferenceWidget} from './reference-widget.js'

function nodeReferences(node) {
    return node.references ?? []
}

export class ApplicationWidget {
    constructor(node) {
        this.node = node
        this.selected = false
        this.references = []
        this.endpoints = []
        this.layout()
    }

    layout() {
        const style = systemStyle.application
        const referenceStyle = systemStyle.reference
        const width = this.node.size?.width ?? style.width
        const endpointCount = this.node.endpoints?.length ?? 0
        const calculatedHeight = style.headerHeight + style.referenceRowHeight + endpointCount * style.endpointRowHeight + style.bottomPadding
        const height = Math.max(this.node.size?.height ?? 0, calculatedHeight)
        this.rect = {x: this.node.position.x, y: this.node.position.y, w: width, h: height}
        this.headerRect = {x: this.rect.x, y: this.rect.y, w: width, h: style.headerHeight}
        this.settingsRect = {
            x: this.headerRect.x + style.settingsLeftPadding,
            y: this.headerRect.y + (style.headerHeight - style.settingsSize) / 2,
            w: style.settingsSize,
            h: style.settingsSize,
        }
        this.addEndpointRect = {
            x: this.headerRect.x + this.headerRect.w - style.addEndpointRightPadding - style.addEndpointSize,
            y: this.headerRect.y + (style.headerHeight - style.addEndpointSize) / 2,
            w: style.addEndpointSize,
            h: style.addEndpointSize,
        }
        this.actionRect = {x: this.rect.x, y: this.rect.y + style.headerHeight, w: width, h: style.referenceRowHeight}

        this.references = nodeReferences(this.node).map((reference, index) => new ReferenceWidget(reference, {
            x: this.rect.x + referenceStyle.leftPadding + index * (referenceStyle.size + referenceStyle.gap),
            y: this.actionRect.y + (style.referenceRowHeight - referenceStyle.size) / 2,
            w: referenceStyle.size,
            h: referenceStyle.size,
        }))

        this.endpoints = (this.node.endpoints ?? []).map((endpoint, index) => new EndpointWidget(endpoint, {
            x: this.rect.x,
            y: this.actionRect.y + style.referenceRowHeight + index * style.endpointRowHeight,
            w: width,
            h: style.endpointRowHeight,
        }, this.rect))
    }

    setPosition(position) {
        this.node.position = {x: position.x, y: position.y}
        this.layout()
    }

    hit(point) {
        return inside(point, this.rect)
    }

    hitHeader(point) {
        return inside(point, this.headerRect)
    }

    hitSettings(point) {
        return inside(point, this.settingsRect)
    }

    hitAddEndpoint(point) {
        return inside(point, this.addEndpointRect)
    }

    referenceAt(point) {
        return this.references.find(reference => reference.hit(point)) ?? null
    }

    endpoint(id) {
        return this.endpoints.find(endpoint => endpoint.endpoint.id === id) ?? null
    }

    endpointAt(point) {
        return this.endpoints.find(endpoint => endpoint.hit(point)) ?? null
    }

    defaultConnectionPoint(side) {
        return {
            x: side === 'left' ? this.rect.x : this.rect.x + this.rect.w,
            y: this.rect.y + this.rect.h / 2,
        }
    }

    render(ctx) {
        const style = systemStyle.application
        const nodeColor = this.node.vmblu ? style.nodeColor : style.externalNodeColor
        roundedRect(ctx, this.rect, style.cornerRadius)
        ctx.fillStyle = this.node.vmblu ? style.fill : style.externalFill
        ctx.fill()
        ctx.strokeStyle = this.selected ? style.selected : nodeColor
        ctx.lineWidth = this.selected ? style.selectedBorderWidth : style.borderWidth
        ctx.stroke()

        topRoundedRect(ctx, this.headerRect, style.cornerRadius)
        ctx.fillStyle = nodeColor
        ctx.fill()

        ctx.fillStyle = style.titleText
        ctx.font = style.titleFont
        ctx.textAlign = style.titleTextAlign
        ctx.textBaseline = style.titleTextBaseline
        ctx.fillText(this.node.name, this.headerRect.x + this.headerRect.w / 2, this.headerRect.y + this.headerRect.h / 2)

        ctx.fillStyle = style.settingsText
        ctx.font = style.settingsFont
        ctx.textAlign = style.settingsTextAlign
        ctx.textBaseline = style.settingsTextBaseline
        ctx.fillText(style.settingsGlyph, this.settingsRect.x + this.settingsRect.w / 2, this.settingsRect.y + this.settingsRect.h / 2 + style.settingsTextOffsetY)


        ctx.fillStyle = style.addEndpointText
        ctx.font = style.addEndpointFont
        ctx.textAlign = style.addEndpointTextAlign
        ctx.textBaseline = style.addEndpointTextBaseline
        ctx.fillText(
            style.addEndpointGlyph,
            this.addEndpointRect.x + this.addEndpointRect.w / 2,
            this.addEndpointRect.y + this.addEndpointRect.h / 2 + style.addEndpointTextOffsetY,
        )

        ctx.strokeStyle = nodeColor
        ctx.lineWidth = style.dividerWidth
        ctx.beginPath()
        ctx.moveTo(this.actionRect.x, this.actionRect.y + this.actionRect.h)
        ctx.lineTo(this.actionRect.x + this.actionRect.w, this.actionRect.y + this.actionRect.h)
        ctx.stroke()

        for (const reference of this.references) reference.render(ctx)
        for (const endpoint of this.endpoints) endpoint.render(ctx)
    }
}
