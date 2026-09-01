// ------------------------------------------------------------------
// Model: 
// @vmblu-generated {"generated":true,"artifact":"application","compatibilityFamily":"1.12","schemaVersion":"1.12.0","generator":{"name":"@vizualmodel/vmblu-core","version":"1.12.0"},"source":{"model":"ui-svelte.mod.blu","hash":"fnv1a64:0b8f5cdea7b127d5"}}
// ------------------------------------------------------------------

// import the runtime code
import {Runtime} from "@vizualmodel/vmblu-runtime/rt-base"


//Imports
import { ApplicationInspectorFactory,
		 EndpointInspectorFactory,
		 ConnectionInspectorFactory,
		 ContextMenuFactory,
		 PathRequestFactory,
		 SingleTextFieldFactory,
		 MessageBoxFactory,
		 ToastBoxFactory,
		 JsonInputFactory,
		 NodeSettingsFactory,
		 TextBlockFactory,
		 NodeSelectorFactory,
		 NameAndPathFactory,
		 DocumentSettingsFactory,
		 TeamSettingsFactory,
		 ModelRuntimeSettingsFactory,
		 AgentSettingsFactory,
		 ConfirmBox,
		 RuntimeSettingsFactory,
		 PinProfileFactory,
		 PinToolFactory,
		 PinEventFactory,
		 MarkdownInputFactory,
		 CanvasLayoutFactory,
		 MenuTabsWindow,
		 LeftMenuLayoutFactory,
		 ColumnMainFactory,
		 VerticalMenuTabsContent,
		 TabRibbonFactory,
		 TopMenuFactory,
		 SideMenuFactory,
		 VscodeSideMenuFactory,
		 TeamLegendFactory } from '../index.js'



