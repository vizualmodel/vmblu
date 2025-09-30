import * as THREE from 'three';

export function SkySphere(tx, sx) {

    this.tx = tx;
    this.sx = sx;

    // Get a texture loader
    const textureLoader = new THREE.TextureLoader();

    // Load the star map texture
    const starTexture = textureLoader.load(sx.starFile, function (texture) {
        texture.minFilter = THREE.LinearFilter; // Improve sharpness by disabling mipmaps
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false; // Disable mipmapping to keep it sharp
    });

    // Load the constellation texture with transparency
    const constellationTexture = textureLoader.load(sx.constellationFile, function (texture) {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
    });

    // Create a large sphere geometry for the star map background
    this.sphere = new THREE.SphereGeometry(sx.radius, 64, 64); // Large radius to surround the scene

    // Create the material for the star map (base layer)
    const starMaterial = new THREE.MeshBasicMaterial({ map: starTexture, side: THREE.BackSide });

    // Create the material for the constellation layer
    const constellationMaterial = new THREE.MeshBasicMaterial({ 
        map: constellationTexture, 
        side: THREE.BackSide, 
        transparent: true // Enable transparency for the PNG
    });

    // Create the meshes for both layers
    this.starMesh = new THREE.Mesh(this.sphere, starMaterial);
    this.constellationMesh = new THREE.Mesh(this.sphere, constellationMaterial);

    // Rotate the sphere so it's oriented correctly
    this.starMesh.rotation.x = Math.PI / 2;
    this.starMesh.rotation.y = Math.PI;
    this.constellationMesh.rotation.x = Math.PI / 2;
    this.constellationMesh.rotation.y = Math.PI;

    // set the visibility of first
    this.starMesh.visible = false
    this.constellationMesh.visible = false

    // Add both meshes to the scene
    tx.send('scene add', this.starMesh);
    tx.send('scene add', this.constellationMesh);

    // request the initial settings
    tx.request('presentation.get user settings')
    .then( solsys => {

        this.starMesh.visible = solsys.stars.on;
        this.constellationMesh.visible = solsys.constellations.on;
    })
}

// Update the prototype methods to manage visibility if necessary
SkySphere.prototype = {

    '-> presentation.user change'({ what, solsys }) {
        if (what == 'stars on/off') {
            this.starMesh.visible = solsys.stars.on;
        }
        if (what == 'constellations on/off') {
            this.constellationMesh.visible = solsys.constellations.on;
        }
    }
}
