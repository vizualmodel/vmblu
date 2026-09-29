import {bundleEligibility, createBundle, expandBundle, matchBundleConnections} from '../../types/widget/pin-bundle.js'
import {Route} from '../../types/node/route.js'
import {projectBundleRouteWire} from '../../types/node/route-bundle.js'
import {bundleEditAction} from './bundle-edit.js'

function createBundleDrawnRoute(from, to, wire) {
    const route = new Route(from, null)
    from.routes.push(route)
    if (!route.connect(to)) {
        route.popFromRoute()
        return null
    }
    route.restoreBundleRouteWire(wire)
    return route
}

function reportBundleProblem(redox, message) {
    redox.manager?.tx?.send('info popup', {title: 'Pin bundle', message, duration: 5000})
}

function refreshBundleSelection(view, pin) {
    view?.selection?.reset()
    view?.selection?.switchToWidget(pin)
}

function restoreBundleSelection(view, snapshot, pin) {
    if (!view?.selection || !snapshot) return refreshBundleSelection(view, pin)
    view.selection.reset()
    Object.assign(view.selection, snapshot.shallowCopy())
    for (const node of view.selection.nodes) node.doSelect()
    for (const widget of view.selection.widgets) widget.doSelect()
}

export const redoxBundle = {
    editBundle: bundleEditAction,
    collapseBundle: {
        doit({view, pins}) {
            const error = bundleEligibility(pins)
            if (error) return reportBundleProblem(this, error)
            const selection = view?.selection?.shallowCopy()
            const bundle = createBundle(pins)
            refreshBundleSelection(view, bundle[0])
            this.saveEdit('collapseBundle', {view, bundle, selection})
        },
        undo({view, bundle, selection}) { expandBundle(bundle[0]); restoreBundleSelection(view, selection, bundle[0]) },
        redo({view, bundle}) { createBundle(bundle); refreshBundleSelection(view, bundle[0]) },
    },
    expandBundle: {
        doit({view, pin}) {
            const selection = view?.selection?.shallowCopy()
            const bundle = expandBundle(pin)
            if (!bundle) return
            refreshBundleSelection(view, bundle[0])
            this.saveEdit('expandBundle', {view, bundle, selection})
        },
        undo({view, bundle, selection}) { createBundle(bundle); restoreBundleSelection(view, selection, bundle[0]) },
        redo({view, bundle}) { expandBundle(bundle[0]); refreshBundleSelection(view, bundle[0]) },
    },
    connectBundle: {
        doit({view, from, to, drawnRoute}) {
            const match = matchBundleConnections(from, to)
            if (match.error) return reportBundleProblem(this, match.error)
            if (view.root.cannotBeModified?.()) return view.blinkToWarn?.(view.root)
            if (!view.root.nodes.includes(from.node) || !view.root.nodes.includes(to.node)) return
            const routes = []
            const wire = drawnRoute ? projectBundleRouteWire({from, to, wire: drawnRoute.wire}) : null
            try {
                for (const [a, b] of match.pairs) {
                    if (a.haveRoute(b)) continue
                    const route = wire ? createBundleDrawnRoute(a, b, wire) : view.root.createRoute(a, b)
                    if (!route) throw new Error(`Cannot connect ${a.name} to ${b.name}.`)
                    route.is.newConx = false
                    routes.push(route)
                }
            } catch (error) {
                for (const route of routes) route.disconnect()
                return reportBundleProblem(this, error.message)
            }
            if (routes.length) this.saveEdit('connectBundle', {routes})
            if (match.unmatched.length) reportBundleProblem(this, 'Unmatched: ' + match.unmatched.map(pin => pin.name).join(', '))
        },
        undo({routes}) { for (const route of routes) route.disconnect() },
        redo({routes}) { for (const route of routes) route.reconnect() },
    },
    deleteBundleRoute: {
        doit({routes}) {
            for (const route of routes) route.disconnect()
            this.saveEdit('deleteBundleRoute', {routes})
        },
        undo({routes}) { for (const route of routes) route.reconnect() },
        redo({routes}) { for (const route of routes) route.disconnect() },
    },
}
