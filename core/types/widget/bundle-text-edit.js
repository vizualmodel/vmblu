import {bundleRect} from './pin-bundle.js'
import {style, shape} from '../util/index.js'

// This adapter belongs only to the active text-edit session, never the model.
export function beginBundleTextEdit(view, pin, click, clear, commit) {
    const session = {
        text: pin.bundle.map(member => member.displayName(false)).join(', '),
        startEdit(ctx, point) {
            pin.bundleEdit = this
            const rect = bundleRect(pin)
            const x = pin.is.left ? rect.x + style.pin.wMargin
                : rect.x + rect.w - style.pin.wMargin - ctx.measureText(this.text).width
            return {prop: 'text', index: point ? shape.cursorIndex(ctx, this.text, x, point.x) : this.text.length}
        },
        cursorPos(ctx, index) {
            const rect = bundleRect(pin)
            const x = pin.is.left ? rect.x + style.pin.wMargin
                : rect.x + rect.w - style.pin.wMargin - ctx.measureText(this.text).width
            return {x: x + ctx.measureText(this.text.slice(0, index)).width, y: rect.y}
        },
        endEdit(saved) {
            const text = this.text
            delete pin.bundleEdit
            // Release the buffer even though TextEdit retains its last target.
            this.text = ''
            view.textField.saved = null
            if (text !== saved) commit(text)
        },
    }
    view.beginTextEdit(session, click, clear)
}
