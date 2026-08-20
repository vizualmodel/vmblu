// ------------------------------------------------------------------
// Model: node-editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.10","schemaVersion":"1.10.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.10.0"},"source":{"model":"core.mod.blu","hash":"fnv1a64:ee07170061faba69"}}
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
	uid: "xcQx",
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
	uid: "xqNj",
	factory: DocumentManager,
	inputs: [
		"-> doc.selected",
		"-> doc.new",
		"-> doc.renamed",
		"-> doc.deleted",
		"-> doc.get",
		"-> doc.open",
		"-> file.save active",
		"-> file.save as",
		"-> model.loaded",
		"-> text.loaded",
		"-> model.failed",
		"-> text.failed",
		"-> tab.request to close",
		"-> tab.request to select"
		],
	outputs: [
		"doc.set active -> ()",
		"file.save -> ()",
		"file.save as filename -> ()",
		"file.save all -> ()",
		"file.loading -> ()",
		"file.loaded -> ()",
		"file.failed -> ()",
		"tab.select -> ()",
		"tab.remove -> ()",
		"tab.new -> ()",
		"tab.rename -> ()",
		"text.set active -> ()",
		"text.save -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "fVcI",
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
	uid: "IRIj",
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> ()",
		"remove file -> remove file @ library manager (XPYP)",
		"add file -> add file @ library manager (XPYP)",
		"get path -> path @ path request (mfnX)",
		"modal div -> ()"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager",
	uid: "XPYP",
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (IRIj)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "mfnX",
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
	uid: "KrPL",
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
	uid: "nOun",
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
    vmblu: {"compatibilityFamily":"1.10","generatorVersion":"1.10.0","schemaVersion":"1.10.0"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
