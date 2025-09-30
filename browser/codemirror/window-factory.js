import WindowLayout from './window.svelte'

export function CodeMirrorWindow(tx, sx) {

	// create a div for the tab ribbon
	const div = document.createElement("div")

    // create the tab ribon
	let cmWindow = new WindowLayout(
		{
			target: div,
			props: {
				tx,sx,handlers:null
			}
		}
	)

	// return the handlers of the cell
	return cmWindow.handlers
}