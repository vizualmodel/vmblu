import {Path} from '../arl/index.js'
import {convert} from '../util/index.js'

// we have to expand multi sources into single names, eg AA.[x,y] => AA.x, AA.y
// for each variant 
function ActualSource(name, pin) {
    this.variant = name,
    this.pin = pin
    this.actualTargets = []
}
ActualSource.prototype = {
}

// This object is used to split multi-messages in a single targets
function ActualTarget(name, target) {

    this.variant = name
    this.target = target
}
ActualTarget.prototype = {

    toString() {
        if (this.target.is.pin) {
            return `${this.variant} @ ${this.target.node.name} (${this.target.node.uid})` 
        }
        else if (this.target.is.pad) {
            return `${this.variant} @ ${this.target.proxy.node.name} (${this.target.proxy.node.uid})` 
        }
        else if (this.target.is.tack) {
            return `${this.variant} @ ${this.target.bus.name} (${this.target.bus.uid})`
        }
        return '- unknown -'
    }
}

export const JSAppHandling = {

    toJavascriptApp(appPath) {

        // check if we have a path name
        if (!appPath) return 

        // save the app path in the document
        if (this.target.application?.userPath !== appPath) {

            // make the app arl
            this.target.application = this.resolve(appPath)
        }

        // notation
        const srcArl = this.target.application
    
        // the index file to find sources that do not have an explicit factory arl
        const indexArl = this.resolve('index.js')
    
        // the runtime to use for this model
        const runtime = this.model.header.runtime ?? '@vizualmodel/vmblu'
    
        // and save the app 
        const jsSource = this.makeJSApp(this.view.root, srcArl, indexArl, runtime)

        // and save the source
        srcArl.save(jsSource)

        // check if there are mcp compliant tools...
        const mcpToolString = this.model.makeMcpToolString(this.view.root)

        // save the tools
        if (mcpToolString) {

            // get the arl for the mcp spec
            const mcpArl = srcArl.resolve(Path.removeExt(this.model.arl.userPath) + '-mcp.js')

            // save the mcp file
            mcpArl.save(mcpToolString)
        }
    
        // return the src arl and the html arl so that the app can be started (if wanted)
        const htmlArl = this.resolve(Path.changeExt(appPath,'html'))
        // modcom.saveHtmlPage(doc.root, srcArl, htmlArl)
    
        // return the src and html arl
        return {srcArl, htmlArl}
    },

    makeJSApp(node, srcArl, indexArl, runtime) {

        // assemble the nodes and files needed into the imports array..[{arl, items: [] }]
        const imports = []

        // put the index file as the first on the imports
        imports.push({arl:indexArl, items:[]})

        // the files and nodes used in this model
        node.collectImports(imports)

        // The header
        const today = new Date()
        let sHeader =      '// ------------------------------------------------------------------'
                        +`\n// Model: ${node.name}`
                        +`\n// Path: ${srcArl.url?.pathname || srcArl.userPath}`
                        +`\n// Creation date ${today.toLocaleString()}`
                        +'\n// ------------------------------------------------------------------\n'

        // set the imported source/libs
        let sImports = '\n//Imports' + this.JSImportExportString(imports,'\nimport ', srcArl)

        // make the list of source nodes and filters - a recursive function
        const nodeList = []
        const filterList = []
        node.makeSourceLists(nodeList, filterList)

        // an array of nodes
        let sNodeList = '//The runtime nodes\nconst nodeList = ['

        // make the init code for the run time nodes & filters
        for(const item of nodeList) sNodeList += this.JSSourceNode(item)

        // close the nodeList
        sNodeList += '\n]'

        // the filter list
        let sFilterList = '//The filters\nconst filterList = ['

        // stringify the filters
        for(const item of filterList) sFilterList += this.JSFilter(item)

        // close
        sFilterList += '\n]'

        // combine all..
        const jsSource = 
`
// import the runtime code
import * as VMBLU from "${runtime}"

${sImports}

${sNodeList}

${sFilterList}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList)

// and start the app
runtime.start()
`
        return sHeader + jsSource
    },

    // make a string with all imported or exported object factories - line prefix = 'import' or 'export'
    // the imports are made relative to a refpath
    JSImportExportString(imports, linePrefix, refArl) {

        // import all source types & looks that are not part of the libraries
        let importString = ''

        // the string after each import
        const after = ',\n\t\t '

        // add each imported file
        imports.forEach( imported => {

            // if there are no items skip
            if (imported.items.length < 1) return

            // add a line for every file from which we import
            importString += linePrefix + `{ `

            // if there are items
            if (imported.items.length > 0) {
                
                // list of comma seperated imported items
                imported.items.forEach( item => { importString += item + after })

                // remove the last after
                importString = importString.slice(0,-after.length)
            }

            // add the closing curly bracket - resolve the path with respect to the ref arl path
            importString += ` } from '${Path.relative(imported.arl.getFullPath(), refArl.getFullPath())}'`
        })

        // done
        return importString
    },

    // make a string with all the run time nodes
    JSSourceNode(node) {

        // helper function to print a pin-string
        const pinString = (pin) => {
            const prefix = '\n\t\t'
            const symbol = pin.is.input ? (pin.is.channel ? "=>" : "->") : (pin.is.channel ? "<=" : "<-")
            if (pin.is.multi) {
                let str = ''
                for(const variant of pin.expandMultis()) str += prefix + `"${symbol} ${variant}",`;
                return str
            }
            else return prefix + `"${symbol} ${pin.name}",`;           
        }

        // helper function to print a json string
        const readableJson = (obj,what) => {
            const json =  JSON.stringify(obj,null,4)
            return (json?.length > 0) ? ',\n\t' + what + ':\t' + json.replaceAll('\n','\n\t\t') : ''
        }

        const underscores = '\n\t//____________________________________________________________'

        // a separator between the nodes
        const separator = underscores.slice(0, -node.name.length) + node.name.toUpperCase()

        // every node has name, uid and code - use the alias if present
        let sSource = `${separator}\n\t{\n\tname: "${node.name}", \n\tuid: "${node.uid}", \n\tfactory: ${node.factory.alias ?? node.factory.fName},`

        // Add the list of input pins
        sSource += '\n\tinputs: ['

        // to assemble the inputs
        let sInputs = ''

        // add all inputs
        for(const rx of node.rxTable) sInputs += pinString(rx.pin)

        // remove the last comma
        if (sInputs.length > 0) sInputs = sInputs.slice(0, -1)

        // add the inputs
        sSource += sInputs.length > 0 ? sInputs + '\n\t\t],' : '],'

        // now handle the output pins
        sSource += '\n\toutputs: ['

        // string for the outputs
        let sOutputs = ''

        // add all the targets for each output of the node
        for(const tx of node.txTable) {

            // make the actual output table for each output - it expands the multi-messages
            const outputTable = this.makeOutputTable(tx)

            // then stringify the output table
            sOutputs += this.stringifyOutputTable(outputTable)
        }

        // remove the last comma
        if (sOutputs.length > 0) sOutputs = sOutputs.slice(0,-1)

        // Add the outputs to the source string
        sSource += sOutputs.length > 0 ? sOutputs + "\n\t\t]" : ']'

        // if there are settings, add the settings to the node
        if (node.sx) sSource += readableJson(node.sx, 'sx')
        if (node.dx) sSource += readableJson(node.dx, 'dx')

        // close and return
        return sSource + '\n\t},'
    },

    makeOutputTable(tx) {

        // The expanded tx table or output table
        const outputTable = []

        // create an array with all possible source names
        const sourceNames = tx.pin.is.multi ? convert.expandMultis(tx.pin.name) : [tx.pin.name]

        // get for each single source the corresponding targets
        for (const sourceName of sourceNames) {

            // We store the result in an ActualSource record
            const actualSource = new ActualSource(sourceName, tx.pin)

            // for each target 
            for (const target of tx.targets){

                // get the actual target for this source variant
                const actualTarget = this.getActualTarget(tx.pin, sourceName, target)

                // The actual target for a given source variant can be null
                if (actualTarget) actualSource.actualTargets.push(actualTarget)
            }

            // add it to the output table if there is anything in the target table
            outputTable.push(actualSource)
        }

        return outputTable
    },

    stringifyOutputTable(table) {

        // The stringified output table
        let sTable = ''

        for(const actualSource of table) {

            // the prefix for each line
            const prefix = '\n\t\t'

            // the message sending symbol
            const symbol = actualSource.pin.is.channel ? '=>' : '->'

            // no destinations (actually an error....)
            if (actualSource.actualTargets.length == 0) sTable += prefix + `"${actualSource.variant} ${symbol} ()",`;

            // if the dest array has only one element
            else if (actualSource.actualTargets.length == 1) sTable +=  prefix + `"${actualSource.variant} ${symbol} ${actualSource.actualTargets[0].toString()}",` ;

            // multiple destinations - make an array
            else {
                let sTargets = prefix + `\`${actualSource.variant} ${symbol} [ `

                // add all destinations
                for (const actualTarget of actualSource.actualTargets) sTargets += prefix + '\t' + `"${actualTarget.toString()}",` 

                //remove the last comma and close the bracket
                sTargets = sTargets.slice(0, -1) + ' ]`,'

                // add to the string
                sTable += sTargets
            }
        }

        return sTable
    },

    // make a string with all the run time nodes
    JSFilter(bus) {

        const underscores = '\n\t//_____________________________________________________'

        // a separator between the nodes
        const separator = underscores.slice(0, -bus.name.length) + bus.name.toUpperCase() + ' FILTER'

        // every node has name, uid and code - use the alias if present
        let sSource = `${separator}\n\t{\n\tname: "${bus.name}", \n\tuid: "${bus.uid}", \n\tfilter: ${bus.filter.alias ?? bus.filter.fName},`

        sSource += '\n\ttable: ['

        // make the filtertable
        const filterTable = this.makeFilterTable(bus)

        // print it
        const wSpace = '\n\t\t'
        for(const actualSource of filterTable) {
            sSource += '\n\t\t`' + actualSource.variant + ' : ['

            // write the rest to scope
            let sScope = ''
            for (const target of actualSource.actualTargets) sScope += wSpace + '\t"' + target.toString() + '",'

            // remove last comma
            sSource += sScope.slice(0,-1) + ' ]`,' 
        }

        // close and return
        return sSource + ']\n\t},'
    },

    // make the filter table
    makeFilterTable(bus) {

        const filterTable = []

        // first make the tack/tack connection table
        for(const rx of bus.rxTable) {

            // get the pin
            const pin = rx.tack.getOtherPin()

            // for each actual source
            const rxNames = pin.is.multi ? convert.expandMultis(pin.name) : [pin.name]

            // for each name
            for (const rxName of rxNames) {

                // maybe we have an entry for the rx name already - if so we do not have to handle it again (gives same result !)
                if (filterTable.find( actualSource => actualSource.variant == rxName)) continue

                // get a new source entry
                const actualSource = new ActualSource(rxName, null)

                // get the tx tacks that are connected to this tack
                for(const tx of bus.txTable) {

                    // check for a match between rx and tx 
                    if (!tx.connectsTo(rxName)) continue

                    // go through every message in the fanout
                    for (const target of tx.fanout) {

                        // get the actual target for this source variant
                        const actualTarget = this.getActualTarget(pin, rxName, target)

                        // The actual target for a given source variant can be null
                        if (actualTarget) actualSource.actualTargets.push(actualTarget)                        
                    }
                }

                // add it to the filtertable
                if (actualSource.actualTargets.length > 0) filterTable.push(actualSource)
            }
        }
        // done
        return filterTable
    },

    // make a table with the actual targets for this source message
    // If the target is a multi-message we have to decide which one is the actual target
    getActualTarget(source, sourceName, target) {

        if (target.is.pin) {

            if (target.is.multi) {

                // get the target variant that corresponds with the source name
                const targetName = target.getMatch(sourceName)

                // check
                return targetName ? new ActualTarget(targetName, target) : null
            }
            else if (source.is.multi) {

                // get the source variant that corresponds with the target name
                const sourceVariant = source.getMatch(target.name)

                // check - it should be the same as the sourceName
                return (sourceVariant == sourceName) ? new ActualTarget(target.name, target) : null
            }
            else {
                // simple connection - names do not matter
                return new ActualTarget(target.name, target)
            }
        }
        else if (target.is.tack) {

            // get the corresponding pin or proxy
            const pin = target.getOtherPin()

            // check if multi
            if (pin.is.multi) {

                // check if there is a match with the source
                const targetName = pin.getMatch(sourceName)
                return targetName ? new ActualTarget(targetName, target) : null
            }
            else if (source.is.multi) {

                // get the source variant that corresponds with the target name
                const sourceVariant = source.getMatch(pin.name)

                // check - it should be the same as the sourceName
                return (sourceVariant == sourceName) ? new ActualTarget(pin.name, target) : null
            }
            else {
                // simple connection - names do not matter (or have been checked before eg on a cable bus)
                return new ActualTarget(pin.name, target)
            }
        }
    },

    // save the html page that can be loaded as an application
    saveHtmlPage(node, srcArl, htmlArl) {

        // set the app path
        const appPath = srcArl.url.pathname

        // we also make a css path
        const cssPath = Path.changeExt(appPath, 'css')

        // the page content
        const htmlPage = 

`<!doctype html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width'>
    <title>${node.name}</title>
    <link rel='icon' type='image/png' href='/page/shared/favicon.ico'>
    <link rel='stylesheet' href='${cssPath}'> 
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <script type='module' src='${appPath}'></script>
</head>
<body style="overflow:hidden;"></body>
</html>`

        // save the html page
        htmlArl.save(htmlPage)
    },

    // **************************** DOES NOT WORK !! cross scripting !!
    NOT_OK_makeAppScript(root, indexArl) {
        // assemble the nodes and files needed into the imports array..[{arl, items: [] }]
        let imports = []

        // put the index file as the first on the imports
        imports.push({arl:indexArl, items:[]})

        // the files and nodes used in this model
        root.collectImports(imports)

        // make the app launch page also
        return this.makeAppPage(root, imports)
    }
}