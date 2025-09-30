import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';

export function StationaryControls(camera, canvas) {

    this.camera = camera;
    this.canvas = canvas;

    // OrbitControls setup
    this.orbitControls = new OrbitControls(camera, canvas);
    this.orbitControls.enablePan = false;
    this.orbitControls.enabled = false;
    this.orbitControls.enableZoom = false;

    this.direction = new THREE.Vector3();

    //this.updateOrbitControlsTarget();
}

StationaryControls.prototype = {
    // Enable event listeners
    enable() {
        this.orbitControls.enabled = true;
    },

    // Disable event listeners
    disable() {
        this.orbitControls.enabled = false;
    },

    updateOrbitControlsTarget() {
        // Set orbit control target relative to the camera position
        this.direction.set(0, 0, -1); 
        this.camera.getWorldDirection(this.direction);
        const targetPosition = new THREE.Vector3().copy(this.camera.position).add(this.direction.multiplyScalar(0.01));
        this.orbitControls.target.copy(targetPosition);
    },
};
