import { mount } from 'svelte'
import './nodes/global.css'

// // Returns a factory function for the svelte component
// function xxgetFactory( svelteDef, htmlTarget=null) {
// 	return function (tx, sx) {

// 		const component = new svelteDef({
// 			target: htmlTarget ?? document.createElement('div'),
// 			props: {
// 				tx, sx, handlers:null
// 			}
// 		})
// 		return component.handlers
// 	}
// }

// returns a factory function for teh sveltecomponent
function getFactory( svelteComponent, htmlTarget=null) {

	return function (tx, sx) {
		const node = mount(svelteComponent, {
			target: htmlTarget ?? document.createElement("div"),
			props: { tx, sx }
		});

		// return the handlers of the cell
		return node.handlers
	}
}

/* 
 * LAYOUTS
*/

// The menu tabs window node
import WindowLayout from './nodes/menu-tabs-window/menu-tabs-window.svelte'
export const MenuTabsWindow = getFactory(WindowLayout)

// The menu tabs window node
import VerticalMenuTabsContentSvelte from './nodes/vertical-menu-tabs-content/vertical-menu-tabs-content.svelte'
export const VerticalMenuTabsContent = getFactory(VerticalMenuTabsContentSvelte)

// The canvas layout factory
import CanvasLayout from './nodes/canvas-layout/canvas-layout.svelte'
export const CanvasLayoutFactory = getFactory(CanvasLayout, document.body)

// a layout with a left menu, a workspace and a window
import LeftMenuLayout from './nodes/left-menu-layout/left-menu-layout.svelte'
export const LeftMenuLayoutFactory = getFactory(LeftMenuLayout, document.body)

// a simple layout with a menu on the left
import ColumnMainSvelte from './nodes/column-main/column-main.svelte'
export const ColumnMainFactory = getFactory(ColumnMainSvelte, document.body)

/* 
 * MENUS, TABS
*/

import TopMenuSvelte from './nodes/top-menu/top-menu.svelte'
export const TopMenuFactory = getFactory(TopMenuSvelte)

import SideMenuSvelte from './nodes/side-menu/side-menu.svelte'
export const SideMenuFactory = getFactory(SideMenuSvelte)

import TabRibbonSvelte from './nodes/tab-ribbon/tab-ribbon.svelte'
export const TabRibbonFactory = getFactory(TabRibbonSvelte)

import VscodeSideMenuSvelte from './nodes/vscode-side-menu/vscode-side-menu.svelte'
export  const VscodeSideMenuFactory = getFactory(VscodeSideMenuSvelte)

/* 
 * POPUPS
*/

// The runtime settings node factory
import RuntimeSettingsSvelte from './nodes/runtime-settings/runtime-settings.svelte'
export const RuntimeSettingsFactory = getFactory(RuntimeSettingsSvelte)

import ModelRuntimeSettingsSvelte from './nodes/model-runtime-settings/model-runtime-settings.svelte'
export const ModelRuntimeSettingsFactory = getFactory(ModelRuntimeSettingsSvelte)

import ConfirmBoxSvelte from './nodes/confirm-box/confirm-box.svelte'
export const ConfirmBox = getFactory(ConfirmBoxSvelte)

import ContextMenu from './nodes/context-menu/context-menu.svelte'
export const ContextMenuFactory = getFactory(ContextMenu)

import JsonAreaInputSvelte from './nodes/json-area-input/json-area-input.svelte'
export const JsonInputFactory = getFactory(JsonAreaInputSvelte)

import TextAreaInputSvelte from './nodes/text-area-input/text-area-input.svelte'
export const TextBlockFactory = getFactory(TextAreaInputSvelte)

import MarkdownInputSvelte from './nodes/markdown-input/markdown-input.svelte'
export const MarkdownInputFactory = getFactory(MarkdownInputSvelte)

import PinProfileSvelte from './nodes/pin-profile/pin-profile.svelte'
export const PinProfileFactory = getFactory(PinProfileSvelte)

import PinToolSvelte from './nodes/pin-tool/pin-tool.svelte'
export const PinToolFactory = getFactory(PinToolSvelte)

import PinEventSvelte from './nodes/pin-event/pin-event.svelte'
export const PinEventFactory = getFactory(PinEventSvelte)

import MessageBoxSvelte from './nodes/message-box/message-box.svelte'
export const MessageBoxFactory = getFactory(MessageBoxSvelte)

import NameAndPathSvelte from './nodes/name-path/name-path.svelte'
export const NameAndPathFactory = getFactory(NameAndPathSvelte)

import PathSvelte from './nodes/path-request/path.svelte'
export const PathRequestFactory = getFactory(PathSvelte)

import SingleTextFieldSvelte from './nodes/single-text-field/single-text-field.svelte'
export const SingleTextFieldFactory = getFactory(SingleTextFieldSvelte)

import DocumentSettingsSvelte from './nodes/document-settings/document-settings.svelte'
export const DocumentSettingsFactory = getFactory(DocumentSettingsSvelte)

import AgentSettingsSvelte from './nodes/agent-settings/agent-settings.svelte'
export const AgentSettingsFactory = getFactory(AgentSettingsSvelte)

import NodeSelectorSvelte from './nodes/node-selector/node-selector.svelte'
export const NodeSelectorFactory = getFactory(NodeSelectorSvelte)
