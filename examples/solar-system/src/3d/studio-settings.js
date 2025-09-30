// ------------------------------------------------------------------
// Source node: StudioSettings
// Creation date 9/22/2024, 12:27:22 PM
// ------------------------------------------------------------------

//Constructor for studio settings
export function StudioSettings(tx, sx) {

    this.sx = sx
    this.tx = tx

    // add a camera with the settings
	// "-> add" ({name, type, near, far, fov, zoom, aspect, position, lookAt}) {
    const camera = sx.camera
    
    if (camera) {
        tx.send('add camera', {
            name: camera.name,
            type: camera.type,
            near: camera.near ?? 0.1,
            far: camera.far ?? 1000,
            fov: camera.fov ?? 45,
            zoom: camera.zoom ?? 1,
            aspect: camera.aspect ?? 'canvas',
            position: camera.position ?? null,
            lookAt: camera.lookAt ?? null
        })

        // and select that camera
        tx.send('select camera', camera.name )
    }

    // set the grid size
    if (sx.grid) tx.send('grid settings',{...sx.grid})

    // set the axes 
    if (sx.axes) tx.send('axes settings', {...sx.axes})

}
StudioSettings.prototype = {

	// Output pins of the node
	sends: [
		'add camera',
		'grid settings',
		'axes settings'
	],

	// Input pins and handlers of the node

} // studio settings.prototype