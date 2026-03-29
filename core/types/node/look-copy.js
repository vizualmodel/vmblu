import {convert} from '../util/index.js'
import {Widget} from '../widget/index.js'
import {Look} from './look.js'

export const copyHandling = {

    // copy the look of a node for another node. Note that the routes of pins/proxies are handled later.
    copy(newNode) {

        // ensure look.node is set for widgets created via this copy
        newNode.look.node = newNode

        // copy the look - set the height to 0
        // const newLook = new Look(this.rect)

        // copy the wid generator 
        newNode.look.widGenerator = this.widGenerator

        // copy all the widgets 
        this.widgets.forEach( w => {

            let nw = null

            if (w.is.pin) {
                nw = w.is.proxy ? new Widget.Proxy(w.rect, newNode, w.name, w.is) : new Widget.Pin(w.rect, newNode, w.name, w.is) 
                //nw.profile = w.profile
                nw.pxlen = w.pxlen
            }
            else if (w.is.ifName) {        
                nw = new Widget.InterfaceName(w.rect,w.text,newNode)      
            }            
            else if (w.is.header) {      
                nw = new Widget.Header(w.rect,newNode)        
            }            
            else if (w.is.icon) {       
                nw = new Widget.Icon(w.rect, w.type)   
                nw.setRender()    
            }            
            else if (w.is.box) {     
                nw = new Widget.Box(w.rect, newNode)      
            }            
            else if (w.is.label) {     
                nw = new Widget.Label(w.rect,w.text, newNode) 
            }

            // if the widget has a wid, copy that also
            if (w.wid) nw.wid = w.wid

            // add the widget to the new look
            if (nw) newNode.look.widgets.push(nw)
        })
    },    

    // copy the look from a source node to a group node look and vice versa
    // the routes are not copied
    copyConvert(newNode) {

        // ensure look.node is set for widgets created via this copy
        newNode.look.node = newNode

        // copy the wid generator 
        newNode.look.widGenerator = this.widGenerator

        // copy all the widgets 
        this.widgets.forEach( w => {

            // const nlw = newLook.widgets
            let nw = null

            if (w.is.pin) {
                // remark the *inversion* proxy -> pin !
                nw = w.is.proxy ? new Widget.Pin(w.rect, newNode, w.name, w.is) : new Widget.Proxy(w.rect, newNode, w.name, w.is) 
                //nw.profile = w.profile
                nw.pxlen = w.pxlen
            }
            else if (w.is.ifName) {
                nw = new Widget.InterfaceName(w.rect,w.text,newNode)
            }
            else if (w.is.header) {
                // copy the title
                nw = new Widget.Header(w.rect,newNode)
            }
            else if (w.is.icon) {

                // source nodes do not have a group icon and vice versa
                const icon = w.type == 'group' ? 'factory' : w.type == 'factory' ? 'group' : w.type;

                // add the icon
                newNode.look.addIcon(icon)
            }
            else if (w.is.box) {
                nw = new Widget.Box(w.rect, newNode)
            }
            else if (w.is.label) {
                // copy the label for the node
                nw = new Widget.Label(w.rect, w.text, newNode)
            }

            // if the widget has a wid, copy that also
            if (w.wid) nw.wid = w.wid

            // add the widget to the new look
            if (nw) newNode.look.widgets.push(nw)
        })
    },    

    // the look to copy from has the same widgets in the same order !
    copyPinPinRoutes(look) {

        const L = look.widgets.length
        let original = null
        let copy = null

        for (let i = 0; i<L; i++) {

            // get the corresponding widgets
            original = look.widgets[i]
            copy = this.widgets[i]

            // clone the routes for all inputs
            if (original.is.pin && original.is.input) {

                // check all the routes for the widgets -
                for(const route of original.routes) {

                    // only pin-pin routes - other routes are handled elsewhere
                    if (!route.to.is.pin || !route.from.is.pin) continue

                    // make a copy of the route
                    const newRoute = route.clone()

                    // change one of the widgets
                    newRoute.from == original ?  newRoute.from = copy : newRoute.to = copy

                    // save the route
                    copy.routes.push(newRoute)
                }
            }
        }
    },

    // the widgets in the routes - correct the second widget (from or to) in the route
    correctPinPinRoutes(root) {

        for(const widget of this.widgets) {

            // only if the widget is an input widget we have to correct the other widget
            if (!widget.is.input) continue

            // check all the routes
            for (const route of widget.routes)  {

                // get the other widget
                const other = route.from == widget ? route.to : route.from

                // we only correct pin pin routes here
                if (!other.is.pin) continue

                // the nodes still have the same uid !
                const node = root.nodes.find( node => node.uid == other.node.uid)

                // find the pin in the new node
                const pin = node.look.findPin(other.name, false)

                // change the pin in the route
                route.from == widget ? route.to = pin : route.from = pin

                // and save the route in the pin
                pin.routes.push(route)
            }
        }
    },
 
    // transfer all the routes from this node to the look (parameter) of the new node
    // both nodes have the same nr of widgets
    // typically we do this when a source node is changed in a group node
    transferRoutes(look) {

        // use a for loop - there are two arrays to index
        for (let i = 0; i < look.widgets.length; i++) {

            // get the corresponding widgets
            const original = this.widgets[i]
            const copy = look.widgets[i]

            // clone the routes for all inputs
            if (original.routes?.length > 0) {

                // check all the routes for the widgets -
                for (const route of original.routes) {

                    // change the end or starting point from the route
                    if (route.from == original) route.from = copy
                    if (route.to == original) route.to = copy

                    copy.routes.push(route)
                }
            }
        }
    },


}
