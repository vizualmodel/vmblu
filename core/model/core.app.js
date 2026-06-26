// ------------------------------------------------------------------
// Model: node-editor
// Path: C:/dev/vmblu/core/model/core.app.js
// Creation date 6/19/2026, 9:45:03 AM
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
	uid: "rCaA", 
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
	uid: "sQaL", 
	factory: DocumentManager,
	inputs: [
		"-> doc.selected",
		"-> doc.new",
		"-> doc.renamed",
		"-> doc.deleted",
		"-> doc.get",
		"-> doc.open",
		"-> file.save as",
		"-> tab.request to close",
		"-> tab.request to select"
		],
	outputs: [
		"doc.set active -> ()",
		"file.save -> ()",
		"file.save as filename -> ()",
		"file.save all -> ()",
		"tab.select -> ()",
		"tab.remove -> ()",
		"tab.new -> ()",
		"tab.rename -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "qHzJ", 
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
	uid: "ugxM", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> ()",
		"remove file -> remove file @ library manager (YGzC)",
		"add file -> add file @ library manager (YGzC)",
		"get path -> path @ path request (vbZx)",
		"modal div -> ()"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "YGzC", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (ugxM)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "vbZx", 
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
	uid: "fHar", 
	factory: ViewManager,
	inputs: [
		"-> size change",
		"-> top level view",
		"-> root",
		"-> recalibrate",
		"-> grid on-off",
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
	uid: "rtVY", 
	factory: ModelManager,
	inputs: [
		"-> accept changes",
		"-> wire check",
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
		"model.resolved -> ()",
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
const runtimeOptions = {}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
