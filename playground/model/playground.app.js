// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.10","schemaVersion":"1.10.1","generator":{"name":"@vizualmodel/vmblu-core","version":"1.10.1"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:4651db15a9f43dc4"}}
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
	uid: "pXFb",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (ZJcx)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "IYKM",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (pXFb)",
		"file.selected -> doc.selected @ document manager (baJL)",
		"file.new -> doc.new @ document manager (baJL)",
		"file.renamed -> doc.renamed @ document manager (baJL)",
		"file.deleted -> doc.deleted @ document manager (baJL)",
		"file.get name -> doc.get @ document manager (baJL)",
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
	uid: "jIYj",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"content div -> content.div @ editor page (ZJcx)",
		"text.failed -> text.failed @ document manager (baJL)",
		"text.loaded -> text.loaded @ document manager (baJL)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "bhyl",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (IYKM)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "zEwA",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (ZJcx)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "ZJcx",
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
		"div -> main area @ column-main layout (pXFb)",
		"content.size change -> size change @ view manager (uhAk)"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "VQCT",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (ZJcx)",
		"tab.request to close -> tab.request to close @ document manager (baJL)",
		"tab.request to select -> tab.request to select @ document manager (baJL)"
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
	uid: "ffoK",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (uDMs)",
		"accept changes -> accept changes @ model manager (uDMs)",
		"wire check -> wire check @ model manager (uDMs)",
		"show settings -> show settings @ model manager (uDMs)",
		"make app -> make app @ model manager (uDMs)",
		"make lib -> make lib @ model manager (uDMs)",
		"set save point -> save point.set @ model manager (uDMs)",
		"back to save point -> save point.back @ model manager (uDMs)",
		"recalibrate -> recalibrate @ view manager (uhAk)",
		"grid on-off -> grid on-off @ view manager (uhAk)",
		"application prompt -> application prompt @ view manager (uhAk)",
		`save -> [ 
			"model.save @ model manager (uDMs)",
			"file.save active @ document manager (baJL)" ]`,
		"save as -> file.save as @ document manager (baJL)",
		"div -> menu div @ model pane (zEwA)"
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
	uid: "baJL",
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
		"tab.new -> tab.new @ tab ribbon (VQCT)",
		"tab.rename -> tab.rename @ tab ribbon (VQCT)",
		"tab.select -> tab.select @ tab ribbon (VQCT)",
		"tab.remove -> tab.remove @ tab ribbon (VQCT)",
		`doc.set active -> [ 
			"top level view @ view manager (uhAk)",
			"model.set @ model manager (uDMs)" ]`,
		"file.loading -> content.loading @ editor page (ZJcx)",
		"file.loaded -> content.loaded @ editor page (ZJcx)",
		"file.failed -> content.failed @ editor page (ZJcx)",
		"file.save -> model.save @ model manager (uDMs)",
		"file.save as filename -> path @ path request (acew)",
		"file.save all -> ()",
		"text.save -> text.save @ text editor (jIYj)",
		"text.set active -> text.set active @ text editor (jIYj)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "uhAk",
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
		"redox.doit -> redox.doit @ model manager (uDMs)",
		"redox.undo -> redox.undo @ model manager (uDMs)",
		"redox.redo -> redox.redo @ model manager (uDMs)",
		"team legend -> teams @ team legend (pqQV)",
		"canvas -> canvas @ model pane (zEwA)",
		"node settings (sx) -> show @ node settings (axDy)",
		"runtime settings (dx) -> show @ runtime settings (yiFT)",
		"node prompt -> markdown @ markdown input (CFzj)",
		"context menu -> context menu @ context menu (CEKw)",
		"name and path -> name and path @ name and path (vySp)",
		"open source file -> doc.open @ document manager (baJL)",
		"open model -> doc.open @ document manager (baJL)",
		"clipboard.get => get @ clipboard (RBEc)",
		"clipboard.set -> set @ clipboard (RBEc)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "uDMs",
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
		"save point.confirm -> show @ confirm box (zcwN)",
		"model.root -> root @ view manager (uhAk)",
		"model.header -> show @ doc settings (agzq)",
		"model.loaded -> model.loaded @ document manager (baJL)",
		"model.failed -> model.failed @ document manager (baJL)",
		"redox.done -> redox.done @ view manager (uhAk)",
		"event settings -> show @ event settings (ituE)",
		"tool settings -> show @ tool settings (bscp)",
		"pin profile -> show @ pin profile (hthy)",
		"info popup -> show @ toast box (jjfQ)",
		"get path -> path @ path request (acew)",
		"open source file -> doc.open @ document manager (baJL)",
		"open model -> doc.open @ document manager (baJL)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "RBEc",
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
	uid: "acew",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)",
		"folder.get => folder.get @ workspace (IYKM)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "axDy",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "vySp",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (IYKM)",
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "hthy",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (CFzj)",
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "CFzj",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "agzq",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)",
		"agent settings -> show @ agent settings (WHlT)",
		"model runtime settings -> show @ model runtime settings (dLZQ)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "dLZQ",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "WHlT",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "CEKw",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (zcwN)",
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "yiFT",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "zcwN",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "bscp",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "ituE",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "jjfQ",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (ZJcx)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "pqQV",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (zEwA)"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.10","generatorVersion":"1.10.1","schemaVersion":"1.10.1"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
