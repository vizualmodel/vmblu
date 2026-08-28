// ------------------------------------------------------------------
// Model: node-editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.11","schemaVersion":"1.11.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.11.0"},"source":{"model":"core.mod.blu","hash":"fnv1a64:3be5ad0daea27a50"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-base"


//Imports
import { LibraryManager } from '../nodes/library-manager/library-manager.js'
import { DocumentManager } from '../nodes/document-manager/document-manager.js'
import { Clipboard } from '../nodes/clipboard/clipboard.js'
import { NodeSelectorFactory,
		 PathRequestFactory } from '../../ui-svelte/index.js'
import { ViewManager } from '../nodes/view-manager/view-manager.js'
import { ModelManager } from '../nodes/model-manager/model-manager.js'



//The runtime nodes
const nodeList = [
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager",
	uid: "spwG",
	factory: LibraryManager,
	inputs: [
		"-> add file",
		"-> remove file",
		"-> switch library"
		],
	outputs: [
		"build table -> ()"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager",
	uid: "FNfj",
	factory: DocumentManager,
	inputs: [
		"-> file.selected",
		"-> file.new",
		"-> file.renamed",
		"-> file.deleted",
		"-> file.get",
		"-> file.open",
		"-> file.save active",
		"-> file.save as",
		"-> model.loaded",
		"-> model.failed",
		"-> tab.request to close",
		"-> tab.request to select",
		"-> text.loaded",
		"-> text.failed",
		"-> sysblu.loaded",
		"-> sysblu.failed"
		],
	outputs: [
		"file.save as filename -> ()",
		"file.save all -> ()",
		"file.loading -> ()",
		"file.loaded -> ()",
		"file.failed -> ()",
		"model.set active -> ()",
		"model.save -> ()",
		"tab.select -> ()",
		"tab.remove -> ()",
		"tab.new -> ()",
		"tab.rename -> ()",
		"text.set active -> ()",
		"text.save -> ()",
		"sysblu.set active -> ()",
		"sysblu.save -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "TdrT",
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"-> set",
		"=> get"
		],
	outputs: [
		"switch -> ()",
		"remote => ()"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector",
	uid: "nmuc",
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> ()",
		"remove file -> remove file @ library manager (JIBB)",
		"add file -> add file @ library manager (JIBB)",
		"get path -> path @ path request (XCja)",
		"modal div -> ()"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager",
	uid: "JIBB",
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (nmuc)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "XCja",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => ()",
		"modal div -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "TZwd",
	factory: ViewManager,
	inputs: [
		"-> size change",
		"-> top level view",
		"-> root",
		"-> recalibrate",
		"-> grid on-off",
		"-> application prompt",
		"-> redox.done"
		],
	outputs: [
		"canvas -> ()",
		"team legend -> ()",
		"clipboard.get => ()",
		"clipboard.set -> ()",
		"name and path -> ()",
		"context menu -> ()",
		"node prompt -> ()",
		"runtime settings (dx) -> ()",
		"node settings (sx) -> ()",
		"open source file -> ()",
		"open model -> ()",
		"redox.doit -> ()",
		"redox.undo -> ()",
		"redox.redo -> ()"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "acPU",
	factory: ModelManager,
	inputs: [
		"-> accept changes",
		"-> wire check",
		"-> auto layout",
		"-> sync model",
		"-> sync links",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> model.set",
		"-> model.save",
		"-> save point.set",
		"-> save point.back",
		"-> redox.doit",
		"-> redox.undo",
		"-> redox.redo"
		],
	outputs: [
		"model.header -> ()",
		"model.root -> ()",
		"model.loaded -> ()",
		"model.failed -> ()",
		"save point.confirm -> ()",
		"pin profile -> ()",
		"tool settings -> ()",
		"event settings -> ()",
		"get path -> ()",
		"info popup -> ()",
		"redox.done -> ()",
		"open source file -> ()",
		"open model -> ()"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.11","generatorVersion":"1.11.0","schemaVersion":"1.11.0"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
