// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.5","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.5"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:83038a9c57425ba9"}}
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
		 TeamSettingsFactory,
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
	uid: "BtUX",
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
			"top level view @ view manager (tpai)",
			"model.set @ model manager (GPjV)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (GPjV)",
		"model.save -> model.save @ model manager (GPjV)",
		"sync links -> sync links @ model manager (GPjV)",
		"canvas resize -> size change @ view manager (tpai)",
		"clipboard.local => local @ clipboard (WQVR)",
		"clipboard.switched -> switched @ clipboard (WQVR)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "tpai",
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
		"redox.doit -> redox.doit @ model manager (GPjV)",
		"redox.undo -> redox.undo @ model manager (GPjV)",
		"redox.redo -> redox.redo @ model manager (GPjV)",
		"team legend -> teams @ team legend (Kudy)",
		"canvas -> canvas @ message broker (BtUX)",
		"node settings (sx) -> show @ node settings (ySvF)",
		"runtime settings (dx) -> show @ runtime settings (vyjU)",
		"node prompt -> markdown @ markdown prompt (wepo)",
		"context menu -> context menu @ context menu (KsVe)",
		"name and path -> name and path @ name and path (tRsl)",
		"open model -> open document @ message broker (BtUX)",
		"open source file -> open js file @ message broker (BtUX)",
		"clipboard.get => get @ clipboard (WQVR)",
		"clipboard.set -> set @ clipboard (WQVR)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "GPjV",
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
		"save point.confirm -> show @ confirm box (gYYJ)",
		"open source file -> open js file @ message broker (BtUX)",
		"open model -> ()",
		"model.root -> root @ view manager (tpai)",
		"model.loaded -> model.loaded @ message broker (BtUX)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (TIzg)",
		`redox.done -> [ 
			"redox.done @ view manager (tpai)",
			"new edit @ message broker (BtUX)" ]`,
		"pin profile -> show @ pin profile (LFFd)",
		"get path -> path @ path request (kJCM)",
		"tool settings -> show @ tool settings (FKej)",
		"event settings -> show @ event settings (Ojiz)",
		"info popup -> show @ toast box (WTiG)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "WQVR",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (BtUX)",
		"switch -> clipboard.switch @ message broker (BtUX)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "kJCM",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (BtUX)",
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "ySvF",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "tRsl",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)",
		"folder.get => folder.get @ message broker (BtUX)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "LFFd",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (wepo)",
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "wepo",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "KsVe",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (gYYJ)",
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "vyjU",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "FKej",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "Ojiz",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "gYYJ",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "TIzg",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)",
		"agent settings -> show @ agent settings (ySPT)",
		"model runtime settings -> show @ model runtime settings (OFWA)",
		"team settings -> show @ team settings (uFGX)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "uFGX",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "OFWA",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "ySPT",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "aYOD",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "WTiG",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (BtUX)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "yIzO",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (BtUX)",
		"sync model -> sync model @ model manager (GPjV)",
		"accept changes -> accept changes @ model manager (GPjV)",
		"wire check -> wire check @ model manager (GPjV)",
		"show settings -> show settings @ model manager (GPjV)",
		"make app -> make app @ model manager (GPjV)",
		"make lib -> make lib @ model manager (GPjV)",
		"set save point -> save point.set @ model manager (GPjV)",
		"back to save point -> save point.back @ model manager (GPjV)",
		"recalibrate -> recalibrate @ view manager (tpai)",
		"grid on-off -> grid on-off @ view manager (tpai)",
		"application prompt -> application prompt @ view manager (tpai)"
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
	uid: "Kudy",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (BtUX)"
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
