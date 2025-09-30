import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function SpaceshipControls(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    // OrbitControls setup
    this.orbitControls = new OrbitControls(camera, canvas);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.enablePan = false;
    this.orbitControls.enabled = false;

    this.direction = new THREE.Vector3();

    this.axis = new THREE.Vector3(0,0,1)
    this.quaternion = new THREE.Quaternion();

    // flags
    this.is = {
        moving: false,
        enable: false
    }

    // type of movement
    this.dir = {
        forward: false,
        backward: false,
        left : false,
        right : false,
        fast: false
    }

    // Bind event listeners
    this.keydownListener = this.onKeydown.bind(this);
    this.keyupListener = this.onKeyup.bind(this);

}

SpaceshipControls.prototype = {
    // Enable event listeners
    enable() {
        this.is.enabled = true
        document.addEventListener('keydown', this.keydownListener);
        document.addEventListener('keyup', this.keyupListener);

        this.orbitControls.enabled = true;

        // Update OrbitControls target to follow the spaceship's position
        this.updateOrbitControlsTarget();
    },

    // Disable event listeners
    disable() {
        this.is.enabled = false
        document.removeEventListener('keydown', this.keydownListener);
        document.removeEventListener('keyup', this.keyupListener);

        this.orbitControls.enabled = false;
    },

    checkMoving() {
        const dir = this.dir
        this.is.moving = dir.forward || dir.backward || dir.left || dir.right
    },

    // Handle keydown events
    onKeydown(event) {

        if (event.ctrlKey) this.dir.fast = true

        switch (event.code) {
            case 'ArrowUp':
                this.dir.forward = true;
                this.is.moving = true;
                break;
            case 'ArrowDown':
                this.dir.backward = true;
                this.is.moving = true;
                break;
            case 'ArrowLeft':
                this.dir.left = true;
                this.is.moving = true;
                break;
            case 'ArrowRight':
                this.dir.right = true;
                this.is.moving = true;
                break;
        }
    },

    // Handle keyup events
    onKeyup(event) {

        this.dir.fast = false

        switch (event.code) {
            case 'ArrowUp':
                this.dir.forward = false;
                this.checkMoving();
                break;
            case 'ArrowDown':
                this.dir.backward = false;
                this.checkMoving();
                break;
            case 'ArrowLeft':
                this.dir.left = false;
                this.checkMoving();
                break;
            case 'ArrowRight':
                this.dir.right = false;
                this.checkMoving();
                break;
        }
    },

    move(dt) {

        const speed = this.dir.fast ? dt : 0.1 * dt; 
        const omega = 0.1*dt;
        const direction = this.direction
        const camera = this.camera
        const dir = this.dir
        const quat = this.quaternion

        // Handle forward/backward movement
        if (dir.forward) {
            camera.getWorldDirection(direction);
            camera.position.add(direction.multiplyScalar(speed));
        }
        else if (dir.backward) {
            camera.getWorldDirection(direction);
            camera.position.add(direction.multiplyScalar(-speed));
        }

        if (dir.left) {
            camera.getWorldDirection(direction);
            direction.cross(camera.up).normalize();
            camera.position.add(direction.multiplyScalar(-speed));
        }
        else if (dir.right) {
            camera.getWorldDirection(direction);
            direction.cross(camera.up).normalize();
            camera.position.add(direction.multiplyScalar(speed));
        }

        // // Handle left/right rotation using quaternions
        // if (dir.left) {
        //     quat.setFromAxisAngle(this.axis, omega);
        //     camera.quaternion.premultiply(quat);
        // }
        // else if (dir.right) {
        //     quat.setFromAxisAngle(this.axis, -omega);
        //     camera.quaternion.premultiply(quat);
        // }

        // Update OrbitControls target to follow the spaceship's position
        this.updateOrbitControlsTarget();
    },


    updateOrbitControlsTarget() {
        // Set orbit control target relative to the spaceship
        this.direction.set(0, 0, -1); // Forward direction of the spaceship
        this.camera.getWorldDirection(this.direction);
        const targetPosition = new THREE.Vector3().copy(this.camera.position).add(this.direction.multiplyScalar(0.01));
        this.orbitControls.target.copy(targetPosition);
    },

    // Update movement and rotation logic
    update(dt) {

        // check if enabled 
        if (!this.is.enabled) return

        // check if we have to move
        if (this.is.moving) this.move(dt)

        // Update OrbitControls
        else this.orbitControls.update();
    },
};
