// ------------------------------------------------------------------
// Model: sysblu vscode editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.4","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.4"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:5ca2648a5bfc8d7a"}}
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
		 ConnectionInspectorFactory,
		 ProjectReferencesFactory } from '../../../ui-svelte/index.js'



//The runtime nodes
const nodeList = [
	//_______________________________________SYSTEM MESSAGE BROKER
	{
	name: "system message broker",
	uid: "wufd",
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
		"sysblu.set -> sysblu.set @ sysblu manager (Waxu)",
		"sysblu.save -> sysblu.save @ sysblu manager (Waxu)",
		"sysblu.undo -> sysmod.undo @ sysblu manager (Waxu)",
		"sysblu.redo -> sysmod.redo @ sysblu manager (Waxu)",
		"size change -> size change @ sysblu view (rmiF)"
		]
	},
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "rmiF",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ system message broker (wufd)",
		"application settings -> application settings @ application inspector (hCeX)",
		"endpoint settings -> endpoint settings @ endpoint inspector (KQjb)",
		"connection settings -> connection settings @ connection inspector (PqML)",
		"project references -> project references @ project references (pUyo)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (Waxu)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (Waxu)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (Waxu)",
		"open reference -> open reference @ system message broker (wufd)",
		"execute command -> execute command @ system message broker (wufd)"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "Waxu",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ system message broker (wufd)",
		"sysblu.failed -> sysblu.failed @ system message broker (wufd)",
		"sysblu.diagnostics -> sysblu.diagnostics @ system message broker (wufd)",
		`system.updated -> [ 
			"system.updated @ sysblu view (rmiF)",
			"system.updated @ system message broker (wufd)" ]`,
		"sysmod.done -> sysmod.done @ sysblu view (rmiF)"
		]
	},
	//_________________________________________________SYSTEM MENU
	{
	name: "system menu",
	uid: "YQhA",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ system message broker (wufd)",
		"save -> save @ system message broker (wufd)",
		"application prompt -> application prompt @ sysblu view (rmiF)",
		"add application -> add application @ sysblu view (rmiF)"
		],
	sx:	[
		    {
		        "icon": "add_box",
		        "color": "#0fb2e4",
		        "message": "add application",
		        "help": "Add application"
		    },
		    {
		        "icon": "folder_open",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Project references"
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
	uid: "hCeX",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (wufd)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "KQjb",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (wufd)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "PqML",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (wufd)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "pUyo",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ system message broker (wufd)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.4","schemaVersion":"1.12.4"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
