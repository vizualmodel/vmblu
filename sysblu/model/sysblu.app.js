// ------------------------------------------------------------------
// Model: sysblu
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.0"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:66610bf499e7af55"}}
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
	uid: "tLhG",
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
		"sysmod.doit -> sysmod.doit @ sysblu manager (tBvs)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (tBvs)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (tBvs)",
		"open reference -> ()",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "tBvs",
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
		"system.updated -> system.updated @ sysblu view (tLhG)",
		"sysmod.done -> sysmod.done @ sysblu view (tLhG)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.0","schemaVersion":"1.12.0"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
