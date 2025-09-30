export {Star} from './star'
export {Planet} from './planet'
export {Moon} from './moon'
export {Saturn} from './planet-with-rings'
export {HorizonsAPI} from './horizons-api'
export {Ephemerides} from './ephemerides'
export {StudioSettings} from '../3d/studio-settings'
export {StarSphere} from './star-sphere'
export {PlanetRouter} from './planet-router'

// The widget to select on the earth
import SelectOnEarthSvelte from './select-on-earth.svelte'
export function SelectOnEarth(tx, sx) {
	const component = new SelectOnEarthSvelte({
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		})
	return component.handlers
}