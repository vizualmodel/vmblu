import SimpleTestChartSvelte from './simple-test-chart.svelte'
import PlanetaryDistanceSvelte from './planetary-distance.svelte'

// Factory function for the distance chart
export function SimpleTestChart(tx, sx) {
	const chart = new SimpleTestChartSvelte(
		{
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		}
	)
	return chart.handlers
}

// Factory function for the distance chart
export function PlanetaryDistance(tx, sx) {
	const chart = new PlanetaryDistanceSvelte(
		{
			target: document.createElement('div'),
			props: {
				tx, sx
			}
		}
	)
	return chart.handlers
}