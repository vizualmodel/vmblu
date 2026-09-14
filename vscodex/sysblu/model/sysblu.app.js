// ------------------------------------------------------------------
// Model: sysblu vscode editor
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.2","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.2"},"source":{"model":"sysblu.mod.blu","hash":"fnv1a64:cd7ce1608f786ccd"}}
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
	uid: "AffR",
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
		"sysblu.set -> sysblu.set @ sysblu manager (ygOg)",
		"sysblu.save -> sysblu.save @ sysblu manager (ygOg)",
		"sysblu.undo -> sysmod.undo @ sysblu manager (ygOg)",
		"sysblu.redo -> sysmod.redo @ sysblu manager (ygOg)",
		"size change -> size change @ sysblu view (SgFK)"
		]
	},
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "SgFK",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ system message broker (AffR)",
		"application settings -> application settings @ application inspector (JkZp)",
		"endpoint settings -> endpoint settings @ endpoint inspector (WoJB)",
		"connection settings -> connection settings @ connection inspector (nxFz)",
		"project references -> project references @ project references (IsEJ)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (ygOg)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (ygOg)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (ygOg)",
		"open reference -> open reference @ system message broker (AffR)",
		"execute command -> execute command @ system message broker (AffR)"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "ygOg",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ system message broker (AffR)",
		"sysblu.failed -> sysblu.failed @ system message broker (AffR)",
		"sysblu.diagnostics -> sysblu.diagnostics @ system message broker (AffR)",
		`system.updated -> [ 
			"system.updated @ sysblu view (SgFK)",
			"system.updated @ system message broker (AffR)" ]`,
		"sysmod.done -> sysmod.done @ sysblu view (SgFK)"
		]
	},
	//_________________________________________________SYSTEM MENU
	{
	name: "system menu",
	uid: "VmBn",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ system message broker (AffR)",
		"save -> save @ system message broker (AffR)",
		"application prompt -> application prompt @ sysblu view (SgFK)",
		"add application -> add application @ sysblu view (SgFK)"
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
	uid: "JkZp",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (AffR)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "WoJB",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (AffR)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "nxFz",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ system message broker (AffR)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "IsEJ",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ system message broker (AffR)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.2","schemaVersion":"1.12.2"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
