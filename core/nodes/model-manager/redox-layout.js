import {applyLayoutPatch, captureAutoLayoutState, layoutElk, normalizeLayoutRoutes, rerouteLayoutBoundaryRoutes, restoreAutoLayoutState} from '../../types/elk/index.js'

export const redoxLayout = {

autoLayout: {

    async doit({root = null} = {}) {
        root ??= this.manager?.model?.root
        if (!root) return

        const before = captureAutoLayoutState(root)
        const routes = normalizeLayoutRoutes(root)

        const result = await layoutElk(root)

        if (!result.ok) {
            restoreAutoLayoutState(root, before)
            this.manager?.tx?.send?.('info popup', {
                title: 'Auto Layout',
                message: result.error,
                duration: 3000
            })
            console.warn('Auto Layout failed', result.diagnostics)
            return
        }

        applyLayoutPatch(result.patch)
        rerouteLayoutBoundaryRoutes(root, routes, result.patch)
        root.rxtxBuildTxTable?.()
        const after = captureAutoLayoutState(root)

        this.saveEdit('autoLayout', {root, before, after, diagnostics: result.diagnostics})
    },

    undo({root, before}) {
        restoreAutoLayoutState(root ?? this.manager?.model?.root, before)
    },

    redo({root, after}) {
        restoreAutoLayoutState(root ?? this.manager?.model?.root, after)
    }
}

}
