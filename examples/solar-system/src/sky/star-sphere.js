import * as THREE from 'three';

export function StarSphere(tx, sx) {

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

    starTexture.wrapS = THREE.RepeatWrapping;
    starTexture.repeat.x = -1;

    // Load the constellation texture with transparency
    const constellationTexture = textureLoader.load(sx.constellationFile, function (texture) {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
    });

    constellationTexture.wrapS = THREE.RepeatWrapping;
    constellationTexture.repeat.x = -1;

    // Create a large sphere geometry for the star map background
    this.sphere = new THREE.SphereGeometry(sx.radius, 64, 64); // Large radius to surround the scene

    // Create the material for the star map (base layer)
    const starMaterial = new THREE.MeshBasicMaterial({ map: starTexture, side: THREE.BackSide });

    // Create the material for the constellation layer
    const constellationMaterial = new THREE.MeshBasicMaterial({  map: constellationTexture, side: THREE.BackSide,  transparent: true});

    // Create the meshes for both layers
    this.starMesh = new THREE.Mesh(this.sphere, starMaterial);
    this.constellationMesh = new THREE.Mesh(this.sphere, constellationMaterial);

    // Rotate the sphere so it's oriented correctly

    // Define the obliquity angle in radians
    const obliquityAngle = THREE.MathUtils.degToRad(23.44); // +23.44 degrees

    // Apply an initial rotation by π/2 around the X-axis
    const initialRotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2
    );

    // Apply the axial tilt rotation (obliquity)
    const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        -obliquityAngle
    );

    // Combine the rotations without the 180-degree correction
    const combinedQuaternion = new THREE.Quaternion()
        .multiply(initialRotationQuaternion)
        .multiply(tiltQuaternion);

    // Apply the combined rotation to the starMesh and constellationMesh
    this.starMesh.setRotationFromQuaternion(combinedQuaternion);
    this.constellationMesh.setRotationFromQuaternion(combinedQuaternion);

    // Set the visibility of the meshes to not visible
    this.starMesh.visible = false;
    this.constellationMesh.visible = false;

    // Add both meshes to the scene
    tx.send('scene add', this.starMesh);
    tx.send('scene add', this.constellationMesh);

    // Request the initial settings
    tx.request('presentation get user settings')
        .then(solsys => {
            this.starMesh.visible = solsys.stars.on;
            this.constellationMesh.visible = solsys.constellations.on;
        });
}

// Update the prototype methods to manage visibility if necessary
StarSphere.prototype = {

    '-> presentation user change'({ what, solsys }) {

        if (what == 'stars on/off') {
            this.starMesh.visible = solsys.stars.on;
        }
        if (what == 'constellations on/off') {
            this.constellationMesh.visible = solsys.constellations.on;
        }
    }
}
