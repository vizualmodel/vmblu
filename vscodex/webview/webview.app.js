// ------------------------------------------------------------------
// Model: webview
// Path: webview.app.js
// Creation date 1/23/2026, 1:56:32 PM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../../runtime/src/scaffold.js"

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
	uid: "gOYl", 
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
		"set document -> set document @ editor (ufkp)",
		"get document -> ()",
		"sync links -> sync links @ editor (ufkp)",
		"reload model -> reload model @ editor (ufkp)",
		"canvas resize -> size change @ editor (ufkp)",
		"clipboard local => local @ clipboard (zlzo)",
		"clipboard switched -> switched @ clipboard (zlzo)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "vitM", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "wehE", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "ceVw", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> floating menu @ message broker (gOYl)",
		"sync -> sync links @ editor (ufkp)",
		"accept changes -> accept changes @ editor (ufkp)",
		"recalibrate -> recalibrate @ editor (ufkp)",
		"grid on-off -> grid on-off @ editor (ufkp)",
		"show settings -> show settings @ editor (ufkp)",
		"set save point -> save point set @ editor (ufkp)",
		"back to save point -> save point back @ editor (ufkp)",
		"make lib -> make lib @ editor (ufkp)",
		"make app -> make app @ editor (ufkp)"
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
	uid: "GQyT", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "JiRc", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "gTBc", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//____________________________________________PROFILE SETTINGS
	{
	name: "profile settings", 
	uid: "YEDD", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "ztSv", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (ufkp)",
		"remove file -> remove file @ library manager (wOum)",
		"add file -> add file @ library manager (wOum)",
		"get path -> path @ path request (tNqP)",
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//_____________________________________________LIBRARY MANAGER
	{
	name: "library manager", 
	uid: "wOum", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (ztSv)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "tNqP", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "SYpQ", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "zlzo", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"=> get",
		"-> set"
		],
	outputs: [
		"switch -> clipboard switch @ message broker (gOYl)",
		"remote => clipboard remote @ message broker (gOYl)"
		]
	},
	//______________________________________________________EDITOR
	{
	name: "editor", 
	uid: "ufkp", 
	factory: EditorFactory,
	inputs: [
		"-> accept changes",
		"-> sync links",
		"-> reload model",
		"-> recalibrate",
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
		"open document -> open document @ message broker (gOYl)",
		"document settings -> show @ doc settings (SYpQ)",
		"save point confirm -> show @ confirm box (gNdb)",
		"new edit -> new edit @ message broker (gOYl)",
		"show lib path -> path @ path request (wehE)",
		"show app path -> path @ path request (wehE)",
		"run -> ()",
		"open source file -> open js file @ message broker (gOYl)",
		"show context menu -> context menu @ context menu (vitM)",
		"runtime settings -> show @ runtime settings (JRLW)",
		"settings -> json @ node settings (JiRc)",
		"show link -> name and path @ name and path (gTBc)",
		"show filter -> name and path @ name and path (gTBc)",
		"show factory -> name and path @ name and path (gTBc)",
		"node comment -> text @ text block (GQyT)",
		"pin profile -> show @ profile settings (YEDD)",
		"clipboard get => get @ clipboard (zlzo)",
		"clipboard set -> set @ clipboard (zlzo)",
		"select node -> show @ node selector (ztSv)",
		"change library -> switch library @ library manager (wOum)",
		"add lib file -> ()",
		"canvas -> canvas @ message broker (gOYl)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "gNdb", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "JRLW", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ message broker (gOYl)"
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
