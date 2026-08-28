// ------------------------------------------------------------------
// Model: sysblu
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.11","schemaVersion":"1.11.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.11.0"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:2da472c875bd4286"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-base"


//Imports
import { SysbluView } from '../nodes/sysblu-view/sysblu-view.js'
import { SysbluManager } from '../nodes/sysblu-manager/sysblu-manager.js'



//The runtime nodes
const nodeList = [
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "zxuM",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> ()",
		"application settings -> ()",
		"endpoint settings -> ()",
		"connection settings -> ()",
		"sysmod.doit -> sysmod.doit @ sysblu manager (ZtCA)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (ZtCA)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (ZtCA)",
		"open reference -> ()",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "ZtCA",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> ()",
		"sysblu.failed -> ()",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (zxuM)",
		"sysmod.done -> sysmod.done @ sysblu view (zxuM)"
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
