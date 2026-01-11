import {convert} from '../util/index.js'
import {Path} from '../arl/index.js'

export const LibHandling = {

    toJavascriptLib(libPath) {

        // check if we have a path name
        if (!libPath) return 

        const modelArl = this.getArl();
        
        // save the app path in the document
        if (this.target.library?.userPath !== libPath) {

            // make the app arl
            this.target.library = modelArl.resolve(libPath)
        }

        // notation
        const libArl = this.target.library

        // the index file to find sources that do not have an explicit factory arl
        const indexArl = modelArl.resolve('index.js')
        
        // save the build lib file
        const lib = this.makeJSLib(this.view.root, modelArl, libArl, indexArl)

        // save the lib
        libArl.save(lib)
    },

    // save the file that can be used to build the lib
    makeJSLib(node, modelArl, libArl, indexArl) {

        // assemble the nodes and files needed into the imports array..[{arl, items: [] }]
        let imports = []

        // put the index file as the first on the imports
        imports.push({arl:indexArl, items:[]})

        // the files and nodes used in this model
        node.collectImports(imports)

        // make a javascript compliant name
        const jsRootName = convert.nodeToFactory(Path.nameOnly(libArl.userPath))

        // The header
        const today = new Date()
        const sHeader =    '// ------------------------------------------------------------------'
                        +`\n// Lib: ${jsRootName}`
                        +`\n// Model File: ${modelArl.userPath}`
                        +`\n// Lib   File: ${libArl.userPath}`
                        +`\n// Creation date ${today.toLocaleString()}`
                        +'\n// ------------------------------------------------------------------'

        // export the imported source types & looks that are not part of the libraries
        const sImports = '\n\n//Export' + this.JSImportExportString(imports,'\nexport ', libArl) 

        // derive the name for finding the 
        const modelFile = './' + Path.fileName(modelArl.userPath)

        // import/export the model that was saved - MAIN PATH IS WRONG
        const sModel =   `\n\n// The model\nimport ${jsRootName} from '${modelFile}'`+`\nexport {${jsRootName}}`

        // combine all parts
        return sHeader + sImports + sModel
    },
}