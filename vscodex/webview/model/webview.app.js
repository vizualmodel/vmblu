// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.10","schemaVersion":"1.10.1","generator":{"name":"@vizualmodel/vmblu-core","version":"1.10.1"},"source":{"model":"webview.mod.blu","hash":"fnv1a64:d4c249a793babe2a"}}
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
	uid: "VmKR",
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
			"top level view @ view manager (vVff)",
			"model.set @ model manager (mXmH)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (mXmH)",
		"model.save -> model.save @ model manager (mXmH)",
		"sync links -> sync links @ model manager (mXmH)",
		"canvas resize -> size change @ view manager (vVff)",
		"clipboard.local => local @ clipboard (SDAc)",
		"clipboard.switched -> switched @ clipboard (SDAc)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "vVff",
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
		"redox.doit -> redox.doit @ model manager (mXmH)",
		"redox.undo -> redox.undo @ model manager (mXmH)",
		"redox.redo -> redox.redo @ model manager (mXmH)",
		"team legend -> teams @ team legend (OIls)",
		"canvas -> canvas @ message broker (VmKR)",
		"node settings (sx) -> show @ node settings (xRcj)",
		"runtime settings (dx) -> show @ runtime settings (dYRC)",
		"node prompt -> markdown @ markdown prompt (tulP)",
		"context menu -> context menu @ context menu (JgbE)",
		"name and path -> name and path @ name and path (HvUZ)",
		"open model -> open document @ message broker (VmKR)",
		"open source file -> open js file @ message broker (VmKR)",
		"clipboard.get => get @ clipboard (SDAc)",
		"clipboard.set -> set @ clipboard (SDAc)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "mXmH",
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
		"save point.confirm -> show @ confirm box (cWAO)",
		"open source file -> open js file @ message broker (VmKR)",
		"open model -> ()",
		"model.root -> root @ view manager (vVff)",
		"model.loaded -> model.loaded @ message broker (VmKR)",
		"model.failed -> ()",
		"model.header -> show @ doc settings(0) (kupF)",
		`redox.done -> [ 
			"redox.done @ view manager (vVff)",
			"new edit @ message broker (VmKR)" ]`,
		"pin profile -> show @ pin profile (BmYL)",
		"get path -> path @ path request (qElV)",
		"tool settings -> show @ tool settings (uHpB)",
		"event settings -> show @ event settings (Rnxs)",
		"info popup -> show @ toast box (WDTB)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "SDAc",
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (VmKR)",
		"switch -> clipboard.switch @ message broker (VmKR)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "qElV",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (VmKR)",
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "xRcj",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "HvUZ",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)",
		"folder.get => folder.get @ message broker (VmKR)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "BmYL",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown prompt (tulP)",
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt",
	uid: "tulP",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "JgbE",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (cWAO)",
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "dYRC",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "uHpB",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "Rnxs",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "cWAO",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)",
	uid: "kupF",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)",
		"agent settings -> show @ agent settings (Bloa)",
		"model runtime settings -> show @ model runtime settings (jGeh)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "jGeh",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "Bloa",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "Nxqy",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "WDTB",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (VmKR)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "LvnA",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (VmKR)",
		"sync model -> sync model @ model manager (mXmH)",
		"accept changes -> accept changes @ model manager (mXmH)",
		"wire check -> wire check @ model manager (mXmH)",
		"show settings -> show settings @ model manager (mXmH)",
		"make app -> make app @ model manager (mXmH)",
		"make lib -> make lib @ model manager (mXmH)",
		"set save point -> save point.set @ model manager (mXmH)",
		"back to save point -> save point.back @ model manager (mXmH)",
		"recalibrate -> recalibrate @ view manager (vVff)",
		"grid on-off -> grid on-off @ view manager (vVff)",
		"application prompt -> application prompt @ view manager (vVff)"
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
	uid: "OIls",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ message broker (VmKR)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.10","generatorVersion":"1.10.1","schemaVersion":"1.10.1"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
