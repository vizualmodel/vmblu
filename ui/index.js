import {mount} from 'svelte'

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
import WindowLayout from './layouts/menu-tabs-window.svelte'
export const MenuTabsWindow = getFactory(WindowLayout)

// The menu tabs window node
import VerticalMenuTabsContentSvelte from './layouts/vertical-menu-tabs-content.svelte'
export const VerticalMenuTabsContent = getFactory(VerticalMenuTabsContentSvelte)

// The canvas layout factory
import CanvasLayout from './layouts/canvas-layout.svelte'
export const CanvasLayoutFactory = getFactory(CanvasLayout, document.body)

// a layout with a left menu, a workspace and a window
import LeftMenuLayout from './layouts/left-menu-layout.svelte'
export const LeftMenuLayoutFactory = getFactory(LeftMenuLayout, document.body)

// a simple layout with a menu on the left
import ColumnMainSvelte from './layouts/column-main.svelte'
export const ColumnMainFactory = getFactory(ColumnMainSvelte, document.body)

/* 
 * MENUS, TABS
*/

import TopMenuSvelte from './menus-tabs-widgets/top-menu.svelte'
export const TopMenuFactory = getFactory(TopMenuSvelte)

import SideMenuSvelte from './menus-tabs-widgets/side-menu.svelte'
export const SideMenuFactory = getFactory(SideMenuSvelte)

import TabRibbonSvelte from './menus-tabs-widgets/tab-ribbon.svelte'
export const TabRibbonFactory = getFactory(TabRibbonSvelte)

import VscodeSideMenuSvelte from './menus-tabs-widgets/vscode-side-menu.svelte'
export  const VscodeSideMenuFactory = getFactory(VscodeSideMenuSvelte)

/* 
 * POPUPS
*/

// The runtime settings node factory
import RuntimeSettingsSvelte from './popups/runtime-settings.svelte'
export const RuntimeSettingsFactory = getFactory(RuntimeSettingsSvelte)

import ConfirmBoxSvelte from './popups/confirm-box.svelte'
export const ConfirmBox = getFactory(ConfirmBoxSvelte)

import ContextMenu from './popups/context-menu.svelte'
export const ContextMenuFactory = getFactory(ContextMenu)

import JsonAreaInputSvelte from './popups/json-area-input.svelte'
export const JsonInputFactory = getFactory(JsonAreaInputSvelte)

import TextAreaInputSvelte from './popups/text-area-input.svelte'
export const TextBlockFactory = getFactory(TextAreaInputSvelte)

import PinProfileSvelte from './popups/pin-profile.svelte'
export const PinProfileFactory = getFactory(PinProfileSvelte)

import MessageBoxSvelte from './popups/message-box.svelte'
export const MessageBoxFactory = getFactory(MessageBoxSvelte)

import NameAndPathSvelte from './popups/name-path.svelte'
export const NameAndPathFactory = getFactory(NameAndPathSvelte)

import PathSvelte from './popups/path.svelte'
export const PathRequestFactory = getFactory(PathSvelte)

import SingleTextFieldSvelte from './popups/single-text-field.svelte'
export const SingleTextFieldFactory = getFactory(SingleTextFieldSvelte)

import DocumentSettingsSvelte from './popups/document-settings.svelte'
export const DocumentSettingsFactory = getFactory(DocumentSettingsSvelte)

import NodeSelectorSvelte from './popups/node-selector.svelte'
export const NodeSelectorFactory = getFactory(NodeSelectorSvelte)


