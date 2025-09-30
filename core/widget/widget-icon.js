import {shape,shapeIcon, convert, style} from '../util/index.js'

// Icons are used on views and nodes
export function Icon(rect, iconType) {

    this.rect = {...rect}
    this.is = {
        icon: true,
        bad: false,
        highLighted: false
    }
    this.type = iconType

    // to be initialised with a render function
    this.render = ()=>{console.warn("Missing render function for icon ",this.type)}
}
Icon.prototype = {

    setRender() {

        this.render = this.renderFunctions[this.type] || this.renderFunctions["dummy"]
    },

    switchType(newType) {

        this.type = newType
        this.setRender()
    },

    renderFunctions: {

        // the node icons
        "link"(ctx) {
            const {x,y,w,h} = {...this.rect}

            const color =     this.is.highLighted ? style.icon.cHighLighted
                            : this.is.bad ? style.icon.cBadLink 
                            : style.icon.cLink

            shapeIcon.link(ctx, x,y,w,h, color) 
        },

        "lock"(ctx) {
            const {x,y,w,h} = {...this.rect}

            const color =     this.is.highLighted ? style.icon.cHighLighted
                            : this.is.bad ? style.icon.cBadLink 
                            : style.icon.cLink

            shapeIcon.lock(ctx, x,y,w,h, color)
        },

        "factory"(ctx) {
            const {x,y,w,h} = {...this.rect}
            shapeIcon.factory(ctx, x,y,w,h,  style.icon.cSrc)
        },

        "group"(ctx) {
            const {x,y,w,h} = {...this.rect}
            shapeIcon.group(ctx, x,y,w,h,  style.icon.cGroup)
        },

        "cog"(ctx) {
            const {x,y,w,h} = {...this.rect}
            shapeIcon.cog(ctx, x,y,w,h,  style.icon.cCog, style.header.cBackground)
        },

        "pulse"(ctx) {
            const {x,y,w,h} = {...this.rect}
            shapeIcon.pulse(ctx, x,y,w,h,  style.icon.cPulse, style.header.cBackground)
        },

        "comment"(ctx) {
            const {x,y,w,h} = {...this.rect}
            shapeIcon.comment(ctx, x,y,w,h,  style.icon.cComment)
        },

        // The view icons
        "close"(ctx) {
            const {x,y,w,h} = {...this.rect}
            const cIcon = this.is.highLighted ? style.view.cClose : style.view.cDim
            shapeIcon.close(ctx, x,y,w,h, cIcon)
        },

        "big"(ctx) {
            const {x,y,w,h} = {...this.rect}
            const cIcon = this.is.highLighted ? style.view.cFullscreen : style.view.cDim
            shapeIcon.bigView(ctx, x,y,w,h, cIcon)
        },

        "small"(ctx) {
            const {x,y,w,h} = {...this.rect}
            const cIcon = this.is.highLighted ? style.view.cFullscreen : style.view.cDim
            shapeIcon.smallView(ctx, x,y,w,h, cIcon)
        },

        "calibrate"(ctx) {
            const {x,y,w,h} = {...this.rect}
            const cIcon = this.is.highLighted ? style.view.cCalibrate : style.view.cDim
            shapeIcon.calibrate(ctx, x,y,w,h, cIcon)
        },

        "grid"(ctx) {
            const {x,y,w,h} = {...this.rect}
            const cIcon = this.is.highLighted ? style.view.cGrid : style.view.cDim
            shapeIcon.grid(ctx, x,y,w,h, cIcon)
        },

        "dummy"(ctx) {
            console.warn('Cannot render unknown icon type:', this)
        }

    },

    toJSON() {
        //return undefined
        //return {icon: convert.iconToString(this.rect, this.type)}
    }
}