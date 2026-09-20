// ------------------------------------------------------------------
// Model: sysblu
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.3","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.3"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:364e006568ec3f02"}}
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
	uid: "ZJGV",
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
		"project references -> ()",
		"sysmod.doit -> sysmod.doit @ sysblu manager (SfVo)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (SfVo)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (SfVo)",
		"open reference -> ()",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "SfVo",
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
		"system.updated -> system.updated @ sysblu view (ZJGV)",
		"sysmod.done -> sysmod.done @ sysblu view (ZJGV)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.3","schemaVersion":"1.12.3"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
