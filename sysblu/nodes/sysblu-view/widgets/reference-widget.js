import {inside, roundedRect} from '../drawing.js'
import {systemStyle} from '../system-style.js'

const labels = {
    documentation: 'DOC',
    model: 'APP',
    source: 'SRC',
    build: 'BLD',
    deployment: 'DEP',
    test: 'TST',
    operations: 'OPS',
    other: 'REF',
}

export class ReferenceWidget {
    constructor(reference, rect) {
        this.reference = reference
        this.rect = {...rect}
        this.label = labels[reference.kind] ?? labels.other
    }

    hit(point) {
        return inside(point, this.rect)
    }

    tooltip() {
        const label = this.reference.label || this.reference.description || this.reference.target || this.reference.kind
        return this.hasCommand() ? `${label} — Ctrl/Cmd+click: ${this.reference.command}` : label
    }

    hasCommand() {
        return Boolean(this.reference.command && this.reference.workingDirectory)
    }

    render(ctx) {
        const style = systemStyle.reference
        roundedRect(ctx, this.rect, style.cornerRadius)
        ctx.fillStyle = style.fill
        ctx.fill()
        ctx.strokeStyle = style.border
        ctx.lineWidth = style.borderWidth
        ctx.stroke()
        ctx.fillStyle = style.text
        ctx.font = style.font
        ctx.textAlign = style.textAlign
        ctx.textBaseline = style.textBaseline
        ctx.fillText(this.label, this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2 + style.textOffsetY)

        if (this.hasCommand()) {
            ctx.fillStyle = style.commandMarker
            ctx.beginPath()
            ctx.arc(
                this.rect.x + this.rect.w / 2,
                this.rect.y + this.rect.h - style.commandMarkerBottomPadding - style.commandMarkerRadius,
                style.commandMarkerRadius,
                0,
                Math.PI * 2,
            )
            ctx.fill()
        }
    }
}
