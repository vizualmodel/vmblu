import * as THREE from 'three';

export function StationaryControls(device) {
    this.device = device;
    this.enabled = false;

    this.xAxis = new THREE.Vector3(1, 0, 0);
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.rotator = new THREE.Quaternion();
    this.fresh = true;

    // Mouse properties
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };

    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
}

StationaryControls.prototype = {
    // Mouse event handlers
    onMouseDown(event) {
        // Only respond to left mouse button
        if (event.button === 0) {
            this.isDragging = true;
            this.previousMousePosition.x = event.clientX;
            this.previousMousePosition.y = event.clientY;
        }
    },

    onMouseMove(event) {
        if (this.isDragging) {
            const deltaMove = {
                x: event.clientX - this.previousMousePosition.x,
                y: event.clientY - this.previousMousePosition.y,
            };

            // Define rotation angles proportional to mouse movement
            const rotationSpeed = 0.005; // Adjust to control the sensitivity
            const angleX = deltaMove.y * rotationSpeed; // Up/Down movement for pitch
            const angleY = deltaMove.x * rotationSpeed; // Left/Right movement for yaw

            // Apply pitch rotation (up and down) around the x-axis
            this.rotator.setFromAxisAngle(this.xAxis, angleX);
            this.device.quaternion.multiply(this.rotator);

            // Apply yaw rotation (left and right) around the y-axis
            this.rotator.setFromAxisAngle(this.yAxis, angleY);
            this.device.quaternion.multiply(this.rotator);

            // Update previous mouse position
            this.previousMousePosition.x = event.clientX;
            this.previousMousePosition.y = event.clientY;
        }
    },

    onMouseUp(event) {
        // Stop dragging on mouse release
        if (event.button === 0) {
            this.isDragging = false;
        }
    },

    enable() {
        if (!this.device) return;

        if (this.fresh) {
            this.rotator.setFromAxisAngle(this.xAxis, -Math.PI / 2);
            this.device.quaternion.multiply(this.rotator);
            this.fresh = false;
        }

        // Add mouse event listeners
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);

        this.enabled = true;
    },

    disable() {
        // Remove mouse event listeners
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);

        this.enabled = false;
    }
};

