import * as THREE from 'three'

export function ArrowControls(device) {

    this.device = device
    this.enabled = false
    this.arrowListener = this.onKeydown.bind(this)

    this.xAxis = new THREE.Vector3(1,0,0)
    this.yAxis = new THREE.Vector3(0,1,0)

    this.rotator = new THREE.Quaternion()
    this.fresh = true
}
ArrowControls.prototype = {

    onKeydown(event) {

        const angle = 0.02;
    
        switch (event.code) {
            case 'ArrowUp':
                this.rotator.setFromAxisAngle(this.xAxis, angle)
                break;
            case 'ArrowDown':
                this.rotator.setFromAxisAngle(this.xAxis, -angle)
                break;
            case 'ArrowLeft':
                this.rotator.setFromAxisAngle(this.yAxis, angle)
                break;
            case 'ArrowRight':
                this.rotator.setFromAxisAngle(this.yAxis, -angle)
                break;
        }
        this.device.quaternion.multiply(this.rotator);
    },
 
    enable() {
        if (!this.device) return;

        document.addEventListener('keydown', this.arrowListener)       
        this.enabled = true
    },

    disable() {
        document.removeEventListener('keydown', this.arrowListener)
        this.enabled = false
    }
}
