// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.10","schemaVersion":"1.10.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.10.0"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:90bb116be96a3ed3"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-browser-agent"


//Imports
import { ColumnMainFactory,
		 SingleTextFieldFactory,
		 VerticalMenuTabsContent,
		 TabRibbonFactory,
		 VscodeSideMenuFactory,
		 PathRequestFactory,
		 NodeSettingsFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 DocumentSettingsFactory,
		 ModelRuntimeSettingsFactory,
		 AgentSettingsFactory,
		 ContextMenuFactory,
		 RuntimeSettingsFactory,
		 ConfirmBox,
		 PinToolFactory,
		 PinEventFactory,
		 ToastBoxFactory,
		 TeamLegendFactory } from '../../ui-svelte/index.js'
import { Workspace } from '../nodes/workspace/factory.js'
import { TextEditor } from '../nodes/text-editor/text-editor.js'
import { ModelPane } from '../nodes/model-pane/model-pane.js'
import { DocumentManager } from '../../core/nodes/document-manager/document-manager.js'
import { ViewManager } from '../../core/nodes/view-manager/view-manager.js'
import { ModelManager } from '../../core/nodes/model-manager/model-manager.js'
import { Clipboard } from '../../core/nodes/clipboard/clipboard.js'

// Runtime sidecars
import capabilities from './playground.cap.json' with { type: 'json' }
import agent from './playground.agent.json' with { type: 'json' }

