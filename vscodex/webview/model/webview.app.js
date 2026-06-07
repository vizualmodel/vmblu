// ------------------------------------------------------------------
// Model: 
// Path: /c:/dev/vmblu/vscodex/webview/model/webview.app.js
// Creation date 5/29/2026, 10:31:32 AM
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "../../../runtime/rt-base/runtime.js"


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
		 VscodeSideMenuFactory } from '../../../ui-svelte/index.js'



//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "Ksns", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> model.resolved",
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
			"model.set @ model manager (WNAt)",
			"top level view @ view manager (ecaZ)" ]`,
		"get document -> ()",
		"reload model -> sync model @ model manager (WNAt)",
		"model.save -> model.save @ model manager (WNAt)",
		"sync links -> sync links @ model manager (WNAt)",
		"canvas resize -> size change @ view manager (ecaZ)",
		"clipboard.local => local @ clipboard (tjra)",
		"clipboard.switched -> switched @ clipboard (tjra)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "ecaZ", 
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
		"redox.doit -> redox.doit @ model manager (WNAt)",
		"redox.undo -> redox.undo @ model manager (WNAt)",
		"redox.redo -> redox.redo @ model manager (WNAt)",
		"canvas -> canvas @ message broker (Ksns)",
		"node settings (sx) -> json @ node settings (dEDy)",
		"runtime settings (dx) -> show @ runtime settings (Izcj)",
		"node prompt -> markdown @ markdown prompt (HGXo)",
		"context menu -> context menu @ context menu (tBSh)",
		"name and path -> name and path @ name and path (PCre)",
		"open model -> open document @ message broker (Ksns)",
		"open source file -> open js file @ message broker (Ksns)",
		"clipboard.get => get @ clipboard (tjra)",
		"clipboard.set -> set @ clipboard (tjra)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "WNAt", 
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
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
		"save point.confirm -> show @ confirm box (gJzZ)",
		"open source file -> open js file @ message broker (Ksns)",
		"open model -> ()",
		"model.root -> root @ view manager (ecaZ)",
		"model.header -> show @ doc settings(0) (jVZV)",
		"model.resolved -> model.resolved @ message broker (Ksns)",
		`redox.done -> [ 
			"redox.done @ view manager (ecaZ)",
			"new edit @ message broker (Ksns)" ]`,
		"pin profile -> show @ pin profile (kZqQ)",
		"get path -> path @ path request (cbcn)",
		"tool settings -> show @ tool settings (oPup)",
		"event settings -> show @ event settings (Qslw)",
		"info popup -> show @ toast box (LrNb)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "tjra", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"=> local",
		"-> switched"
		],
	outputs: [
		"remote => clipboard.remote @ message broker (Ksns)",
		"switch -> clipboard.switch @ message broker (Ksns)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "cbcn", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ message broker (Ksns)",
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "dEDy", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "PCre", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)",
		"folder.get => folder.get @ message broker (Ksns)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "kZqQ", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//_____________________________________________MARKDOWN PROMPT
	{
	name: "markdown prompt", 
	uid: "HGXo", 
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "tBSh", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "Izcj", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "oPup", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "Qslw", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "gJzZ", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//_____________________________________________DOC SETTINGS(0)
	{
	name: "doc settings(0)", 
	uid: "jVZV", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)",
		"agent settings -> show @ agent settings (UipE)",
		"model runtime settings -> show @ model runtime settings (UoEH)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings", 
	uid: "UoEH", 
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings", 
	uid: "UipE", 
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "oIvV", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box", 
	uid: "LrNb", 
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (Ksns)"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu", 
	uid: "HyVX", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (Ksns)",
		"sync model -> sync model @ model manager (WNAt)",
		"accept changes -> accept changes @ model manager (WNAt)",
		"wire check -> wire check @ model manager (WNAt)",
		"show settings -> show settings @ model manager (WNAt)",
		"make app -> make app @ model manager (WNAt)",
		"make lib -> make lib @ model manager (WNAt)",
		"set save point -> save point.set @ model manager (WNAt)",
		"back to save point -> save point.back @ model manager (WNAt)",
		"recalibrate -> recalibrate @ view manager (ecaZ)",
		"grid on-off -> grid on-off @ view manager (ecaZ)"
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
]

// Runtime options
const runtimeOptions = {}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
