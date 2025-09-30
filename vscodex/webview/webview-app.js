// ------------------------------------------------------------------
// Model: webview
// Path: webview-app.js
// Creation date 9/16/2025, 3:55:58 PM
// ------------------------------------------------------------------

// import the runtime code
import * as RT from "../../runtime/scaffold.js"
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
	uid: "bizj", 
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
		"set document -> set document @ editor (jPZW)",
		"get document -> ()",
		"sync model -> sync model @ editor (jPZW)",
		"canvas resize -> size change @ editor (jPZW)",
		"clipboard local => local @ clipboard (pBJR)",
		"clipboard switched -> switched @ clipboard (pBJR)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "VxBE", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "ZNgM", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "YjlX", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (bizj)",
		"accept changes -> accept changes @ editor (jPZW)",
		"recalibrate -> recalibrate @ editor (jPZW)",
		"sync -> sync model @ editor (jPZW)",
		"grid on-off -> grid on-off @ editor (jPZW)",
		"show settings -> show settings @ editor (jPZW)",
		"set save point -> save point set @ editor (jPZW)",
		"back to save point -> save point back @ editor (jPZW)",
		"make lib -> make lib @ editor (jPZW)",
		"make app -> make app @ editor (jPZW)"
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
	uid: "pcif", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "vIIN", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "HCxm", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//____________________________________________PROFILE SETTINGS
	{
	name: "profile settings", 
	uid: "VGjN", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "WbqD", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (jPZW)",
		"remove file -> remove file @ library manager (zoVO)",
		"add file -> add file @ library manager (zoVO)",
		"get path -> path @ path request (VqQl)",
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "zoVO", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (WbqD)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "VqQl", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "hlsp", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "pBJR", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"=> get",
		"-> set"
		],
	outputs: [
		"switch -> clipboard switch @ message broker (bizj)",
		"remote => clipboard remote @ message broker (bizj)"
		]
	},
	//______________________________________________________EDITOR
	{
	name: "editor", 
	uid: "jPZW", 
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
		"open document -> open document @ message broker (bizj)",
		"document settings -> show @ doc settings (hlsp)",
		"save point confirm -> show @ confirm box (fgDn)",
		"new edit -> new edit @ message broker (bizj)",
		"show lib path -> path @ path request (ZNgM)",
		"show app path -> path @ path request (ZNgM)",
		"run -> ()",
		"open source file -> open js file @ message broker (bizj)",
		"show context menu -> context menu @ context menu (VxBE)",
		"runtime settings -> show @ runtime settings (uhmL)",
		"settings -> json @ node settings (vIIN)",
		"show link -> name and path @ name and path (HCxm)",
		"show filter -> name and path @ name and path (HCxm)",
		"show factory -> name and path @ name and path (HCxm)",
		"node comment -> text @ text block (pcif)",
		"pin profile -> show @ profile settings (VGjN)",
		"clipboard get => get @ clipboard (pBJR)",
		"clipboard set -> set @ clipboard (pBJR)",
		"select node -> show @ node selector (WbqD)",
		"change library -> switch library @ library manager (zoVO)",
		"add lib file -> ()",
		"canvas -> canvas @ message broker (bizj)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "fgDn", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "uhmL", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (bizj)"
		]
	},
]

//The filters
const filterList = [
]

// prepare the runtime
const runtime = RT.scaffold(nodeList, filterList)

// and start the app
runtime.start()
