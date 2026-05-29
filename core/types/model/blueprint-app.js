import {Path} from '../arl/index.js'

function ActualSource(name, pin) {
    this.variant = name,
    this.pin = pin
    this.actualTargets = []
}
ActualSource.prototype = {
}

// This object is used to format targets in output and filter tables.
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
            return `${this.variant} @ bus (${this.target.cable.uid})`
        }
        return '- unknown -'
    }
}

export const AppHandling = {

    makeAndSaveApp(appPath, node) {

        // check if we have a path name
        if (!appPath) return 

        // save the app path in the document
        const nextAppArl = this.getArl().resolve(appPath)
        if (!this.target.application || !this.target.application.equals(nextAppArl)) {

            // make the app arl
            this.target.application = nextAppArl
        }

        // notation
        const srcArl = this.target.application
    
        // the index file to find sources that do not have an explicit factory arl
        const indexArl = this.getArl().resolve('index.js')
    
        // the runtime to use for this model
        const runtime = this.header.runtime ?? '@vizualmodel/vmblu-runtime/rt-base'
    
        // and save the app 
        const jsSource = this.makeJSApp(node, srcArl, indexArl, runtime)

        // and save runtime sidecar files before saving the generated app that imports them
        this.makeAndSaveAgentRuntimeFiles(srcArl, node, runtime)

        // and save the source
        srcArl.save(jsSource).catch(error => console.error(`Failed to save ${srcArl.getPath()}:`, error))

        // return the src arl and the html arl so that the app can be started (if wanted)
        const htmlArl = this.getArl().resolve(Path.changeExt(appPath,'html'))
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
                        +`\n// Path: ${srcArl.getPath()}`
                        +`\n// Creation date ${today.toLocaleString()}`
                        +'\n// ------------------------------------------------------------------\n'

        // set the imported source/libs
        let sImports = '\n//Imports' + this.JSImportExportString(imports,'\nimport ', srcArl)

        // make the list of source nodes - a recursive function
        const nodeList = []
        node.makeSourceLists(nodeList)

        // an array of nodes
        let sNodeList = '//The runtime nodes\nconst nodeList = ['

        // make the init code for the runtime nodes
        for(const item of nodeList) sNodeList += this.JSSourceNode(item)

        // close the nodeList
        sNodeList += '\n]'

        const runtimeOptions = this.JSRuntimeOptions(runtime, node, srcArl)

        // combine all..
        const jsSource = 
`
// import the runtime code
import {Runtime} from "${runtime}"

${sImports}

${runtimeOptions.imports}

${sNodeList}

${runtimeOptions.options}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
`
        return sHeader + jsSource
    },

    makeAndSaveAgentRuntimeFiles(srcArl, node, runtime) {

        if (!this.isAgentRuntime(runtime)) return null

        const capArl = srcArl.resolve(this.agentRuntimeArtifactPath(srcArl, 'cap'))
        capArl.save(this.makeCapabilityString(node)).catch(error => console.error(`Failed to save ${capArl.getPath()}:`, error))

        const agent = this.header.agent
        if (agent && typeof agent === 'object' && !Array.isArray(agent) && !agent.path) {
            const agentArl = srcArl.resolve(this.agentRuntimeArtifactPath(srcArl, 'agent'))
            agentArl.save(JSON.stringify(agent, null, 2)).catch(error => console.error(`Failed to save ${agentArl.getPath()}:`, error))
        }

        return capArl
    },

    JSRuntimeOptions(runtime, node, srcArl) {

        const imports = []
        const optionLines = []

        const runtimeSettings = this.header.runtimeSettings
        const runtimeSettingsPath = this.runtimeSettingsImportPath(srcArl)
        if (runtimeSettingsPath) {
            imports.push(`import runtimeSettings from '${runtimeSettingsPath}' with { type: 'json' }`)
            optionLines.push('    runtimeSettings')
        }
        else if (runtimeSettings && typeof runtimeSettings === 'object' && !Array.isArray(runtimeSettings)) {
            optionLines.push(`    runtimeSettings: ${JSON.stringify(runtimeSettings, null, 4).replaceAll('\n', '\n    ')}`)
        }

        if (this.isAgentRuntime(runtime)) {
            const capPath = this.agentRuntimeArtifactPath(srcArl, 'cap')
            imports.push(`import capabilities from '${capPath}' with { type: 'json' }`)
            optionLines.push('    capabilities')

            const agentPath = this.agentRuntimeAgentImportPath(srcArl)
            if (agentPath) {
                imports.push(`import agent from '${agentPath}' with { type: 'json' }`)
                optionLines.push('    agent')
            }
        }

        const options = optionLines.length
            ? `const runtimeOptions = {\n${optionLines.join(',\n')}\n}`
            : 'const runtimeOptions = {}'

        return {
            imports: imports.length ? `// Runtime sidecars\n${imports.join('\n')}` : '',
            options: `// Runtime options\n${options}`
        }
    },

    isAgentRuntime(runtime) {
        return runtime === '@vizualmodel/vmblu-runtime/rt-agent'
            || runtime.endsWith('/rt-agent')
            || runtime === '@vizualmodel/vmblu-runtime/rt-browser-agent'
            || runtime.endsWith('/rt-browser-agent')
    },

    agentRuntimeAgentImportPath(srcArl) {

        const agent = this.header.agent
        if (!agent) return null

        if (typeof agent === 'string') return Path.relative(this.getArl().resolve(agent).getFullPath(), srcArl.getFullPath())

        if (typeof agent === 'object' && !Array.isArray(agent)) {
            if (agent.path) return Path.relative(this.getArl().resolve(agent.path).getFullPath(), srcArl.getFullPath())
            return this.agentRuntimeArtifactPath(srcArl, 'agent')
        }

        return null
    },

    runtimeSettingsImportPath(srcArl) {
        const settings = this.header.runtimeSettings
        if (!settings) return null

        if (typeof settings === 'string') return Path.relative(this.getArl().resolve(settings).getFullPath(), srcArl.getFullPath())

        if (typeof settings === 'object' && !Array.isArray(settings) && settings.path) {
            return Path.relative(this.getArl().resolve(settings.path).getFullPath(), srcArl.getFullPath())
        }

        return null
    },

    agentRuntimeArtifactPath(srcArl, kind) {

        const path = srcArl.getPath()
        const ext = `.${kind}.json`

        if (path.endsWith('.app.js')) return './' + Path.fileName(path.slice(0, -'.app.js'.length) + ext)
        return './' + Path.fileName(Path.changeExt(path, ext))
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
            return prefix + `"${symbol} ${pin.name}",`;           
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

            // make the actual output table for each output
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

        const actualSource = new ActualSource(tx.pin.name, tx.pin)

        // for each target 
        for (const target of tx.targets){

            const actualTarget = this.getActualTarget(target)

            if (actualTarget) actualSource.actualTargets.push(actualTarget)
        }

        outputTable.push(actualSource)

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

    // make a table with the actual targets for this source message
    getActualTarget(target) {

        if (target.is.pin) {
            return new ActualTarget(target.name, target)
        }
        else if (target.is.tack) {

            // get the corresponding pin or proxy
            const pin = target.getOtherPin()

            return new ActualTarget(pin.name, target)
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
        htmlArl.save(htmlPage).catch(error => console.error(`Failed to save ${htmlArl.getPath()}:`, error))
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
