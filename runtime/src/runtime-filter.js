import {runtime} from './scaffold.js'
import {rtFlags} from './runtime.js'
import {Target, convert, HIX_HANDLER, HIX_ROUTER, HIX_MASK} from './target.js'

function Scope(selector) {

    // The selector for this scope
    this.selector = selector

    // For a filter we save the targets in a map
    this.targets = new Map()
}

export function RuntimeFilter({name, uid, filter, table}) {

    // name an uid
    this.name = name
    this.uid = uid

	// the function to create a filter 
	this.filter = filter

    // the factory can be called with new if it is a function and if  the constructor does **not** point back to the function itself
    this.useNew = filter.prototype?.constructor === filter ? false : true

    // The routing table - for each incoming message there is a scope - the list of possible targets
    this.scopeTable = []

	// The instance of the filter
	this.cell = null

	// the message that was received
	this.msg = null

	// build the routing map for the filter
    this.buildScopeTable(table)
}
RuntimeFilter.prototype = {

    buildScopeTable(rawTable) {

        for (const routeString of rawTable) {

            // for every entry
			const rawRoute = convert.stringToScope(routeString)

            // and make the scope
            const scope = new Scope(rawRoute.selector)

            // for each raw target
            for (const rawTarget of rawRoute.scope) {

                // create a target object
                const target = new Target(rawTarget.uid, rawTarget.pinName)

                // add it to the scope
                //scope.targets.push(target)
                scope.targets.set(rawTarget.nodeName, target)
            }

            // save the scope - use the selector as the key
            this.scopeTable.push(scope)
        }
    },

    resolveUIDs(actors) {

        // for each entry in the map
        for (const scope of this.scopeTable) {

            // for each entry in the scope table
            for (const target of scope.targets.values()) {

                // find the target actor
                target.actor = actors.find(actor => actor.uid == target.uid) 

                // check - should not happen 
                if (!target.actor) return console.error(`** ERROR ** target node ${target.uid} in ${this.name} not found`)

                // For a node find the index of the handler 
                if (target.actor.factory) {

                    // find the index in the rx table (the table with the handlers)
                    target.actor.rxTable.find( (rx, index) => {
                        if (rx.pin != target.pin) return false
                        target.hix = HIX_HANDLER | index
                        target.channel = rx.channel
                        return true
                    })
                }
                else if (target.actor.filter) {

                    // find the index in the routing table 
                    target.actor.scopeTable.find( (scope, index) => {
                        if (scope.selector != target.pin) return false
                        target.hix = HIX_ROUTER | index
                        return true
                    })
                }
            }
        }
    },

    // create a cell for the node - pass a client runtime to that cell
    makeCell() {

        // create the cell
        this.cell = this.useNew ? new this.filter() : this.filter() 
    },

}
