// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.5","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.5"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:df81aae5361baa81"}}
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
		 ProjectReferencesFactory,
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
	uid: "ENGX",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (FPTD)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "BNNs",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (ENGX)",
		"file.selected -> file.selected @ document manager (rVHo)",
		"file.new -> file.new @ document manager (rVHo)",
		"file.renamed -> file.renamed @ document manager (rVHo)",
		"file.deleted -> file.deleted @ document manager (rVHo)",
		"file.get name -> file.get @ document manager (rVHo)",
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
		        "repository": "vmblu-tutorials",
		        "ref": "main",
		        "label": "Tutorials",
		        "readOnly": true
		    }
		}
	},
	//_________________________________________________TEXT EDITOR
	{
	name: "text editor",
	uid: "OuNS",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"text.failed -> text.failed @ document manager (rVHo)",
		"text.loaded -> text.loaded @ document manager (rVHo)",
		"content div -> content.div @ editor page (FPTD)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "Ozkh",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (BNNs)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "DgNV",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (FPTD)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "FPTD",
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
		"div -> main area @ column-main layout (ENGX)",
		`content.size change -> [ 
			"size change @ view manager (WJKl)",
			"size change @ sysblu view (TZFe)" ]`
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "SjDS",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (FPTD)",
		"tab.request to close -> tab.request to close @ document manager (rVHo)",
		"tab.request to select -> tab.request to select @ document manager (rVHo)"
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
	uid: "fXZB",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (pWLp)",
		"accept changes -> accept changes @ model manager (pWLp)",
		"wire check -> wire check @ model manager (pWLp)",
		"show settings -> show settings @ model manager (pWLp)",
		"make app -> make app @ model manager (pWLp)",
		"make lib -> make lib @ model manager (pWLp)",
		"set save point -> save point.set @ model manager (pWLp)",
		"back to save point -> save point.back @ model manager (pWLp)",
		"recalibrate -> recalibrate @ view manager (WJKl)",
		"grid on-off -> grid on-off @ view manager (WJKl)",
		"application prompt -> application prompt @ view manager (WJKl)",
		`save -> [ 
			"model.save @ model manager (pWLp)",
			"file.save active @ document manager (rVHo)" ]`,
		"save as -> file.save as @ document manager (rVHo)",
		"div -> menu div @ model pane (DgNV)"
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
	uid: "rVHo",
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
		"tab.new -> tab.new @ tab ribbon (SjDS)",
		"tab.rename -> tab.rename @ tab ribbon (SjDS)",
		"tab.select -> tab.select @ tab ribbon (SjDS)",
		"tab.remove -> tab.remove @ tab ribbon (SjDS)",
		"file.save as filename -> path @ path request (ERhA)",
		"file.save all -> ()",
		"file.loading -> content.loading @ editor page (FPTD)",
		"file.loaded -> content.loaded @ editor page (FPTD)",
		"file.failed -> content.failed @ editor page (FPTD)",
		`model.set active -> [ 
			"top level view @ view manager (WJKl)",
			"model.set @ model manager (pWLp)" ]`,
		"model.save -> model.save @ model manager (pWLp)",
		"sysblu.save -> sysblu.save @ sysblu manager (zgKl)",
		"sysblu.set active -> sysblu.set @ sysblu manager (zgKl)",
		"text.save -> text.save @ text editor (OuNS)",
		"text.set active -> text.set active @ text editor (OuNS)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "WJKl",
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
		"redox.doit -> redox.doit @ model manager (pWLp)",
		"redox.undo -> redox.undo @ model manager (pWLp)",
		"redox.redo -> redox.redo @ model manager (pWLp)",
		"team legend -> teams @ team legend (onrc)",
		"canvas -> canvas @ model pane (DgNV)",
		"node settings (sx) -> show @ node settings (xJQl)",
		"runtime settings (dx) -> show @ runtime settings (rPKE)",
		"node prompt -> markdown @ markdown input (IpRb)",
		"context menu -> context menu @ context menu (QUaN)",
		"name and path -> name and path @ name and path (gksg)",
		"open source file -> file.open @ document manager (rVHo)",
		"open model -> file.open @ document manager (rVHo)",
		"clipboard.get => get @ clipboard (QbCj)",
		"clipboard.set -> set @ clipboard (QbCj)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "pWLp",
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
		"save point.confirm -> show @ confirm box (uZRd)",
		"model.root -> root @ view manager (WJKl)",
		"model.header -> show @ doc settings (CHXn)",
		"model.loaded -> model.loaded @ document manager (rVHo)",
		"model.failed -> model.failed @ document manager (rVHo)",
		"redox.done -> redox.done @ view manager (WJKl)",
		"event settings -> show @ event settings (Hkqb)",
		"tool settings -> show @ tool settings (nkLO)",
		"pin profile -> show @ pin profile (KftP)",
		"info popup -> show @ toast box (bLXX)",
		"get path -> path @ path request (ERhA)",
		"open source file -> file.open @ document manager (rVHo)",
		"open model -> file.open @ document manager (rVHo)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "QbCj",
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
	uid: "TZFe",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ sysblu pane (imAr)",
		"application settings -> application settings @ application inspector (fdkg)",
		"endpoint settings -> endpoint settings @ endpoint inspector (WBbG)",
		"connection settings -> connection settings @ connection inspector (ZaxC)",
		"project references -> project references @ project references (Xqca)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (zgKl)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (zgKl)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (zgKl)",
		"open reference -> file.open @ document manager (rVHo)",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "zgKl",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ document manager (rVHo)",
		"sysblu.failed -> sysblu.failed @ document manager (rVHo)",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (TZFe)",
		"sysmod.done -> sysmod.done @ sysblu view (TZFe)"
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "fdkg",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "WBbG",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "ZaxC",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "Xqca",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "ERhA",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)",
		"folder.get => folder.get @ workspace (BNNs)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "xJQl",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "gksg",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (BNNs)",
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "KftP",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (IpRb)",
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "IpRb",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "CHXn",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)",
		"team settings -> show @ team settings (TCfe)",
		"agent settings -> show @ agent settings (jSko)",
		"model runtime settings -> show @ model runtime settings (XfeW)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "TCfe",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "XfeW",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "jSko",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "QUaN",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (uZRd)",
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "rPKE",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "uZRd",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "nkLO",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "Hkqb",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "bLXX",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (FPTD)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "onrc",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (DgNV)"
		]
	},
	//_________________________________________________SYSBLU PANE
	{
	name: "sysblu pane",
	uid: "imAr",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (FPTD)"
		]
	},
	//_________________________________________________SYSBLU MENU
	{
	name: "sysblu menu",
	uid: "csGT",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ sysblu pane (imAr)",
		"save -> file.save active @ document manager (rVHo)",
		"application prompt -> application prompt @ sysblu view (TZFe)",
		"add application -> add application @ sysblu view (TZFe)"
		],
	sx:	[
		    {
		        "icon": "add_box",
		        "color": "#0fb2e4",
		        "message": "add application",
		        "help": "Add application"
		    },
		    {
		        "icon": "folder_open",
		        "color": "#0fb2e4",
		        "message": "application prompt",
		        "help": "Project references"
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
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.5","schemaVersion":"1.12.5"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
