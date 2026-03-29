
// use path variables later ?
// const RR = new Path2D()
export const shapeIcon = {

// The view icons
close(ctx,x,y,w,h,cLine) {

    // a cross
    ctx.beginPath()
    ctx.strokeStyle = cLine
    ctx.lineWidth = 2

    const r = w/2
    ctx.arc(x+r,y+r,r,0,2*Math.PI)

    const d = 2
    ctx.moveTo(x+d,   y+d)
    ctx.lineTo(x+w-d, y+w-d)
    ctx.moveTo(x+w-d, y+d)
    ctx.lineTo(x+d,   y+w-d)

    ctx.stroke()
},
// bigView(ctx,x,y,w,h,cLine) {

//     // a square
//     ctx.beginPath()
//     ctx.fillStyle = cLine
//     //ctx.strokeStyle = cLine
//     //ctx.lineWidth = 1
//     //ctx.strokeRect(x,y,w,w)
//     ctx.fillRect(x,y,w,w)
// },
// group icon 
bigView(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2

    ctx.rect(x, y, w, h)

    ctx.stroke()
},

smallView(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    ctx.fillStyle = cIcon

    ctx.rect(x+2, y+2, w-4, h-4)

    ctx.fill()
},

// group icon 
xbigView(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    const h1 = h/2
    const w1 = w/2

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2

    ctx.rect(x, y, w1-1, h1)
    ctx.rect(x+w1+1, y+h1, w1-1, h1)

    ctx.stroke()
},
// restore(ctx,x,y,w,h,cLine) {

//     ctx.beginPath()
//     const w2 = w/2
//     ctx.fillStyle = cLine
//     //ctx.strokeStyle = cLine
//     //ctx.lineWidth = 1
//     //ctx.strokeRect(x,y+w2,w,w2)
//     ctx.fillRect(x,y+w2,w,w2)
// },
calibrate(ctx,x,y,w,h,cLine) {

    ctx.beginPath()
    ctx.strokeStyle = cLine
    ctx.lineWidth = 2
    const r = w/2
    const d = 1

    ctx.arc(x+r,y+r,r-1,0,2*Math.PI)

    ctx.moveTo(x-d, y+r)
    ctx.lineTo(x+w+d, y+r)
    ctx.moveTo(x+r, y-d)
    ctx.lineTo(x+r, y+w+d)

    ctx.stroke()
},
grid(ctx,x,y,w,h,cLine) {

    ctx.beginPath()
    ctx.strokeStyle = cLine
    ctx.lineWidth = 2

    const d = w/3

    ctx.moveTo(x+d, y)
    ctx.lineTo(x+d, y+w)

    ctx.moveTo(x+d+d, y)
    ctx.lineTo(x+d+d, y+w)

    ctx.moveTo(x, y+d)
    ctx.lineTo(x+w, y+d)

    ctx.moveTo(x, y+d+d)
    ctx.lineTo(x+w, y+d+d)

    ctx.stroke()
},

// The node icons
link(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2
    const pi = Math.PI

    const r = w/3
    const w1 = w/2

    ctx.moveTo(x+w1+r, y+r)
    ctx.arc(   x+w1,   y+r,  r, 0,   pi, true)
    //ctx.lineTo(x+w1-r, y+h-r)
    ctx.moveTo(x+w1-r, y+h-r)
    ctx.arc(   x+w1,   y+h-r,r, pi, 2*pi,true)

    ctx.moveTo(x+w1,   y+h-r)
    ctx.lineTo(x+w1, y+r)

    ctx.stroke()
},

lock(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2
    const pi = Math.PI

    const r = w/3
    const w1 = w/2

    ctx.moveTo(x+w1+r, y+r)
    ctx.arc(x+w1,y+r,r, 0,   pi, true)
    ctx.rect(x+1, y+r+1, w-2, h-r-1)

    ctx.stroke()
},

cog(ctx,x,y,w,h,cIcon,cFill) {

    ctx.beginPath()

    const w1 = w/2
    const h1 = h/2
    const r = w/3
    const pi = Math.PI

    // fiddling with diagonal length..
    const d1 = 1
    const d2 = 2

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2

    // vertical
    ctx.moveTo(x+w1,    y+d1)
    ctx.lineTo(x+w1,    y+h-d1)

    // horizontal
    ctx.moveTo(x,       y+h1)
    ctx.lineTo(x+w,     y+h1)

    //diagonal 
    ctx.moveTo(x+d1,    y+d2)
    ctx.lineTo(x+w-d1,  y+h-d2)

    // diagonal
    ctx.moveTo(x+w-d1,  y+d2)
    ctx.lineTo(x+d1,    y+h-d2)

    ctx.stroke()

    ctx.beginPath()
    ctx.fillStyle = cFill
    ctx.arc(x+w1, y+h1, r, 0, 2*pi)
    ctx.stroke()
    ctx.fill()
},

// factory icon 
factory(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    const h1 = h/4
    const h2 = h/2
    const w1 = w/2

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2

    ctx.moveTo(x+w,y)
    ctx.lineTo(x+w,y+h)
    ctx.lineTo(x,y+h)
    ctx.lineTo(x,y+h1)
    ctx.lineTo(x+w1,y+h2)
    ctx.lineTo(x+w1,y+h1)
    ctx.lineTo(x+w,y+h2)
    ctx.stroke()
},

// group icon 
group(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    const h1 = h/2
    const w1 = w/2

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2

    ctx.rect(x, y+2, w1-1, h1)
    ctx.rect(x+w1+1, y+h1, w1-1, h1)

    ctx.stroke()
},

// pulse icon
pulse(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    const a = 3
    const b = 2

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2

    const m = y + h/2 + 1
    ctx.moveTo(x,m)
    ctx.lineTo(x+2,m)
    ctx.lineTo(x+4,y)
    ctx.lineTo(x+5,y+h)
    ctx.lineTo(x+6,m)
    ctx.lineTo(x+w,m)
    ctx.stroke()
},

// comment icon 
comment(ctx,x,y,w,h,cIcon) {

    ctx.beginPath()

    const h1 = h/6
    const h2 = h/2
    const h3 = 5*h1
    const w1 = w/4

    ctx.strokeStyle = cIcon
    ctx.lineWidth = 2

    ctx.moveTo(x+w1,  y+h1)
    ctx.lineTo(x+3*w1,y+h1)

    ctx.moveTo(x+w1,  y+h2)
    ctx.lineTo(x+2*w1,y+h2)

    ctx.moveTo(x+w1,  y+h3)
    ctx.lineTo(x+4*w1,y+h3)

    ctx.stroke()
},

}
