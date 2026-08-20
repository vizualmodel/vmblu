/**
 * @node model pane
 */
export function ModelPane(tx, sx) {
    const root = document.createElement('section')
    root.className = 'vmblu-model-pane'
    root.style.position = 'relative'
    root.style.width = '100%'
    root.style.height = '100%'
    root.style.overflow = 'hidden'

    let canvas = null
    let menu = null
    let legend = null

    function replacePart(current, next, atStart = false) {
        if (current && current !== next) current.remove()
        if (!next) return null
        atStart ? root.prepend(next) : root.append(next)
        return next
    }

    return {
        onCanvas(nextCanvas) {
            canvas = replacePart(canvas, nextCanvas, true)
            tx.send('content div', root)
        },

        onMenuDiv(nextMenu) {
            menu = replacePart(menu, nextMenu)
        },

        onLegendDiv(nextLegend) {
            legend = replacePart(legend, nextLegend)
        }
    }
}