//The runtime nodes
const nodeList = [
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout",
	uid: "sUHH",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (LqZQ)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "uvPk",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (sUHH)",
		"file.selected -> doc.selected @ document manager (Htll)",
		"file.new -> doc.new @ document manager (Htll)",
		"file.renamed -> doc.renamed @ document manager (Htll)",
		"file.deleted -> doc.deleted @ document manager (Htll)",
		"file.get name -> doc.get @ document manager (Htll)",
		"file.context menu -> ()",
		"files.get list => ()",
		"files.selected -> ()",
		"files.deleted -> ()",
		"folder.context menu -> ()",
		"folder.renamed -> ()",
		"folder.deleted -> ()"
		],
	sx:	{
		    "remote": {
		        "kind": "github",
		        "owner": "vizualmodel",
		        "repository": "vmblu-examples",
		        "ref": "main",
		        "label": "Examples",
		        "readOnly": true
		    }
		}
	},
	//_________________________________________________TEXT EDITOR
	{
	name: "text editor",
	uid: "LTSG",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"content div -> content.div @ editor page (LqZQ)",
		"text.failed -> text.failed @ document manager (Htll)",
		"text.loaded -> text.loaded @ document manager (Htll)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "OrBf",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (uvPk)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "gygH",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (LqZQ)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "LqZQ",
	factory: VerticalMenuTabsContent,
	inputs: [
		"-> tabs div",
		"-> modal div",
		"-> size change",
		"-> show",
		"-> content.div",
		"-> content.failed",
		"-> content.loaded",
		"-> content.loading"
		],
	outputs: [
		"div -> main area @ column-main layout (sUHH)",
		"content.size change -> size change @ view manager (aCDN)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "HZtn",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (LqZQ)",
		"tab.request to close -> tab.request to close @ document manager (Htll)",
		"tab.request to select -> tab.request to select @ document manager (Htll)"
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
	uid: "QvCU",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (zrTv)",
		"accept changes -> accept changes @ model manager (zrTv)",
		"wire check -> wire check @ model manager (zrTv)",
		"show settings -> show settings @ model manager (zrTv)",
		"make app -> make app @ model manager (zrTv)",
		"make lib -> make lib @ model manager (zrTv)",
		"set save point -> save point.set @ model manager (zrTv)",
		"back to save point -> save point.back @ model manager (zrTv)",
		"recalibrate -> recalibrate @ view manager (aCDN)",
		"grid on-off -> grid on-off @ view manager (aCDN)",
		"application prompt -> application prompt @ view manager (aCDN)",
		`save -> [ 
			"model.save @ model manager (zrTv)",
			"file.save active @ document manager (Htll)" ]`,
		"save as -> file.save as @ document manager (Htll)",
		"div -> menu div @ model pane (gygH)"
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
		        "icon": "comment",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Application prompt"
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
		        "icon": "cable",
		        "color": "#0fb2e4",
		        "message": "wire check",
		        "help": "Wire check"
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
	uid: "Htll",
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
		"-> file.save active",
		"-> file.save as",
		"-> model.loaded",
		"-> model.failed",
		"-> text.loaded",
		"-> text.failed"
		],
	outputs: [
		"tab.new -> tab.new @ tab ribbon (HZtn)",
		"tab.rename -> tab.rename @ tab ribbon (HZtn)",
		"tab.select -> tab.select @ tab ribbon (HZtn)",
		"tab.remove -> tab.remove @ tab ribbon (HZtn)",
		`doc.set active -> [ 
			"top level view @ view manager (aCDN)",
			"model.set @ model manager (zrTv)" ]`,
		"file.loading -> content.loading @ editor page (LqZQ)",
		"file.loaded -> content.loaded @ editor page (LqZQ)",
		"file.failed -> content.failed @ editor page (LqZQ)",
		"file.save -> model.save @ model manager (zrTv)",
		"file.save as filename -> path @ path request (IVXj)",
		"file.save all -> ()",
		"text.save -> text.save @ text editor (LTSG)",
		"text.set active -> text.set active @ text editor (LTSG)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "aCDN",
	factory: ViewManager,
	inputs: [
		"-> redox.done",
		"-> root",
		"-> top level view",
		"-> recalibrate",
		"-> grid on-off",
		"-> application prompt",
		"-> size change"
		],
	outputs: [
		"redox.doit -> redox.doit @ model manager (zrTv)",
		"redox.undo -> redox.undo @ model manager (zrTv)",
		"redox.redo -> redox.redo @ model manager (zrTv)",
		"team legend -> teams @ team legend (FjSY)",
		"canvas -> canvas @ model pane (gygH)",
		"node settings (sx) -> show @ node settings (ZicP)",
		"runtime settings (dx) -> show @ runtime settings (eoLy)",
		"node prompt -> markdown @ markdown input (Wrez)",
		"context menu -> context menu @ context menu (FTbC)",
		"name and path -> name and path @ name and path (KnXs)",
		"open source file -> doc.open @ document manager (Htll)",
		"open model -> doc.open @ document manager (Htll)",
		"clipboard.get => get @ clipboard (IuYk)",
		"clipboard.set -> set @ clipboard (IuYk)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "zrTv",
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
		"-> auto layout",
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
		"save point.confirm -> show @ confirm box (tQRj)",
		"model.root -> root @ view manager (aCDN)",
		"model.header -> show @ doc settings (IIuH)",
		"model.loaded -> model.loaded @ document manager (Htll)",
		"model.failed -> model.failed @ document manager (Htll)",
		"redox.done -> redox.done @ view manager (aCDN)",
		"event settings -> show @ event settings (bTqV)",
		"tool settings -> show @ tool settings (pdmR)",
		"pin profile -> show @ pin profile (hrTw)",
		"info popup -> show @ toast box (cbnY)",
		"get path -> path @ path request (IVXj)",
		"open source file -> doc.open @ document manager (Htll)",
		"open model -> doc.open @ document manager (Htll)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "IuYk",
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
	uid: "IVXj",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)",
		"folder.get => folder.get @ workspace (uvPk)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "ZicP",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "KnXs",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (uvPk)",
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "hrTw",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (Wrez)",
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "Wrez",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "IIuH",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)",
		"agent settings -> show @ agent settings (Qmsc)",
		"model runtime settings -> show @ model runtime settings (dzZH)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "dzZH",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "Qmsc",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "FTbC",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (tQRj)",
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "eoLy",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "tQRj",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "pdmR",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "bTqV",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "cbnY",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (LqZQ)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "FjSY",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (gygH)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.10","generatorVersion":"1.10.0","schemaVersion":"1.10.0"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
