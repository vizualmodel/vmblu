import ScreenLayoutSvelte from './screen-layout.svelte'
import HelpersSvelte from './right-side/helpers-settings.svelte'
import CamerasSvelte from './right-side/camera-settings.svelte'
import SolarSystemSvelte from './right-side/solar-system-settings.svelte'
import SimulationSvelte from './right-side/simulation-settings.svelte'
import IconMenuHorizontalSvelte from './fragments/icon-menu-horizontal.svelte'
import LLMInterfaceSvelte from './right-side/llm-interface.svelte'

/**
 * @param {any} tx
 * @param {any} sx
 */
export function ScreenLayout(tx, sx) {
	const screen = new ScreenLayoutSvelte(
		{
			target: document.body,
			props: {
				tx, sx
			}
		}
	)
	return screen.handlers
}

export function IconMenuHorizontal(tx, sx) {
	const component = new IconMenuHorizontalSvelte({
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		})
	return component.handlers
}

// The helper settings
export function HelpersSettings(tx, sx) {
	const settings = new HelpersSvelte({
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		})
	return settings.handlers
}

// The cameras settings
export function CamerasSettings(tx, sx) {
	const settings = new CamerasSvelte(
		{
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		}
	)
	return settings.handlers
}

// The solar system settings
export function SolarSystemSettings(tx, sx) {
	const settings = new SolarSystemSvelte(
		{
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		}
	)
	return settings.handlers
}

// The simulation settings
export function SimulationSettings(tx, sx) {
	const settings = new SimulationSvelte(
		{
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		}
	)
	return settings.handlers
}

// The simulation settings
export function LLMChatWindow(tx, sx) {
	const llmWindow = new LLMInterfaceSvelte(
		{
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		}
	)
	return llmWindow.handlers
}

