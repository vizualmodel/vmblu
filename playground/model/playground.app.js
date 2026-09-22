// ------------------------------------------------------------------
// Model: hv-layout
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.4","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.4"},"source":{"model":"playground.mod.blu","hash":"fnv1a64:92ba7b42dab93640"}}
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
	uid: "MKEX",
	factory: ColumnMainFactory,
	inputs: [
		"-> main area",
		"-> left column"
		],
	outputs: [
		"size change -> size change @ editor page (UMKc)"
		]
	},
	//___________________________________________________WORKSPACE
	{
	name: "workspace",
	uid: "cBDa",
	factory: Workspace,
	inputs: [
		"-> dom.add modal div",
		"-> file.savedAs",
		"-> file.closed",
		"=> folder.get"
		],
	outputs: [
		"dom.workspace div -> left column @ column-main layout (MKEX)",
		"file.selected -> file.selected @ document manager (ZaQr)",
		"file.new -> file.new @ document manager (ZaQr)",
		"file.renamed -> file.renamed @ document manager (ZaQr)",
		"file.deleted -> file.deleted @ document manager (ZaQr)",
		"file.get name -> file.get @ document manager (ZaQr)",
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
	uid: "fknO",
	factory: TextEditor,
	inputs: [
		"-> text.set active",
		"-> text.save"
		],
	outputs: [
		"text.failed -> text.failed @ document manager (ZaQr)",
		"text.loaded -> text.loaded @ document manager (ZaQr)",
		"content div -> content.div @ editor page (UMKc)"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "kQFl",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> dom.add modal div @ workspace (cBDa)"
		]
	},
	//__________________________________________________MODEL PANE
	{
	name: "model pane",
	uid: "POXe",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (UMKc)"
		]
	},
	//_________________________________________________EDITOR PAGE
	{
	name: "editor page",
	uid: "UMKc",
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
		"div -> main area @ column-main layout (MKEX)",
		`content.size change -> [ 
			"size change @ view manager (hymK)",
			"size change @ sysblu view (ygJq)" ]`
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "HZRf",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> tabs div @ editor page (UMKc)",
		"tab.request to close -> tab.request to close @ document manager (ZaQr)",
		"tab.request to select -> tab.request to select @ document manager (ZaQr)"
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
	uid: "eorH",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"sync model -> sync model @ model manager (gect)",
		"accept changes -> accept changes @ model manager (gect)",
		"wire check -> wire check @ model manager (gect)",
		"show settings -> show settings @ model manager (gect)",
		"make app -> make app @ model manager (gect)",
		"make lib -> make lib @ model manager (gect)",
		"set save point -> save point.set @ model manager (gect)",
		"back to save point -> save point.back @ model manager (gect)",
		"recalibrate -> recalibrate @ view manager (hymK)",
		"grid on-off -> grid on-off @ view manager (hymK)",
		"application prompt -> application prompt @ view manager (hymK)",
		`save -> [ 
			"model.save @ model manager (gect)",
			"file.save active @ document manager (ZaQr)" ]`,
		"save as -> file.save as @ document manager (ZaQr)",
		"div -> menu div @ model pane (POXe)"
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
	uid: "ZaQr",
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
		"tab.new -> tab.new @ tab ribbon (HZRf)",
		"tab.rename -> tab.rename @ tab ribbon (HZRf)",
		"tab.select -> tab.select @ tab ribbon (HZRf)",
		"tab.remove -> tab.remove @ tab ribbon (HZRf)",
		"file.save as filename -> path @ path request (ioEE)",
		"file.save all -> ()",
		"file.loading -> content.loading @ editor page (UMKc)",
		"file.loaded -> content.loaded @ editor page (UMKc)",
		"file.failed -> content.failed @ editor page (UMKc)",
		`model.set active -> [ 
			"top level view @ view manager (hymK)",
			"model.set @ model manager (gect)" ]`,
		"model.save -> model.save @ model manager (gect)",
		"sysblu.save -> sysblu.save @ sysblu manager (MycT)",
		"sysblu.set active -> sysblu.set @ sysblu manager (MycT)",
		"text.save -> text.save @ text editor (fknO)",
		"text.set active -> text.set active @ text editor (fknO)"
		]
	},
	//________________________________________________VIEW MANAGER
	{
	name: "view manager",
	uid: "hymK",
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
		"redox.doit -> redox.doit @ model manager (gect)",
		"redox.undo -> redox.undo @ model manager (gect)",
		"redox.redo -> redox.redo @ model manager (gect)",
		"team legend -> teams @ team legend (kSNR)",
		"canvas -> canvas @ model pane (POXe)",
		"node settings (sx) -> show @ node settings (WrhS)",
		"runtime settings (dx) -> show @ runtime settings (jMNT)",
		"node prompt -> markdown @ markdown input (XBRf)",
		"context menu -> context menu @ context menu (eqCe)",
		"name and path -> name and path @ name and path (xfhl)",
		"open source file -> file.open @ document manager (ZaQr)",
		"open model -> file.open @ document manager (ZaQr)",
		"clipboard.get => get @ clipboard (BwXv)",
		"clipboard.set -> set @ clipboard (BwXv)"
		]
	},
	//_______________________________________________MODEL MANAGER
	{
	name: "model manager",
	uid: "gect",
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
		"save point.confirm -> show @ confirm box (NRrT)",
		"model.root -> root @ view manager (hymK)",
		"model.header -> show @ doc settings (tQKA)",
		"model.loaded -> model.loaded @ document manager (ZaQr)",
		"model.failed -> model.failed @ document manager (ZaQr)",
		"redox.done -> redox.done @ view manager (hymK)",
		"event settings -> show @ event settings (Ogex)",
		"tool settings -> show @ tool settings (qVJr)",
		"pin profile -> show @ pin profile (VliK)",
		"info popup -> show @ toast box (YWla)",
		"get path -> path @ path request (ioEE)",
		"open source file -> file.open @ document manager (ZaQr)",
		"open model -> file.open @ document manager (ZaQr)"
		]
	},
	//___________________________________________________CLIPBOARD
	{
	name: "clipboard",
	uid: "BwXv",
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
	uid: "ygJq",
	factory: SysbluView,
	inputs: [
		"-> size change",
		"-> application prompt",
		"-> add application",
		"-> system.updated",
		"-> sysmod.done"
		],
	outputs: [
		"canvas -> canvas @ sysblu pane (PibB)",
		"application settings -> application settings @ application inspector (PqGh)",
		"endpoint settings -> endpoint settings @ endpoint inspector (DQsq)",
		"connection settings -> connection settings @ connection inspector (gEzo)",
		"project references -> project references @ project references (KgxY)",
		"sysmod.doit -> sysmod.doit @ sysblu manager (MycT)",
		"sysmod.undo -> sysmod.undo @ sysblu manager (MycT)",
		"sysmod.redo -> sysmod.redo @ sysblu manager (MycT)",
		"open reference -> file.open @ document manager (ZaQr)",
		"execute command -> ()"
		]
	},
	//______________________________________________SYSBLU MANAGER
	{
	name: "sysblu manager",
	uid: "MycT",
	factory: SysbluManager,
	inputs: [
		"-> sysblu.set",
		"-> sysblu.save",
		"-> sysmod.doit",
		"-> sysmod.undo",
		"-> sysmod.redo"
		],
	outputs: [
		"sysblu.loaded -> sysblu.loaded @ document manager (ZaQr)",
		"sysblu.failed -> sysblu.failed @ document manager (ZaQr)",
		"sysblu.diagnostics -> ()",
		"system.updated -> system.updated @ sysblu view (ygJq)",
		"sysmod.done -> sysmod.done @ sysblu view (ygJq)"
		]
	},
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "PqGh",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "DQsq",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "gEzo",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//__________________________________________PROJECT REFERENCES
	{
	name: "project references",
	uid: "KgxY",
	factory: ProjectReferencesFactory,
	inputs: [
		"-> project references"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "ioEE",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)",
		"folder.get => folder.get @ workspace (cBDa)"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "WrhS",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "xfhl",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"folder.get => folder.get @ workspace (cBDa)",
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "VliK",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"pin prompt -> markdown @ markdown input (XBRf)",
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "XBRf",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		],
	sx:	{
		    "openPromptFile": true
		}
	},
	//________________________________________________DOC SETTINGS
	{
	name: "doc settings",
	uid: "tQKA",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)",
		"team settings -> show @ team settings (rUbH)",
		"agent settings -> show @ agent settings (slWY)",
		"model runtime settings -> show @ model runtime settings (fQgD)"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "rUbH",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "fQgD",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "slWY",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "eqCe",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> show @ confirm box (NRrT)",
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "jMNT",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "NRrT",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "qVJr",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "Ogex",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "YWla",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> modal div @ editor page (UMKc)"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "kSNR",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> legend div @ model pane (POXe)"
		]
	},
	//_________________________________________________SYSBLU PANE
	{
	name: "sysblu pane",
	uid: "PibB",
	factory: ModelPane,
	inputs: [
		"-> menu div",
		"-> legend div",
		"-> canvas"
		],
	outputs: [
		"content div -> content.div @ editor page (UMKc)"
		]
	},
	//_________________________________________________SYSBLU MENU
	{
	name: "sysblu menu",
	uid: "QXuq",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> menu div @ sysblu pane (PibB)",
		"save -> file.save active @ document manager (ZaQr)",
		"application prompt -> application prompt @ sysblu view (ygJq)",
		"add application -> add application @ sysblu view (ygJq)"
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
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.4","schemaVersion":"1.12.4"},
    capabilities,
    agent
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
