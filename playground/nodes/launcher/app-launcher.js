// ------------------------------------------------------------------
// Source node: ApplicationLauncher
// Creation date 7/2/2023, 3:28:15 PM
// ------------------------------------------------------------------

//Constructor for application launcher
export function ApplicationLauncher(tx, sx) {

    // the windowproxy
    this.windowProxy = null

    // the launcher has an iframe to run an application is
    this.iframe = null

    // save the transmitter
    this.tx = tx
}
ApplicationLauncher.prototype = {

	// --- Output pins of the node

	sends: [
		'iframe'
	],

	// --- Input pins and handlers of the node

	"-> run application"({mode, js, html}) {

        // check
        if (!html.url) return

        if (mode == 'page') {

            // open a new tab in the browser
            this.windowProxy = window.open(html.url,'cell-runtime')

        }
        else if (mode == 'iframe') {

            // check that we have an iframe
            if ( ! this.iframe) this.iframe = document.createElement("iframe")

            // set the url of the iframe
            this.iframe.src = html.url

            // send the iframe
            this.tx.send("iframe", this.iframe)
        }
	},

    "-> size change"({id, rect}) {

        // check
        if (!this.iframe || !rect || rect.h < 0 || rect.w < 0) return

        // adapt
        this.iframe.height = rect.h
        this.iframe.width = rect.w
    },

    "-> show"(){}

} // application launcher.prototype


/*
// DOES NOT WORK - logical - prevents cross scripting attacks...
runFromScript() {
    
    if (!this.root || !this.model) return

    const myApp = this.model.makeAppScript(this.root)

    const parser = new DOMParser()

    const parsed = parser.parseFromString(myApp, "text/html")  
    
    const windowProxy = window.open('','cell-runtime')
    
    windowProxy.onload = (event) => console.log("page is fully loaded")

    const newDoc = windowProxy.document

    newDoc.replaceChild(newDoc.importNode(parsed.documentElement, true),newDoc.documentElement);
}
*/