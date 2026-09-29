// ------------------------------------------------------------------
// Model: sysblu vscode editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.5","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.5"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:02f4ccc7261bce1f"}}
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
	uid: "gWHY",
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
		"sysblu.set -> sysblu.set @ sysblu manager (aoDS)",
		"sysblu.save -> sysblu.save @ sysblu manager (aoDS)",
		"sysblu.undo -> sysmod.undo @ sysblu manager (aoDS)",
		"sysblu.redo -> sysmod.redo @ sysblu manager (aoDS)",
		"size change -> size change @ sysblu view (qspX)"
		]
	},
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "qspX",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ system message broker (gWHY)",
		"application settings -> application settings @ application inspector (hFlC)",
		"endpoint settings -> endpoint settings @ endpoint inspector (QVpT)",
		"connection settings -> connection settings @ connection inspector (ZiCU)",
		"project references -> project references @ project references (dVtk)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (aoDS)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (aoDS)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (aoDS)",
		"open reference -> open reference @ system message broker (gWHY)",
		"execute command -> execute command @ system message broker (gWHY)"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "aoDS",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ system message broker (gWHY)",
		"sysblu.failed -> sysblu.failed @ system message broker (gWHY)",
		"sysblu.diagnostics -> sysblu.diagnostics @ system message broker (gWHY)",
		`system.updated -> [ 
			"system.updated @ sysblu view (qspX)",
			"system.updated @ system message broker (gWHY)" ]`,
		"sysmod.done -> sysmod.done @ sysblu view (qspX)"
		]
	},
	//_________________________________________________SYSTEM MENU
	{
	name: "system menu",
	uid: "jOmv",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ system message broker (gWHY)",
		"save -> save @ system message broker (gWHY)",
		"application prompt -> application prompt @ sysblu view (qspX)",
		"add application -> add application @ sysblu view (qspX)"
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
	uid: "hFlC",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (gWHY)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "QVpT",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (gWHY)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "ZiCU",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (gWHY)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "dVtk",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ system message broker (gWHY)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.5","schemaVersion":"1.12.5"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
