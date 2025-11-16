// ------------------------------------------------------------------
// Model: webview
// Path: webview.app.js
// Creation date 11/9/2025, 2:59:06 PM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../../runtime/src/scaffold.js"
//import '../../ui/out/svelte-lib-bundle.css';


//Imports
import { MessageBroker } from './message-broker.js'
import { ContextMenuFactory,
		 PathRequestFactory,
		 VscodeSideMenuFactory,
		 TextBlockFactory,
		 JsonInputFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 NodeSelectorFactory,
		 DocumentSettingsFactory,
		 ConfirmBox,
		 RuntimeSettingsFactory } from '../../ui/index.js'
import { LibraryManager,
		 Clipboard,
		 EditorFactory } from '../../core/index.js'

//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "RDZW", 
	factory: MessageBroker,
	inputs: [
		"-> open document",
		"-> reply document",
		"-> new edit",
		"-> open js file",
		"-> floating menu",
		"-> canvas",
		"-> modal div",
		"=> clipboard remote",
		"-> clipboard switch"
		],
	outputs: [
		"set document -> set document @ editor (yDvm)",
		"get document -> ()",
		"sync model -> sync model @ editor (yDvm)",
		"canvas resize -> size change @ editor (yDvm)",
		"clipboard local => local @ clipboard (uTHd)",
		"clipboard switched -> switched @ clipboard (uTHd)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "kKBy", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "qTdO", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "INfR", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (RDZW)",
		"accept changes -> accept changes @ editor (yDvm)",
		"recalibrate -> recalibrate @ editor (yDvm)",
		"sync -> sync model @ editor (yDvm)",
		"grid on-off -> grid on-off @ editor (yDvm)",
		"show settings -> show settings @ editor (yDvm)",
		"set save point -> save point set @ editor (yDvm)",
		"back to save point -> save point back @ editor (yDvm)",
		"make lib -> make lib @ editor (yDvm)",
		"make app -> make app @ editor (yDvm)"
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
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "KCrn", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "QNwq", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "Zjnb", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//____________________________________________PROFILE SETTINGS
	{
	name: "profile settings", 
	uid: "nxlD", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "sluZ", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (yDvm)",
		"remove file -> remove file @ library manager (IeRV)",
		"add file -> add file @ library manager (IeRV)",
		"get path -> path @ path request (ciXx)",
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "IeRV", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (sluZ)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "ciXx", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "zCVo", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "uTHd", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"=> get",
		"-> set"
		],
	outputs: [
		"switch -> clipboard switch @ message broker (RDZW)",
		"remote => clipboard remote @ message broker (RDZW)"
		]
	},
	//______________________________________________________EDITOR
	{
	name: "editor", 
	uid: "yDvm", 
	factory: EditorFactory,
	inputs: [
		"-> accept changes",
		"-> recalibrate",
		"-> sync model",
		"-> grid on-off",
		"-> show settings",
		"-> set document",
		"-> save point set",
		"-> save point back",
		"-> make lib",
		"-> make app",
		"-> run app",
		"-> run app in iframe",
		"-> selected node",
		"-> size change"
		],
	outputs: [
		"open document -> open document @ message broker (RDZW)",
		"document settings -> show @ doc settings (zCVo)",
		"save point confirm -> show @ confirm box (oxkj)",
		"new edit -> new edit @ message broker (RDZW)",
		"show lib path -> path @ path request (qTdO)",
		"show app path -> path @ path request (qTdO)",
		"run -> ()",
		"open source file -> open js file @ message broker (RDZW)",
		"show context menu -> context menu @ context menu (kKBy)",
		"runtime settings -> show @ runtime settings (dKXC)",
		"settings -> json @ node settings (QNwq)",
		"show link -> name and path @ name and path (Zjnb)",
		"show filter -> name and path @ name and path (Zjnb)",
		"show factory -> name and path @ name and path (Zjnb)",
		"node comment -> text @ text block (KCrn)",
		"pin profile -> show @ profile settings (nxlD)",
		"clipboard get => get @ clipboard (uTHd)",
		"clipboard set -> set @ clipboard (uTHd)",
		"select node -> show @ node selector (sluZ)",
		"change library -> switch library @ library manager (IeRV)",
		"add lib file -> ()",
		"canvas -> canvas @ message broker (RDZW)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "oxkj", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "dKXC", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (RDZW)"
		]
	},
]

//The filters
const filterList = [
]

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, filterList)

// and start the app
runtime.start()
