// ------------------------------------------------------------------
// Model: 
// Path: /c:/dev/vmblu/vscodex/webview/webview.app.js
// Creation date 5/19/2026, 9:41:50 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../../../runtime/rt-base/scaffold.js"


//Imports
import { MessageBroker } from '../message-broker.js'
import { ViewManager } from '../../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../../core/nodes/clipboard/clipboard.js'
import { PathRequestFactory,
		 JsonInputFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 DocumentSettingsFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 PinToolFactory,
		 PinEventFactory,
		 ConfirmBox,
		 VscodeSideMenuFactory } from '../../../ui-svelte/index.js'



//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "yhMY", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> open js file",
		"=> folder.get",
		"-> canvas",
		"-> floating menu",
		"-> modal div",
		"=> clipboard.remote",
		"-> clipboard.switch"
		],
	outputs: [
		`set document -> [ 
			"model.set @ model manager (YDvE)",
			"top level view @ view manager (KwGh)" ]`,
		"get document -> ()",
		"reload model -> ()",
		"model.save -> model.save @ model manager (YDvE)",
		"sync links -> sync links @ model manager (YDvE)",
		"canvas resize -> size change @ view manager (KwGh)",
		"clipboard.local => local @ clipboard (aaQe)",
		"clipboard.switched -> switched @ clipboard (aaQe)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "KwGh", 
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> recalibrate",
		"-> top level view",
		"-> grid on-off",
		"-> size change"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (YDvE)",
		"redox.undo -> redox.undo @ model manager (YDvE)",
		"redox.redo -> redox.redo @ model manager (YDvE)",
		"canvas -> canvas @ message broker (yhMY)",
		"node settings (sx) -> json @ node settings (QvPq)",
		"runtime settings (dx) -> show @ runtime settings (ZuPV)",
		"node prompt -> markdown @ markdown prompt (WZhm)",
		"context menu -> context menu @ context menu (iMvg)",
		"name and path -> name and path @ name and path (DEHq)",
		"open model -> open document @ message broker (yhMY)",
		"open source file -> open js file @ message broker (yhMY)",
		"clipboard.get => get @ clipboard (aaQe)",
		"clipboard.set -> set @ clipboard (aaQe)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "YDvE", 
	factory: ModelManager,
	inputs: [
		"-> sync links",
		"-> accept changes",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> reload model",
		"-> save point.set",
		"-> save point.back",
		"-> model.save",
		"-> model.set",
		"-> redox.doit",
		"-> redox.undo",
		"-> redox.redo"
		],
	outputs: [
		"save point.confirm -> show @ confirm box (hIgm)",
		"open source file -> open js file @ message broker (yhMY)",
		"open model -> ()",
		"model.root -> root @ view manager (KwGh)",
		"model.header -> show @ doc settings (RpUo)",
		`redox.done -> [ 
			"redox.done @ view manager (KwGh)",
			"new edit @ message broker (yhMY)" ]`,
		"pin profile -> show @ pin profile (wFNt)",
		"get path -> path @ path request (Wuka)",
		"tool settings -> show @ tool settings (fNen)",
		"event settings -> show @ event settings (upZA)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "aaQe", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (yhMY)",
		"switch -> clipboard.switch @ message broker (yhMY)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "Wuka", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (yhMY)",
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "QvPq", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "DEHq", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)",
		"folder.get => folder.get @ message broker (yhMY)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "wFNt", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt", 
	uid: "WZhm", 
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "RpUo", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "iMvg", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "ZuPV", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "fNen", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "upZA", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "hIgm", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (yhMY)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "Fuzm", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (yhMY)",
		"sync -> sync links @ model manager (YDvE)",
		"accept changes -> accept changes @ model manager (YDvE)",
		"show settings -> show settings @ model manager (YDvE)",
		"make app -> make app @ model manager (YDvE)",
		"make lib -> make lib @ model manager (YDvE)",
		"set save point -> save point.set @ model manager (YDvE)",
		"back to save point -> save point.back @ model manager (YDvE)",
		"recalibrate -> recalibrate @ view manager (KwGh)",
		"grid on-off -> grid on-off @ view manager (KwGh)"
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
		        "icon": "check_box",
		        "color": "#0fb2e4",
		        "message": "accept changes",
		        "help": "Accept changes"
		    },
		    {
		        "icon": "bolt",
		        "color": "#0fb2e4",
		        "message": "sync",
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
]

const agentRuntimeOptions = {}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, [], agentRuntimeOptions)

// and start the app
runtime.start()
