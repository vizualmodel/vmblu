// ------------------------------------------------------------------
// Model: hv-layout
// Path: /playground/model/playground.app.js
// Creation date 5/8/2026, 11:28:25 AM
// ------------------------------------------------------------------

// import the runtime code
import * as VMBLU from "@vizualmodel/vmblu-runtime/rt-agent"


//Imports
import { ApplicationLauncher } from '../nodes/launcher/app-launcher.js'
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
		 ConfirmBox,
		 PinToolFactory,
		 PinEventFactory } from '../../ui-svelte/index.js'
import { Workspace } from '../nodes/workspace/factory.js'
import { DocumentManager } from '../../core/nodes/document-manager/document-manager.js'
import { ViewManager } from '../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../core/nodes/clipboard/clipboard.js'

// Agent runtime sidecars
import capabilities from './playground.cap.json' with { type: 'json' }

//The runtime nodes
const nodeList = [
	//________________________________________APPLICATION LAUNCHER
	{
	name: "application launcher", 
	uid: "vKEp", 
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
	uid: "sYiW", 
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (DRUM)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace", 
	uid: "jcYu", 
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.active",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (sYiW)",
		"file.selected -> doc.selected @ document manager (XUTa)",
		"file.new -> doc.new @ document manager (XUTa)",
		"file.renamed -> doc.renamed @ document manager (XUTa)",
		"file.deleted -> doc.deleted @ document manager (XUTa)",
		"file.get name -> doc.get @ document manager (XUTa)",
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
	uid: "IJpq", 
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (jcYu)"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box", 
	uid: "uHbC", 
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (jcYu)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page", 
	uid: "DRUM", 
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
		"content size change -> size change @ view manager (onWn)",
		"div -> main area @ column-main layout (sYiW)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon", 
	uid: "YTRL", 
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (DRUM)",
		"tab.request to close -> tab.request to close @ document manager (XUTa)",
		"tab.request to select -> tab.request to select @ document manager (XUTa)"
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
	uid: "pqsd", 
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync -> sync links @ model manager (HgqY)",
		"accept changes -> accept changes @ model manager (HgqY)",
		"show settings -> show settings @ model manager (HgqY)",
		"make app -> make app @ model manager (HgqY)",
		"make lib -> make lib @ model manager (HgqY)",
		"set save point -> save point.set @ model manager (HgqY)",
		"back to save point -> save point.back @ model manager (HgqY)",
		"recalibrate -> recalibrate @ view manager (onWn)",
		"grid on-off -> grid on-off @ view manager (onWn)",
		"save -> model.save @ model manager (HgqY)",
		"save as -> file.save as @ document manager (XUTa)",
		"div -> menu div @ editor page (DRUM)"
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
	uid: "XUTa", 
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
		"tab.new -> tab.new @ tab ribbon (YTRL)",
		"tab.rename -> tab.rename @ tab ribbon (YTRL)",
		"tab.select -> tab.select @ tab ribbon (YTRL)",
		"tab.remove -> tab.remove @ tab ribbon (YTRL)",
		`doc.set active -> [ 
			"top level view @ view manager (onWn)",
			"model.set @ model manager (HgqY)" ]`,
		"file.save -> model.save @ model manager (HgqY)",
		"file.save as filename -> path @ path request (VlsO)",
		"file.save all -> ()"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager", 
	uid: "onWn", 
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
		"redox.doit -> redox.doit @ model manager (HgqY)",
		"redox.undo -> redox.undo @ model manager (HgqY)",
		"redox.redo -> redox.redo @ model manager (HgqY)",
		"canvas -> content div @ editor page (DRUM)",
		"node settings (sx) -> json @ node settings (ofia)",
		"runtime settings (dx) -> show @ runtime settings (cvWo)",
		"node prompt -> text @ text block (ewuw)",
		"context menu -> context menu @ context menu (tUrf)",
		"name and path -> name and path @ name and path (qgaJ)",
		"open source file -> ()",
		"open model -> ()",
		"clipboard.get => get @ clipboard (vOsS)",
		"clipboard.set -> set @ clipboard (vOsS)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager", 
	uid: "HgqY", 
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
		"save point.confirm -> show @ confirm box (woKL)",
		"model.root -> root @ view manager (onWn)",
		"model.header -> show @ doc settings (xwGz)",
		"redox.done -> redox.done @ view manager (onWn)",
		"event settings -> show @ event settings (IlgC)",
		"tool settings -> show @ tool settings (CgZT)",
		"pin profile -> show @ pin profile (aEEt)",
		"get path -> path @ path request (VlsO)",
		"open source file -> ()",
		"open model -> ()"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard", 
	uid: "vOsS", 
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
	uid: "VlsO", 
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (jcYu)",
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings", 
	uid: "ofia", 
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path", 
	uid: "qgaJ", 
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)",
		"folder.get => folder.get @ workspace (jcYu)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile", 
	uid: "aEEt", 
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block", 
	uid: "ewuw", 
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings", 
	uid: "xwGz", 
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu", 
	uid: "tUrf", 
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings", 
	uid: "cvWo", 
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box", 
	uid: "woKL", 
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings", 
	uid: "CgZT", 
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings", 
	uid: "IlgC", 
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (DRUM)"
		]
	},
]

// Agent runtime options
const agentRuntimeOptions = {
    capabilities
}

// prepare the runtime
const runtime = VMBLU.scaffold(nodeList, [], agentRuntimeOptions)

// and start the app
runtime.start()
