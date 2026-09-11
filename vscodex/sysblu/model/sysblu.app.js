// ------------------------------------------------------------------
// Model: sysblu vscode editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.1","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.1"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:56058ce534c52b6c"}}
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
	uid: "ePal",
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
		"sysblu.set -> sysblu.set @ sysblu manager (mdWY)",
		"sysblu.save -> sysblu.save @ sysblu manager (mdWY)",
		"sysblu.undo -> sysmod.undo @ sysblu manager (mdWY)",
		"sysblu.redo -> sysmod.redo @ sysblu manager (mdWY)",
		"size change -> size change @ sysblu view (HzUr)"
		]
	},
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "HzUr",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ system message broker (ePal)",
		"application settings -> application settings @ application inspector (qkWl)",
		"endpoint settings -> endpoint settings @ endpoint inspector (CHyJ)",
		"connection settings -> connection settings @ connection inspector (Ubxx)",
		"project references -> project references @ project references (Qdgu)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (mdWY)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (mdWY)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (mdWY)",
		"open reference -> open reference @ system message broker (ePal)",
		"execute command -> execute command @ system message broker (ePal)"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "mdWY",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ system message broker (ePal)",
		"sysblu.failed -> sysblu.failed @ system message broker (ePal)",
		"sysblu.diagnostics -> sysblu.diagnostics @ system message broker (ePal)",
		`system.updated -> [ 
			"system.updated @ sysblu view (HzUr)",
			"system.updated @ system message broker (ePal)" ]`,
		"sysmod.done -> sysmod.done @ sysblu view (HzUr)"
		]
	},
	//_________________________________________________SYSTEM MENU
	{
	name: "system menu",
	uid: "tGRX",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ system message broker (ePal)",
		"save -> save @ system message broker (ePal)",
		"application prompt -> application prompt @ sysblu view (HzUr)",
		"add application -> add application @ sysblu view (HzUr)"
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
	uid: "qkWl",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (ePal)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "CHyJ",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (ePal)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "Ubxx",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (ePal)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "Qdgu",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ system message broker (ePal)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.1","schemaVersion":"1.12.1"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
