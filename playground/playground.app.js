// ------------------------------------------------------------------
// Model: hv-layout
// Path: /playground/playground.app.js
// Creation date 4/8/2026, 3:46:37 PM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "../runtime/rt-base/scaffold.js"


//Imports
import { ApplicationLauncher } from './nodes/launcher/app-launcher.js'
import { ColumnMainFactory,
		 SingleTextFieldFactory,
		 MessageBoxFactory,
		 VerticalMenuTabsContent,
		 TabRibbonFactory,
		 VscodeSideMenuFactory,
		 PathRequestFactory,
		 JsonInputFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 TextBlockFactory,
		 DocumentSettingsFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 ConfirmBox } from '../ui-svelte/index.js'
import { Workspace } from './nodes/workspace/factory.js'
import { DocumentManager } from '../core/nodes/document-manager/document-manager.js'
import { ViewManager } from '../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../core/nodes/clipboard/clipboard.js'

//The runtime nodes
const nodeList = [
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "ybxk", 
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
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout", 
	uid: "EQbc", 
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (KBNa)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "vWzR", 
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (EQbc)",
		"file.selected -> doc.selected @ document manager (HPgv)",
		"file.new -> doc.new @ document manager (HPgv)",
		"file.renamed -> doc.renamed @ document manager (HPgv)",
		"file.deleted -> doc.deleted @ document manager (HPgv)",
		"file.get name -> doc.get @ document manager (HPgv)",
		"file.context menu -> ()",
		"files.get list => ()",
		"files.selected -> ()",
		"files.deleted -> ()",
		"folder.context menu -> ()",
		"folder.renamed -> ()",
		"folder.deleted -> ()"
		],
	sx:	{
		    "name": "examples",
		    "files": [],
		    "folders": [
		        {
		            "name": "tutorial",
		            "files": [
		                {
		                    "name": "chat-client.mod.blu"
		                },
		                {
		                    "name": "chat-server.mod.blu"
		                }
		            ]
		        }
		    ]
		}
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field", 
	uid: "ABke", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (vWzR)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "hoQk", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (vWzR)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page", 
	uid: "KBNa", 
	factory: VerticalMenuTabsContent,
	inputs: [
		"-> menu div",
		"-> tabs div",
		"-> content div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content size change -> size change @ view manager (UmCZ)",
		"div -> main area @ column-main layout (EQbc)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "BIFr", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (KBNa)",
		"tab.request to close -> tab.request to close @ document manager (HPgv)",
		"tab.request to select -> tab.request to select @ document manager (HPgv)"
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
	//___________________________________________________SIDE MENU
	{
	name: "side menu", 
	uid: "ORzi", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync -> sync links @ model manager (Ekzs)",
		"accept changes -> accept changes @ model manager (Ekzs)",
		"show settings -> show settings @ model manager (Ekzs)",
		"make app -> make app @ model manager (Ekzs)",
		"make lib -> make lib @ model manager (Ekzs)",
		"set save point -> save point.set @ model manager (Ekzs)",
		"back to save point -> save point.back @ model manager (Ekzs)",
		"recalibrate -> recalibrate @ view manager (UmCZ)",
		"grid on-off -> grid on-off @ view manager (UmCZ)",
		"save -> model.save @ model manager (Ekzs)",
		"save as -> file.save as @ document manager (HPgv)",
		"div -> menu div @ editor page (KBNa)"
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
		    },
		    {
		        "icon": "save",
		        "color": "#0fb2e4",
		        "message": "save",
		        "help": "save"
		    },
		    {
		        "icon": "save_as",
		        "color": "#0fb2e4",
		        "message": "save as",
		        "help": "save as ..."
		    }
		]
	},
	//____________________________________________DOCUMENT MANAGER
	{
	name: "document manager", 
	uid: "HPgv", 
	factory: DocumentManager,
	inputs: [
		"-> tab.request to close",
		"-> tab.request to select",
		"-> doc.selected",
		"-> doc.new",
		"-> doc.renamed",
		"-> doc.deleted",
		"-> doc.get",
		"-> doc.open",
		"-> file.save as"
		],
	outputs: [
		"tab.new -> tab.new @ tab ribbon (BIFr)",
		"tab.rename -> tab.rename @ tab ribbon (BIFr)",
		"tab.select -> tab.select @ tab ribbon (BIFr)",
		"tab.remove -> tab.remove @ tab ribbon (BIFr)",
		`doc.set active -> [ 
			"top level view @ view manager (UmCZ)",
			"model.set @ model manager (Ekzs)" ]`,
		"file.save -> model.save @ model manager (Ekzs)",
		"file.save as filename -> path @ path request (mmAU)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "UmCZ", 
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> top level view",
		"-> recalibrate",
		"-> grid on-off",
		"-> size change"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (Ekzs)",
		"redox.undo -> redox.undo @ model manager (Ekzs)",
		"redox.redo -> redox.redo @ model manager (Ekzs)",
		"canvas -> content div @ editor page (KBNa)",
		"node settings (sx) -> json @ node settings (GIjD)",
		"runtime settings (dx) -> show @ runtime settings (byMp)",
		"node prompt -> text @ text block (qyJj)",
		"context menu -> context menu @ context menu (zdtO)",
		"name and path -> name and path @ name and path (bJRO)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (BpJp)",
		"clipboard.set -> set @ clipboard (BpJp)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "Ekzs", 
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
		"save point.confirm -> show @ confirm box (OHFs)",
		"model.root -> root @ view manager (UmCZ)",
		"model.header -> show @ doc settings (QXrA)",
		"redox.done -> redox.done @ view manager (UmCZ)",
		"pin profile -> show @ pin profile (vmAb)",
		"get path -> path @ path request (mmAU)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "BpJp", 
	factory: Clipboard,
	inputs: [
		"-> set",
		"=> get",
		"-> switched",
		"=> local"
		],
	outputs: [
		"switch -> ()",
		"remote => ()"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request", 
	uid: "mmAU", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (vWzR)",
		"modal div -> modal div @ editor page (KBNa)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "GIjD", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "bJRO", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)",
		"folder.get => folder.get @ workspace (vWzR)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "vmAb", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "qyJj", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "QXrA", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "zdtO", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "byMp", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "OHFs", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (KBNa)"
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
