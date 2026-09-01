// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.0"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:85d37543f356a726"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-browser-agent"


//Imports
import { ColumnMainFactory,
		 SingleTextFieldFactory,
		 VerticalMenuTabsContent,
		 TabRibbonFactory,
		 VscodeSideMenuFactory,
		 ApplicationInspectorFactory,
		 EndpointInspectorFactory,
		 ConnectionInspectorFactory,
		 PathRequestFactory,
		 NodeSettingsFactory,
		 NameAndPathFactory,
		 PinProfileFactory,
		 MarkdownInputFactory,
		 DocumentSettingsFactory,
		 TeamSettingsFactory,
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
import { SysbluView } from '../../sysblu/nodes/sysblu-view/sysblu-view.js'
import { SysbluManager } from '../../sysblu/nodes/sysblu-manager/sysblu-manager.js'

// Runtime sidecars
import capabilities from './playground.cap.json' with { type: 'json' }
import agent from './playground.agent.json' with { type: 'json' }

//The runtime nodes
const nodeList = [
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout",
	uid: "MLII",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (YpSA)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "XZzR",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (MLII)",
		"file.selected -> file.selected @ document manager (hAnJ)",
		"file.new -> file.new @ document manager (hAnJ)",
		"file.renamed -> file.renamed @ document manager (hAnJ)",
		"file.deleted -> file.deleted @ document manager (hAnJ)",
		"file.get name -> file.get @ document manager (hAnJ)",
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
	uid: "LWlV",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"text.failed -> text.failed @ document manager (hAnJ)",
		"text.loaded -> text.loaded @ document manager (hAnJ)",
		"content div -> content.div @ editor page (YpSA)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "fYyP",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (XZzR)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "qOQw",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (YpSA)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "YpSA",
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
		"div -> main area @ column-main layout (MLII)",
		`content.size change -> [ 
			"size change @ view manager (YPXD)",
			"size change @ sysblu view (diei)" ]`
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "Gvnz",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (YpSA)",
		"tab.request to close -> tab.request to close @ document manager (hAnJ)",
		"tab.request to select -> tab.request to select @ document manager (hAnJ)"
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
	uid: "NeYD",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (Vkps)",
		"accept changes -> accept changes @ model manager (Vkps)",
		"wire check -> wire check @ model manager (Vkps)",
		"show settings -> show settings @ model manager (Vkps)",
		"make app -> make app @ model manager (Vkps)",
		"make lib -> make lib @ model manager (Vkps)",
		"set save point -> save point.set @ model manager (Vkps)",
		"back to save point -> save point.back @ model manager (Vkps)",
		"recalibrate -> recalibrate @ view manager (YPXD)",
		"grid on-off -> grid on-off @ view manager (YPXD)",
		"application prompt -> application prompt @ view manager (YPXD)",
		`save -> [ 
			"model.save @ model manager (Vkps)",
			"file.save active @ document manager (hAnJ)" ]`,
		"save as -> file.save as @ document manager (hAnJ)",
		"div -> menu div @ model pane (qOQw)"
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
	uid: "hAnJ",
	factory: DocumentManager,
	inputs: [
		"-> tab.request to close",
		"-> tab.request to select",
		"-> file.selected",
		"-> file.new",
		"-> file.renamed",
		"-> file.deleted",
		"-> file.get",
		"-> file.open",
		"-> file.save active",
		"-> file.save as",
		"-> model.loaded",
		"-> model.failed",
		"-> sysblu.loaded",
		"-> sysblu.failed",
		"-> text.loaded",
		"-> text.failed"
		],
	outputs: [
		"tab.new -> tab.new @ tab ribbon (Gvnz)",
		"tab.rename -> tab.rename @ tab ribbon (Gvnz)",
		"tab.select -> tab.select @ tab ribbon (Gvnz)",
		"tab.remove -> tab.remove @ tab ribbon (Gvnz)",
		"file.save as filename -> path @ path request (pyFX)",
		"file.save all -> ()",
		"file.loading -> content.loading @ editor page (YpSA)",
		"file.loaded -> content.loaded @ editor page (YpSA)",
		"file.failed -> content.failed @ editor page (YpSA)",
		`model.set active -> [ 
			"top level view @ view manager (YPXD)",
			"model.set @ model manager (Vkps)" ]`,
		"model.save -> model.save @ model manager (Vkps)",
		"sysblu.save -> sysblu.save @ sysblu manager (IzbL)",
		"sysblu.set active -> sysblu.set @ sysblu manager (IzbL)",
		"text.save -> text.save @ text editor (LWlV)",
		"text.set active -> text.set active @ text editor (LWlV)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "YPXD",
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
		"redox.doit -> redox.doit @ model manager (Vkps)",
		"redox.undo -> redox.undo @ model manager (Vkps)",
		"redox.redo -> redox.redo @ model manager (Vkps)",
		"team legend -> teams @ team legend (fMEG)",
		"canvas -> canvas @ model pane (qOQw)",
		"node settings (sx) -> show @ node settings (Mlwt)",
		"runtime settings (dx) -> show @ runtime settings (BSpH)",
		"node prompt -> markdown @ markdown input (ZoqP)",
		"context menu -> context menu @ context menu (fAVb)",
		"name and path -> name and path @ name and path (APsK)",
		"open source file -> file.open @ document manager (hAnJ)",
		"open model -> file.open @ document manager (hAnJ)",
		"clipboard.get => get @ clipboard (oWds)",
		"clipboard.set -> set @ clipboard (oWds)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "Vkps",
	factory: ModelManager,
	inputs: [
		"-> sync model",
		"-> accept changes",
		"-> wire check",
		"-> show settings",
		"-> make app",
		"-> make lib",
		"-> auto layout",
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
		"save point.confirm -> show @ confirm box (foZC)",
		"model.root -> root @ view manager (YPXD)",
		"model.header -> show @ doc settings (aSSl)",
		"model.loaded -> model.loaded @ document manager (hAnJ)",
		"model.failed -> model.failed @ document manager (hAnJ)",
		"redox.done -> redox.done @ view manager (YPXD)",
		"event settings -> show @ event settings (KwqA)",
		"tool settings -> show @ tool settings (UsIu)",
		"pin profile -> show @ pin profile (eZmF)",
		"info popup -> show @ toast box (Ijgp)",
		"get path -> path @ path request (pyFX)",
		"open source file -> file.open @ document manager (hAnJ)",
		"open model -> file.open @ document manager (hAnJ)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "oWds",
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
	//_________________________________________________SYSBLU VIEW
	{
	name: "sysblu view",
	uid: "diei",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ sysblu pane (qXeA)",
		"application settings -> application settings @ application inspector (mKir)",
		"endpoint settings -> endpoint settings @ endpoint inspector (juSZ)",
		"connection settings -> connection settings @ connection inspector (SRme)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (IzbL)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (IzbL)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (IzbL)",
		"open reference -> file.open @ document manager (hAnJ)",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "IzbL",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ document manager (hAnJ)",
		"sysblu.failed -> sysblu.failed @ document manager (hAnJ)",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (diei)",
		"sysmod.done -> sysmod.done @ sysblu view (diei)"
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "mKir",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "juSZ",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "SRme",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "pyFX",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)",
		"folder.get => folder.get @ workspace (XZzR)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "Mlwt",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "APsK",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (XZzR)",
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "eZmF",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (ZoqP)",
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "ZoqP",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "aSSl",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)",
		"agent settings -> show @ agent settings (FRbw)",
		"model runtime settings -> show @ model runtime settings (ibzY)",
		"team settings -> show @ team settings (gdOi)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "gdOi",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "ibzY",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "FRbw",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "fAVb",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (foZC)",
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "BSpH",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "foZC",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "UsIu",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "KwqA",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "Ijgp",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (YpSA)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "fMEG",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (qOQw)"
		]
	},
	//_________________________________________________SYSBLU PANE
	{
	name: "sysblu pane",
	uid: "qXeA",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (YpSA)"
		]
	},
	//_________________________________________________SYSBLU MENU
	{
	name: "sysblu menu",
	uid: "WSjr",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ sysblu pane (qXeA)",
		"save -> file.save active @ document manager (hAnJ)",
		"application prompt -> application prompt @ sysblu view (diei)",
		"add application -> add application @ sysblu view (diei)"
		],
	sx:	[
		    {
		        "icon": "add_box",
		        "color": "#0fb2e4",
		        "message": "add application",
		        "help": "Add application"
		    },
		    {
		        "icon": "comment",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Application prompt"
		    },
		    {
		        "icon": "save",
		        "color": "#0fb2e4",
		        "message": "save",
		        "help": "Save system"
		    }
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.0","schemaVersion":"1.12.0"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
