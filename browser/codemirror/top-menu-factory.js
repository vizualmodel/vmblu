import TopMenu from './top-menu.svelte'

let symbols = [
	{name:"save", message:"save", help:"save"},
	{name:"save_as", message:"save as", help:"save as"},
	{name:"note_add", message:"new doc", help:"new file"},
]

export function TopMenuFactory(tx, sx) {

	// create a div for the menu
	const div = document.createElement("div")
	let menu = new TopMenu(
		{
			target: div,
			props: {
				sx, tx, handlers:null, symbols
			}
		}
	)

	// return the handlers of the cell
	return menu.handlers
}
