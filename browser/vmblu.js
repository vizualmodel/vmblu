// ------------------------------------------------------------------
// Model: hv-layout
// Path: vmblu.js
// Creation date 9/21/2025, 11:23:22 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../runtime/src/scaffold.js"
//import * as VMBLU from "@vizualmodel/vmblu";

console.log(VMBLU.VERSION)

//Imports
import { WorkspaceFactory } from './workspace/index.js'
import { SingleTextFieldFactory,
		 ContextMenuFactory,
		 MessageBoxFactory,
		 TopMenuFactory,
		 TabRibbonFactory,
		 PathRequestFactory,
		 JsonInputFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 TextBlockFactory,
		 MenuTabsWindow,
		 NodeSelectorFactory,
		 DocumentSettingsFactory,
		 ConfirmBox,
		 RuntimeSettingsFactory,
		 LeftMenuLayoutFactory,
		 SideMenuFactory } from '../ui/out/svelte-lib-bundle.js'
import { EditorFactory,
		 DocumentManager,
		 LibraryManager,
		 Clipboard } from '../core/index.js'
import { ApplicationLauncher } from './launcher/app-launcher.js'

//The runtime nodes
const nodeList = [
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "PvBw", 
	factory: WorkspaceFactory,
	inputs: [
		"-> dom add modal div",
		"-> file savedAs",
		"-> file active",
		"-> file closed"
		],
	outputs: [
		"dom workspace div -> left column @ left menu layout (Npin)",
		"file selected -> doc selected @ document manager (Tean)",
		"file new -> doc new @ document manager (Tean)",
		"file get name -> ()",
		"file context menu -> ()",
		"file renamed -> doc renamed @ document manager (Tean)",
		"file deleted -> doc deleted @ document manager (Tean)",
		"files get list => ()",
		"files selected -> ()",
		"files deleted -> ()",
		"directory context menu -> ()",
		"directory renamed -> ()",
		"directory deleted -> ()",
		"drawer get location -> ()"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field", 
	uid: "lOvf", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (PvBw)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "wjQP", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (PvBw)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "THxG", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (PvBw)"
		]
	},
	//____________________________________________________TOP MENU
	{
	name: "top menu", 
	uid: "xpxR", 
	factory: TopMenuFactory,
	inputs: [],
	outputs: [
		"run app in iframe -> run app in iframe @ editor (QLsS)",
		"run app page -> run app @ editor (QLsS)",
		"make app page -> make app @ editor (QLsS)",
		"make build lib -> make lib @ editor (QLsS)",
		"save -> save @ document manager (Tean)",
		"save as -> save as @ document manager (Tean)",
		"save all -> save all @ document manager (Tean)",
		"accept changes -> accept changes @ editor (QLsS)",
		"sync model -> sync model @ editor (QLsS)",
		"recalibrate -> recalibrate @ editor (QLsS)",
		"grid on-off -> grid on-off @ editor (QLsS)",
		"show settings -> show settings @ editor (QLsS)",
		"set save point -> save point set @ editor (QLsS)",
		"back to save point -> save point back @ editor (QLsS)",
		"div -> menu div @ menu tabs window (fEHP)"
		],
	sx:	[
		    {
		        "name": "save",
		        "message": "save",
		        "help": "save"
		    },
		    {
		        "name": "save_as",
		        "message": "save as",
		        "help": "save as"
		    },
		    {
		        "name": "save_alt",
		        "message": "save all",
		        "help": "save all"
		    },
		    {
		        "name": "flare",
		        "message": "recalibrate",
		        "help": "toggle zoom"
		    },
		    {
		        "name": "grid_view",
		        "message": "grid on-off",
		        "help": "grid on-off"
		    },
		    {
		        "name": "check_box",
		        "message": "accept changes",
		        "help": "accept changes"
		    },
		    {
		        "name": "sync",
		        "message": "sync model",
		        "help": "sync model"
		    },
		    {
		        "name": "settings",
		        "message": "show settings",
		        "help": "settings"
		    },
		    {
		        "name": "build",
		        "message": "make build lib",
		        "help": "make lib"
		    },
		    {
		        "name": "handyman",
		        "message": "make app page",
		        "help": "make app"
		    },
		    {
		        "name": "push_pin",
		        "message": "set save point",
		        "help": "set save point"
		    },
		    {
		        "name": "reply",
		        "message": "back to save point",
		        "help": "back to save point"
		    },
		    {
		        "name": "rocket_launch",
		        "message": "run app page",
		        "help": "run in separate page"
		    },
		    {
		        "name": "preview",
		        "message": "run app in iframe",
		        "help": "run in iframe"
		    },
		    {
		        "name": "login",
		        "message": "login",
		        "help": "login"
		    }
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "NIFy", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab new",
		"-> tab rename",
		"-> tab select",
		"-> tab remove"
		],
	outputs: [
		"div -> tabs div @ menu tabs window (fEHP)",
		"tab request to close -> tab request to close @ document manager (Tean)",
		"tab request to select -> tab request to select @ document manager (Tean)"
		],
	sx:	{
		    "a": 7,
		    "b": 8,
		    "c": "dit is een filename",
		    "d": {
		        "e": "nee",
		        "dxdy": 254
		    }
		}
	},
	//______________________________________________________EDITOR
	{
	name: "editor", 
	uid: "QLsS", 
	factory: EditorFactory,
	inputs: [
		"-> accept changes",
		"-> sync model",
		"-> recalibrate",
		"-> grid on-off",
		"-> show settings",
		"-> make lib",
		"-> make app",
		"-> run app",
		"-> run app in iframe",
		"-> set document",
		"-> save point set",
		"-> save point back",
		"-> selected node",
		"-> size change"
		],
	outputs: [
		"show lib path -> path @ path request (ZGcs)",
		"show app path -> path @ path request (ZGcs)",
		"run -> ()",
		"runtime settings -> show @ runtime settings (VHPX)",
		"open document -> doc open @ document manager (Tean)",
		"document settings -> show @ doc settings (jpro)",
		"save point confirm -> show @ confirm box (zvTs)",
		"show context menu -> context menu @ context menu (cGKe)",
		"settings -> json @ node settings (fjIf)",
		"show link -> name and path @ name and path (JeHe)",
		"show filter -> name and path @ name and path (JeHe)",
		"show factory -> name and path @ name and path (JeHe)",
		"open source file -> ()",
		"pin profile -> show @ pin profile (cFJP)",
		"node comment -> text @ text block (LCjW)",
		"select node -> show @ node selector (VYnn)",
		"change library -> switch library @ node library (qqdX)",
		"add lib file -> ()",
		"canvas -> content div @ menu tabs window (fEHP)",
		"new edit -> ()",
		"clipboard get => get @ clipboard (ETom)",
		"clipboard set -> set @ clipboard (ETom)"
		],
	sx:	{
		    "a": 7,
		    "b": 8,
		    "c": 9
		}
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "cGKe", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "ZGcs", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "fjIf", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "JeHe", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "cFJP", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "LCjW", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//____________________________________________MENU TABS WINDOW
	{
	name: "menu tabs window", 
	uid: "fEHP", 
	factory: MenuTabsWindow,
	inputs: [
		"-> menu div",
		"-> tabs div",
		"-> content div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content size change -> size change @ editor (QLsS)",
		"div -> area one @ left menu layout (Npin)"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "Tean", 
	factory: DocumentManager,
	inputs: [
		"-> doc selected",
		"-> doc new",
		"-> doc renamed",
		"-> doc deleted",
		"-> doc get",
		"-> doc open",
		"-> save",
		"-> save as",
		"-> save all",
		"-> get open models",
		"-> tab request to close",
		"-> tab request to select"
		],
	outputs: [
		"doc set active -> set document @ editor (QLsS)",
		"save as filename -> path @ path request (ZGcs)",
		"open models -> ()",
		"tab new -> tab new @ tab ribbon (NIFy)",
		"tab rename -> tab rename @ tab ribbon (NIFy)",
		"tab select -> tab select @ tab ribbon (NIFy)",
		"tab remove -> tab remove @ tab ribbon (NIFy)"
		],
	dx:	{
		    "logMessages": false,
		    "worker": {
		        "on": false,
		        "path": ""
		    }
		}
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector", 
	uid: "VYnn", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (QLsS)",
		"remove file -> remove file @ node library (qqdX)",
		"add file -> add file @ node library (qqdX)",
		"get path -> path @ path request (XiDp)",
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//________________________________________________NODE LIBRARY
	{
	name: "node library", 
	uid: "qqdX", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (VYnn)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "XiDp", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "jpro", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "ETom", 
	factory: Clipboard,
	inputs: [
		"-> switched",
		"=> local",
		"=> get",
		"-> set"
		],
	outputs: [
		"switch -> ()",
		"remote => ()"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "zvTs", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "VHPX", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (fEHP)"
		]
	},
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "gkQy", 
	factory: ApplicationLauncher,
	inputs: [
		"-> run application",
		"-> size change",
		"-> show"
		],
	outputs: [
		"iframe -> ()"
		]
	},
	//____________________________________________LEFT MENU LAYOUT
	{
	name: "left menu layout", 
	uid: "Npin", 
	factory: LeftMenuLayoutFactory,
	inputs: [
		"-> left column",
		"-> left menu",
		"-> area one",
		"-> area two",
		"-> horizontal",
		"-> vertical"
		],
	outputs: [
		"size change -> size change @ menu tabs window (fEHP)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "CNts", 
	factory: SideMenuFactory,
	inputs: [],
	outputs: [
		"div -> left menu @ left menu layout (Npin)",
		"vertical -> vertical @ left menu layout (Npin)",
		"horizontal -> horizontal @ left menu layout (Npin)",
		"show app -> show @ application launcher (gkQy)",
		"show code editor -> ()"
		],
	sx:	[
		    {
		        "name": "vertical_split",
		        "message": "vertical",
		        "help": "toggle vertical split"
		    },
		    {
		        "name": "horizontal_split",
		        "message": "horizontal",
		        "help": "toggle horizontal split"
		    },
		    {
		        "name": "edit_note",
		        "message": "show code editor",
		        "help": "show code editor"
		    },
		    {
		        "name": "login",
		        "message": "login",
		        "help": "login"
		    }
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
