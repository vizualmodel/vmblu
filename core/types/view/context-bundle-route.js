
export const bundleRouteCxMenu = {
    choices: [],
    prepare(view, tx) {
        const route = view.hit.route
        const routes = route.bundleRoutes()
        const editable = !view.root.cannotBeModified?.()
        const deleteBundleRoutes = routes => view.doEdit(tx, 'deleteBundleRoute', {routes})
        this.choices = [
            {text: 'Inspect member connections', icon: 'info', state: 'enabled', action: () => tx.send('info popup', {title: 'Member connections', message: route.bundleRouteDetails(), duration: 7000})},
            {text: `Delete all ${routes.length} represented connections`, icon: 'delete', state: editable ? 'enabled' : 'disabled', action: () => deleteBundleRoutes(routes)},
            ...routes.map(member => ({text: `Delete ${member.from.name} → ${member.to.name}`, icon: 'delete', state: editable ? 'enabled' : 'disabled', action: () => deleteBundleRoutes([member])})),
        ]
    },
}
