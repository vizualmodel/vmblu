import TabRibbon from './tab-ribbon.svelte'

export function TabRibbonFactory(tx, sx) {

	// create a div for the tab ribbon
	const div = document.createElement("div")

    // create the tab ribon
	let ribbon = new TabRibbon(
		{
			target: div,
			props: {
				tx, sx, handlers:null
			}
		}
	)
	// return the handlers of the cell
	return ribbon.handlers
}