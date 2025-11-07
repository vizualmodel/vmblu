// ------------------------------------------------------------------
// Model: hv-layout
// Path: playground.app.js
// Creation date 11/7/2025, 9:32:52 PM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "@vizualmodel/vmblu-runtime"


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
	uid: "VbQl", 
	factory: WorkspaceFactory,
	inputs: [
		"-> dom add modal div",
		"-> file savedAs",
		"-> file active",
		"-> file closed"
		],
	outputs: [
		"dom workspace div -> left column @ left menu layout (iGhg)",
		"file selected -> doc selected @ document manager (cwHV)",
		"file new -> doc new @ document manager (cwHV)",
		"file get name -> ()",
		"file context menu -> ()",
		"file renamed -> doc renamed @ document manager (cwHV)",
		"file deleted -> doc deleted @ document manager (cwHV)",
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
	uid: "YdWQ", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (VbQl)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "vQAl", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (VbQl)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "IQEn", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom add modal div @ workspace (VbQl)"
		]
	},
	//____________________________________________________TOP MENU
	{
	name: "top menu", 
	uid: "FIGR", 
	factory: TopMenuFactory,
	inputs: [],
	outputs: [
		"run app in iframe -> run app in iframe @ editor (MtMT)",
		"run app page -> run app @ editor (MtMT)",
		"make app page -> make app @ editor (MtMT)",
		"make build lib -> make lib @ editor (MtMT)",
		"save -> save @ document manager (cwHV)",
		"save as -> save as @ document manager (cwHV)",
		"save all -> save all @ document manager (cwHV)",
		"accept changes -> accept changes @ editor (MtMT)",
		"sync model -> sync model @ editor (MtMT)",
		"recalibrate -> recalibrate @ editor (MtMT)",
		"grid on-off -> grid on-off @ editor (MtMT)",
		"show settings -> show settings @ editor (MtMT)",
		"set save point -> save point set @ editor (MtMT)",
		"back to save point -> save point back @ editor (MtMT)",
		"div -> menu div @ menu tabs window (zuQB)"
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
	uid: "rbGP", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab new",
		"-> tab rename",
		"-> tab select",
		"-> tab remove"
		],
	outputs: [
		"div -> tabs div @ menu tabs window (zuQB)",
		"tab request to close -> tab request to close @ document manager (cwHV)",
		"tab request to select -> tab request to select @ document manager (cwHV)"
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
	uid: "MtMT", 
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
		"show lib path -> path @ path request (xzsJ)",
		"show app path -> path @ path request (xzsJ)",
		"run -> ()",
		"runtime settings -> show @ runtime settings (vWab)",
		"open document -> doc open @ document manager (cwHV)",
		"document settings -> show @ doc settings (scon)",
		"save point confirm -> show @ confirm box (VQGY)",
		"show context menu -> context menu @ context menu (CdbT)",
		"settings -> json @ node settings (jpoh)",
		"show link -> name and path @ name and path (fkXt)",
		"show filter -> name and path @ name and path (fkXt)",
		"show factory -> name and path @ name and path (fkXt)",
		"open source file -> ()",
		"pin profile -> show @ pin profile (tNCB)",
		"node comment -> text @ text block (UGFf)",
		"select node -> show @ node selector (ALlR)",
		"change library -> switch library @ node library (bvvX)",
		"add lib file -> ()",
		"canvas -> content div @ menu tabs window (zuQB)",
		"new edit -> ()",
		"clipboard get => get @ clipboard (NJvn)",
		"clipboard set -> set @ clipboard (NJvn)"
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
	uid: "CdbT", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "xzsJ", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "jpoh", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "fkXt", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "tNCB", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "UGFf", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//____________________________________________MENU TABS WINDOW
	{
	name: "menu tabs window", 
	uid: "zuQB", 
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
		"content size change -> size change @ editor (MtMT)",
		"div -> area one @ left menu layout (iGhg)"
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "cwHV", 
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
		"doc set active -> set document @ editor (MtMT)",
		"save as filename -> path @ path request (xzsJ)",
		"open models -> ()",
		"tab new -> tab new @ tab ribbon (rbGP)",
		"tab rename -> tab rename @ tab ribbon (rbGP)",
		"tab select -> tab select @ tab ribbon (rbGP)",
		"tab remove -> tab remove @ tab ribbon (rbGP)"
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
	uid: "ALlR", 
	factory: NodeSelectorFactory,
	inputs: [
		"-> show",
		"-> build table"
		],
	outputs: [
		"selected node -> selected node @ editor (MtMT)",
		"remove file -> remove file @ node library (bvvX)",
		"add file -> add file @ node library (bvvX)",
		"get path -> path @ path request (Raic)",
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//________________________________________________NODE LIBRARY
	{
	name: "node library", 
	uid: "bvvX", 
	factory: LibraryManager,
	inputs: [
		"-> switch library",
		"-> remove file",
		"-> add file"
		],
	outputs: [
		"build table -> build table @ node selector (ALlR)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "Raic", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "scon", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "NJvn", 
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
	uid: "VQGY", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "vWab", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ menu tabs window (zuQB)"
		]
	},
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "hLvA", 
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
	uid: "iGhg", 
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
		"size change -> size change @ menu tabs window (zuQB)"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "waLy", 
	factory: SideMenuFactory,
	inputs: [],
	outputs: [
		"div -> left menu @ left menu layout (iGhg)",
		"vertical -> vertical @ left menu layout (iGhg)",
		"horizontal -> horizontal @ left menu layout (iGhg)",
		"show app -> show @ application launcher (hLvA)",
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