//The runtime nodes
const nodeList = [
	//_______________________________________APPLICATION INSPECTOR
	{
	name: "application inspector",
	uid: "IGot",
	factory: ApplicationInspectorFactory,
	inputs: [
		"-> application settings"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//__________________________________________ENDPOINT INSPECTOR
	{
	name: "endpoint inspector",
	uid: "kBqV",
	factory: EndpointInspectorFactory,
	inputs: [
		"-> endpoint settings"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//________________________________________CONNECTION INSPECTOR
	{
	name: "connection inspector",
	uid: "iQGy",
	factory: ConnectionInspectorFactory,
	inputs: [
		"-> connection settings"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//________________________________________________CONTEXT MENU
	{
	name: "context menu",
	uid: "beTl",
	factory: ContextMenuFactory,
	inputs: [
		"-> context menu"
		],
	outputs: [
		"confirm -> ()",
		"modal div -> ()"
		]
	},
	//________________________________________________PATH REQUEST
	{
	name: "path request",
	uid: "HoUM",
	factory: PathRequestFactory,
	inputs: [
		"-> path"
		],
	outputs: [
		"modal div -> ()",
		"folder.get => ()"
		]
	},
	//___________________________________________SINGLE TEXT FIELD
	{
	name: "single text field",
	uid: "HHmN",
	factory: SingleTextFieldFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_________________________________________________MESSAGE BOX
	{
	name: "message box",
	uid: "CQTf",
	factory: MessageBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//___________________________________________________TOAST BOX
	{
	name: "toast box",
	uid: "ThIM",
	factory: ToastBoxFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//__________________________________________________JSON INPUT
	{
	name: "json input",
	uid: "WgCA",
	factory: JsonInputFactory,
	inputs: [
		"-> json"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_______________________________________________NODE SETTINGS
	{
	name: "node settings",
	uid: "PvCh",
	factory: NodeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//__________________________________________________TEXT BLOCK
	{
	name: "text block",
	uid: "gdAM",
	factory: TextBlockFactory,
	inputs: [
		"-> text"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_______________________________________________NODE SELECTOR
	{
	name: "node selector",
	uid: "FxUt",
	factory: NodeSelectorFactory,
	inputs: [
		"-> build table",
		"-> show"
		],
	outputs: [
		"selected node -> ()",
		"get path -> ()",
		"add file -> ()",
		"remove file -> ()",
		"modal div -> ()"
		]
	},
	//_______________________________________________NAME AND PATH
	{
	name: "name and path",
	uid: "MEhv",
	factory: NameAndPathFactory,
	inputs: [
		"-> name and path"
		],
	outputs: [
		"modal div -> ()",
		"folder.get => ()"
		]
	},
	//___________________________________________DOCUMENT SETTINGS
	{
	name: "document settings",
	uid: "iaAN",
	factory: DocumentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()",
		"model runtime settings -> ()",
		"team settings -> ()",
		"agent settings -> ()"
		]
	},
	//_______________________________________________TEAM SETTINGS
	{
	name: "team settings",
	uid: "cbzU",
	factory: TeamSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//______________________________________MODEL RUNTIME SETTINGS
	{
	name: "model runtime settings",
	uid: "EvXr",
	factory: ModelRuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//______________________________________________AGENT SETTINGS
	{
	name: "agent settings",
	uid: "bLgh",
	factory: AgentSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_________________________________________________CONFIRM BOX
	{
	name: "confirm box",
	uid: "chhc",
	factory: ConfirmBox,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//____________________________________________RUNTIME SETTINGS
	{
	name: "runtime settings",
	uid: "XpuT",
	factory: RuntimeSettingsFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_________________________________________________PIN PROFILE
	{
	name: "pin profile",
	uid: "hyXR",
	factory: PinProfileFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()",
		"pin prompt -> ()"
		]
	},
	//_______________________________________________TOOL SETTINGS
	{
	name: "tool settings",
	uid: "gWTH",
	factory: PinToolFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//______________________________________________EVENT SETTINGS
	{
	name: "event settings",
	uid: "OGVR",
	factory: PinEventFactory,
	inputs: [
		"-> show"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//______________________________________________MARKDOWN INPUT
	{
	name: "markdown input",
	uid: "IYMX",
	factory: MarkdownInputFactory,
	inputs: [
		"-> markdown"
		],
	outputs: [
		"modal div -> ()"
		]
	},
	//_______________________________________________CANVAS LAYOUT
	{
	name: "canvas layout",
	uid: "WDKy",
	factory: CanvasLayoutFactory,
	inputs: [
		"-> menu",
		"-> tab ribbon",
		"-> workspace",
		"-> canvas",
		"-> modal div"
		],
	outputs: [
		"canvas size change -> ()"
		]
	},
	//____________________________________________MENU TABS WINDOW
	{
	name: "menu tabs window",
	uid: "EEGG",
	factory: MenuTabsWindow,
	inputs: [
		"-> menu div",
		"-> tabs div",
		"-> content div",
		"-> legend div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content size change -> ()",
		"div -> ()"
		]
	},
	//____________________________________________LEFT MENU LAYOUT
	{
	name: "left menu layout",
	uid: "BtrJ",
	factory: LeftMenuLayoutFactory,
	inputs: [
		"-> left menu",
		"-> left column",
		"-> area one",
		"-> area two",
		"-> vertical",
		"-> horizontal"
		],
	outputs: [
		"size change -> ()"
		]
	},
	//__________________________________________COLUMN-MAIN LAYOUT
	{
	name: "column-main layout",
	uid: "RTEo",
	factory: ColumnMainFactory,
	inputs: [
		"-> left column",
		"-> main area"
		],
	outputs: [
		"size change -> ()"
		]
	},
	//__________________________________VERTICAL MENU TABS CONTENT
	{
	name: "vertical menu tabs content",
	uid: "yhnA",
	factory: VerticalMenuTabsContent,
	inputs: [
		"-> content.div",
		"-> content.loading",
		"-> content.loaded",
		"-> content.failed",
		"-> tabs div",
		"-> modal div",
		"-> show",
		"-> size change"
		],
	outputs: [
		"content.size change -> ()",
		"div -> ()"
		]
	},
	//__________________________________________________TAB RIBBON
	{
	name: "tab ribbon",
	uid: "ECbu",
	factory: TabRibbonFactory,
	inputs: [
		"-> tab.new",
		"-> tab.rename",
		"-> tab.select",
		"-> tab.remove"
		],
	outputs: [
		"div -> ()",
		"tab.request to close -> ()",
		"tab.request to select -> ()"
		]
	},
	//________________________________________________OLD TOP MENU
	{
	name: "old top menu",
	uid: "njci",
	factory: TopMenuFactory,
	inputs: [],
	outputs: [
		"save -> ()",
		"save as -> ()",
		"save all -> ()",
		"accept changes -> ()",
		"sync -> ()",
		"recalibrate -> ()",
		"make app page -> ()",
		"make build lib -> ()",
		"analyze model -> ()",
		"run app page -> ()",
		"run app in iframe -> ()",
		"vertical -> ()",
		"horizontal -> ()",
		"show code editor -> ()",
		"div -> ()"
		]
	},
	//____________________________________________________TOP MENU
	{
	name: "top menu",
	uid: "Zqpc",
	factory: TopMenuFactory,
	inputs: [],
	outputs: [
		"save -> ()",
		"save as -> ()",
		"save all -> ()",
		"accept changes -> ()",
		"sync -> ()",
		"recalibrate -> ()",
		"grid on-off -> ()",
		"make app page -> ()",
		"make build lib -> ()",
		"run app page -> ()",
		"run app in iframe -> ()",
		"show settings -> ()",
		"set save point -> ()",
		"back to save point -> ()",
		"div -> ()"
		]
	},
	//___________________________________________________SIDE MENU
	{
	name: "side menu",
	uid: "awtC",
	factory: SideMenuFactory,
	inputs: [],
	outputs: [
		"vertical -> ()",
		"horizontal -> ()",
		"show code editor -> ()",
		"show app -> ()",
		"div -> ()"
		]
	},
	//____________________________________________VSCODE SIDE MENU
	{
	name: "vscode side menu",
	uid: "gLUG",
	factory: VscodeSideMenuFactory,
	inputs: [],
	outputs: [
		"div -> ()",
		"accept changes -> ()",
		"recalibrate -> ()",
		"sync model -> ()",
		"grid on-off -> ()",
		"application prompt -> ()",
		"show settings -> ()",
		"set save point -> ()",
		"back to save point -> ()",
		"make lib -> ()",
		"make app -> ()",
		"wire check -> ()"
		]
	},
	//_________________________________________________TEAM LEGEND
	{
	name: "team legend",
	uid: "OdUp",
	factory: TeamLegendFactory,
	inputs: [
		"-> teams"
		],
	outputs: [
		"div -> ()"
		]
	},
]

// Runtime options
const runtimeOptions = {
    vmblu: {"compatibilityFamily":"1.12","generatorVersion":"1.12.0","schemaVersion":"1.12.0"}
}

// prepare the runtime
const runtime = new Runtime(nodeList, runtimeOptions)

// and start the app
runtime.start()
