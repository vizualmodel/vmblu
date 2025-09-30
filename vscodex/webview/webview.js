// ------------------------------------------------------------------
// Model: webview
// Path: webview.js
// Creation date 9/9/2025, 10:01:18 AM
// ------------------------------------------------------------------

// import the runtime code
import * as RT from "../../runtime/src/scaffold.js"
import '../../ui/out/svelte-lib-bundle.css';


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
		 RuntimeSettingsFactory } from '../../ui/out/svelte-lib-bundle.js'
import { LibraryManager,
		 Clipboard,
		 EditorFactory } from '../../core/index.js'

//The runtime nodes
const nodeList = [
	//______________________________________________MESSAGE BROKER
	{
	name: "message broker", 
	uid: "tcTH", 
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
		"set document -> set document @ editor (QCIF)",
		"get document -> ()",
		"sync model -> sync model @ editor (QCIF)",
		"canvas resize -> size change @ editor (QCIF)",
		"clipboard local => local @ clipboard (ziWn)",
		"clipboard switched -> switched @ clipboard (ziWn)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "LfSD", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "VUTh", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "AykR", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (tcTH)",
		"accept changes -> accept changes @ editor (QCIF)",
		"recalibrate -> recalibrate @ editor (QCIF)",
		"sync -> sync model @ editor (QCIF)",
		"grid on-off -> grid on-off @ editor (QCIF)",
		"show settings -> show settings @ editor (QCIF)",
		"set save point -> save point set @ editor (QCIF)",
		"back to save point -> save point back @ editor (QCIF)",
		"make lib -> make lib @ editor (QCIF)",
		"make app -> make app @ editor (QCIF)"
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
	uid: "RxHm", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "vGtR", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "sWeZ", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//____________________________________________PROFILE SETTINGS
	{
	name: "profile settings", 
	uid: "MCNa", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "NKtq", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (QCIF)",
		"remove file -> remove file @ library manager (MBWr)",
		"add file -> add file @ library manager (MBWr)",
		"get path -> path @ path request (CtPY)",
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "MBWr", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (NKtq)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "CtPY", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "oNKd", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "ziWn", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"=> get",
		"-> set"
		],
	outputs: [
		"switch -> clipboard switch @ message broker (tcTH)",
		"remote => clipboard remote @ message broker (tcTH)"
		]
	},
	//______________________________________________________EDITOR
	{
	name: "editor", 
	uid: "QCIF", 
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
		"open document -> open document @ message broker (tcTH)",
		"document settings -> show @ doc settings (oNKd)",
		"save point confirm -> show @ confirm box (fUdS)",
		"new edit -> new edit @ message broker (tcTH)",
		"show lib path -> path @ path request (VUTh)",
		"show app path -> path @ path request (VUTh)",
		"run -> ()",
		"open source file -> open js file @ message broker (tcTH)",
		"show context menu -> context menu @ context menu (LfSD)",
		"runtime settings -> show @ runtime settings (nFTC)",
		"settings -> json @ node settings (vGtR)",
		"show link -> name and path @ name and path (sWeZ)",
		"show router -> name and path @ name and path (sWeZ)",
		"show factory -> name and path @ name and path (sWeZ)",
		"node comment -> text @ text block (RxHm)",
		"pin profile -> show @ profile settings (MCNa)",
		"clipboard get => get @ clipboard (ziWn)",
		"clipboard set -> set @ clipboard (ziWn)",
		"select node -> show @ node selector (NKtq)",
		"change library -> switch library @ library manager (MBWr)",
		"add lib file -> ()",
		"canvas -> canvas @ message broker (tcTH)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "fUdS", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "nFTC", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (tcTH)"
		]
	},
]

//The routers
const filterList = [
]

// prepare the runtime
const runtime = RT.scaffold(nodeList, filterList)

// and start the app
runtime.start()
