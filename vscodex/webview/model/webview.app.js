// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.10","schemaVersion":"1.10.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.10.0"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:3ee14a27d500fe65"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "../../../runtime/rt-base/runtime.js"


//Imports
import { MessageBroker } from '../message-broker.js'
import { ViewManager } from '../../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../../core/nodes/clipboard/clipboard.js'
import { PathRequestFactory,
		 NodeSettingsFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 PinToolFactory,
		 PinEventFactory,
		 ConfirmBox,
		 DocumentSettingsFactory,
		 ModelRuntimeSettingsFactory,
		 AgentSettingsFactory,
		 MessageBoxFactory,
		 ToastBoxFactory,
		 VscodeSideMenuFactory,
		 TeamLegendFactory } from '../../../ui-svelte/index.js'



//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker",
	uid: "KVVu",
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> model.loaded",
		"-> open js file",
		"=> folder.get",
		"-> canvas",
		"-> legend div",
		"-> floating menu",
		"-> modal div",
		"=> clipboard.remote",
		"-> clipboard.switch"
		],
	outputs: [
		`set document -> [ 
			"top level view @ view manager (FfnX)",
			"model.set @ model manager (vwgS)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (vwgS)",
		"model.save -> model.save @ model manager (vwgS)",
		"sync links -> sync links @ model manager (vwgS)",
		"canvas resize -> size change @ view manager (FfnX)",
		"clipboard.local => local @ clipboard (fkBb)",
		"clipboard.switched -> switched @ clipboard (fkBb)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "FfnX",
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> recalibrate",
		"-> top level view",
		"-> grid on-off",
		"-> size change",
		"-> application prompt"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (vwgS)",
		"redox.undo -> redox.undo @ model manager (vwgS)",
		"redox.redo -> redox.redo @ model manager (vwgS)",
		"team legend -> teams @ team legend (GdNB)",
		"canvas -> canvas @ message broker (KVVu)",
		"node settings (sx) -> show @ node settings (nDba)",
		"runtime settings (dx) -> show @ runtime settings (zXSq)",
		"node prompt -> markdown @ markdown prompt (Jjsz)",
		"context menu -> context menu @ context menu (LCos)",
		"name and path -> name and path @ name and path (Conq)",
		"open model -> open document @ message broker (KVVu)",
		"open source file -> open js file @ message broker (KVVu)",
		"clipboard.get => get @ clipboard (fkBb)",
		"clipboard.set -> set @ clipboard (fkBb)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "vwgS",
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
		"-> auto layout",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> sync links",
		"-> save point.set",
		"-> save point.back",
		"-> model.save",
		"-> model.set",
		"-> redox.doit",
		"-> redox.undo",
		"-> redox.redo"
		],
	outputs: [
		"save point.confirm -> show @ confirm box (ylFV)",
		"open source file -> open js file @ message broker (KVVu)",
		"open model -> ()",
		"model.root -> root @ view manager (FfnX)",
		"model.loaded -> model.loaded @ message broker (KVVu)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (ITOv)",
		`redox.done -> [ 
			"redox.done @ view manager (FfnX)",
			"new edit @ message broker (KVVu)" ]`,
		"pin profile -> show @ pin profile (SNOe)",
		"get path -> path @ path request (qWXz)",
		"tool settings -> show @ tool settings (cQZM)",
		"event settings -> show @ event settings (iKQk)",
		"info popup -> show @ toast box (retO)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "fkBb",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (KVVu)",
		"switch -> clipboard.switch @ message broker (KVVu)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "qWXz",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (KVVu)",
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "nDba",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "Conq",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)",
		"folder.get => folder.get @ message broker (KVVu)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "SNOe",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (Jjsz)",
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "Jjsz",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "LCos",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (ylFV)",
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "zXSq",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "cQZM",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "iKQk",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "ylFV",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "ITOv",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)",
		"agent settings -> show @ agent settings (gsBS)",
		"model runtime settings -> show @ model runtime settings (vyyO)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "vyyO",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "gsBS",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "gVtP",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "retO",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (KVVu)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "cEjP",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (KVVu)",
		"sync model -> sync model @ model manager (vwgS)",
		"accept changes -> accept changes @ model manager (vwgS)",
		"wire check -> wire check @ model manager (vwgS)",
		"show settings -> show settings @ model manager (vwgS)",
		"make app -> make app @ model manager (vwgS)",
		"make lib -> make lib @ model manager (vwgS)",
		"set save point -> save point.set @ model manager (vwgS)",
		"back to save point -> save point.back @ model manager (vwgS)",
		"recalibrate -> recalibrate @ view manager (FfnX)",
		"grid on-off -> grid on-off @ view manager (FfnX)",
		"application prompt -> application prompt @ view manager (FfnX)"
		],
	sx:	[
		    {
		        "icon": "flare",
		        "color": "#0fb2e4",
		        "message": "recalibrate",
		        "help": "Recalibrate"
		    },
		    {
		        "icon": "grid_view",
		        "color": "#0fb2e4",
		        "message": "grid on-off",
		        "help": "Grid on/off"
		    },
		    {
		        "icon": "comment",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Application prompt"
		    },
		    {
		        "icon": "check_box",
		        "color": "#0fb2e4",
		        "message": "accept changes",
		        "help": "Accept changes"
		    },
		    {
		        "icon": "cable",
		        "color": "#0fb2e4",
		        "message": "wire check",
		        "help": "Wire check"
		    },
		    {
		        "icon": "bolt",
		        "color": "#0fb2e4",
		        "message": "sync model",
		        "help": "sync model"
		    },
		    {
		        "icon": "push_pin",
		        "color": "#0fb2e4",
		        "message": "set save point",
		        "help": "set save point"
		    },
		    {
		        "icon": "reply",
		        "color": "#0fb2e4",
		        "message": "back to save point",
		        "help": "back to save point"
		    },
		    {
		        "icon": "build",
		        "color": "#0fb2e4",
		        "message": "make lib",
		        "help": "Make lib"
		    },
		    {
		        "icon": "handyman",
		        "color": "#0fb2e4",
		        "message": "make app",
		        "help": "Make app"
		    },
		    {
		        "icon": "settings",
		        "color": "#0fb2e4",
		        "message": "show settings",
		        "help": "Settings"
		    }
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "GdNB",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (KVVu)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.10","generatorVersion":"1.10.0","schemaVersion":"1.10.0"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
