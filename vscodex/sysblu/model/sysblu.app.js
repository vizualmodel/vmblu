// ------------------------------------------------------------------
// Model: sysblu vscode editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.3","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.3"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:41aaa3cf211d3f55"}}
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
	uid: "iSvI",
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
		"sysblu.set -> sysblu.set @ sysblu manager (hPnr)",
		"sysblu.save -> sysblu.save @ sysblu manager (hPnr)",
		"sysblu.undo -> sysmod.undo @ sysblu manager (hPnr)",
		"sysblu.redo -> sysmod.redo @ sysblu manager (hPnr)",
		"size change -> size change @ sysblu view (tQfD)"
		]
	},
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "tQfD",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ system message broker (iSvI)",
		"application settings -> application settings @ application inspector (xFud)",
		"endpoint settings -> endpoint settings @ endpoint inspector (RxyV)",
		"connection settings -> connection settings @ connection inspector (NgLs)",
		"project references -> project references @ project references (WMZP)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (hPnr)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (hPnr)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (hPnr)",
		"open reference -> open reference @ system message broker (iSvI)",
		"execute command -> execute command @ system message broker (iSvI)"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "hPnr",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ system message broker (iSvI)",
		"sysblu.failed -> sysblu.failed @ system message broker (iSvI)",
		"sysblu.diagnostics -> sysblu.diagnostics @ system message broker (iSvI)",
		`system.updated -> [ 
			"system.updated @ sysblu view (tQfD)",
			"system.updated @ system message broker (iSvI)" ]`,
		"sysmod.done -> sysmod.done @ sysblu view (tQfD)"
		]
	},
	//_________________________________________________SYSTEM MENU
	{
	name: "system menu",
	uid: "dVds",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ system message broker (iSvI)",
		"save -> save @ system message broker (iSvI)",
		"application prompt -> application prompt @ sysblu view (tQfD)",
		"add application -> add application @ sysblu view (tQfD)"
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
	uid: "xFud",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (iSvI)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "RxyV",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (iSvI)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "NgLs",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (iSvI)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "WMZP",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ system message broker (iSvI)"
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
