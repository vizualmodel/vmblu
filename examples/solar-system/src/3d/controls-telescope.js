import * as THREE from 'three'

export function TelescopeControls(device, showCone=false) {

    this.device = device
    this.enabled = false
    this.eventListener = this.onKeydown.bind(this)

    this.yawAxis = new THREE.Vector3(0,0,1)
    this.pitchAxis = new THREE.Vector3(1,0,0)

    this.rotator = new THREE.Quaternion()
    this.inverse = new THREE.Quaternion()

    this.yawHelper = null
    if (false) {
        this.yawHelper = new THREE.AxesHelper(0.002); 
        this.yawHelper.setColors(0xffff00, 0xff00ff, 0x00ffff)
        this.yawHelper.rotateX(Math.PI)
        device.add(this.yawHelper);
    }

    // Create a transparent cone to represent the telescope view
    this.cone = null
    if (showCone) {
        const L = 0.00001
        const coneGeometry = new THREE.ConeGeometry(L/3, L, 6, 1, true);

        // 0,0,0 is at the centre of the cone and the cone is oriented along the y-axis
        coneGeometry.translate(0, -L/2, 0)

        // with this rotation the cone is oriented along z
        coneGeometry.rotateX(Math.PI/2)
        const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true});
        this.cone = new THREE.Mesh(coneGeometry, coneMaterial);
        device.add(this.cone);
    }
}
TelescopeControls.prototype = {

    onKeydown(event) {
        const angle = 0.02;

        switch (event.code) {

            case 'ArrowUp':
                this.rotator.setFromAxisAngle(this.pitchAxis, angle);
                this.device.quaternion.multiply(this.rotator);

                // Apply the inverse pitch rotation to keep the yaw axis fixed
                this.inverse.setFromAxisAngle(this.pitchAxis, -angle);
                this.yawAxis.applyQuaternion(this.inverse);
                if (this.yawHelper) this.yawHelper.applyQuaternion(this.inverse);
                break;

            case 'ArrowDown':
                this.rotator.setFromAxisAngle(this.pitchAxis, -angle);
                this.device.quaternion.multiply(this.rotator);

                // Apply the inverse pitch rotation to keep the yaw axis fixed
                this.inverse.setFromAxisAngle(this.pitchAxis, angle);
                this.yawAxis.applyQuaternion(this.inverse);
                if (this.yawHelper) this.yawHelper.applyQuaternion(this.inverse);
                break;

            case 'ArrowLeft':
                this.rotator.setFromAxisAngle(this.yawAxis, -angle);
                this.device.quaternion.multiply(this.rotator);
                break;

            case 'ArrowRight':
                this.rotator.setFromAxisAngle(this.yawAxis, angle);
                this.device.quaternion.multiply(this.rotator);
                break;
        }
    },

 
    enable() {
        if (!this.device) return;

        document.addEventListener('keydown', this.eventListener)       
        this.enabled = true
    },

    disable() {
        document.removeEventListener('keydown', this.eventListener)
        this.enabled = false
    }
}
