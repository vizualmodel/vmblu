// ------------------------------------------------------------------
// Model: sysblu vscode editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.0"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:7859b9eb1b95ba7c"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-base"


//Imports
import { SystemMessageBroker } from '../system-message-broker.js'
import { SysbluView } from '../../../sysblu/nodes/sysblu-view/sysblu-view.js'
import { SysbluManager } from '../../../sysblu/nodes/sysblu-manager/sysblu-manager.js'
import { VscodeSideMenuFactory,
		 ApplicationInspectorFactory,
		 EndpointInspectorFactory,
		 ConnectionInspectorFactory } from '../../../ui-svelte/index.js'



//The runtime nodes
const nodeList = [
	//_______________________________________SYSTEM MESSAGE BROKER
	{
	name: "system message broker",
	uid: "KkUJ",
	factory: SystemMessageBroker,
	inputs: [
		"-> sysblu.loaded",
		"-> sysblu.failed",
		"-> sysblu.diagnostics",
		"-> system.updated",
		"-> canvas",
		"-> floating menu",
		"-> modal div",
		"-> save",
		"-> open reference",
		"-> execute command"
		],
	outputs: [
		"sysblu.set -> sysblu.set @ sysblu manager (UAmj)",
		"sysblu.save -> sysblu.save @ sysblu manager (UAmj)",
		"sysblu.undo -> sysmod.undo @ sysblu manager (UAmj)",
		"sysblu.redo -> sysmod.redo @ sysblu manager (UAmj)",
		"size change -> size change @ sysblu view (cfdd)"
		]
	},
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "cfdd",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ system message broker (KkUJ)",
		"application settings -> application settings @ application inspector (nFIn)",
		"endpoint settings -> endpoint settings @ endpoint inspector (CyxS)",
		"connection settings -> connection settings @ connection inspector (ytsa)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (UAmj)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (UAmj)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (UAmj)",
		"open reference -> open reference @ system message broker (KkUJ)",
		"execute command -> execute command @ system message broker (KkUJ)"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "UAmj",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ system message broker (KkUJ)",
		"sysblu.failed -> sysblu.failed @ system message broker (KkUJ)",
		"sysblu.diagnostics -> sysblu.diagnostics @ system message broker (KkUJ)",
		`system.updated -> [ 
			"system.updated @ sysblu view (cfdd)",
			"system.updated @ system message broker (KkUJ)" ]`,
		"sysmod.done -> sysmod.done @ sysblu view (cfdd)"
		]
	},
	//_________________________________________________SYSTEM MENU
	{
	name: "system menu",
	uid: "dDcl",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ system message broker (KkUJ)",
		"save -> save @ system message broker (KkUJ)",
		"application prompt -> application prompt @ sysblu view (cfdd)",
		"add application -> add application @ sysblu view (cfdd)"
		],
	sx:	[
		    {
		        "icon": "add_box",
		        "color": "#0fb2e4",
		        "message": "add application",
		        "help": "Add application"
		    },
		    {
		        "icon": "comment",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Application prompt"
		    },
		    {
		        "icon": "save",
		        "color": "#0fb2e4",
		        "message": "save",
		        "help": "Save system"
		    }
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "nFIn",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (KkUJ)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "CyxS",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (KkUJ)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "ytsa",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (KkUJ)"
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
