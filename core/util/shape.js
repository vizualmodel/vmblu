
// use path variables later ?
// const RR = new Path2D()
export const shape = {

// xy position, w width, h height, r radius at the corner
 _roundedRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x, y + r);
    ctx.arcTo(x, y + h, x + r, y + h, r);
    ctx.arcTo(x + w, y + h, x + w, y + h - r, r);
    ctx.arcTo(x + w, y, x + w - r, y, r);
    ctx.arcTo(x, y, x, y + r, r);
},

// a router symbol
// _router(ctx, x, y, r) {
//     let cx = x-2
//     let cy = y-2
//     ctx.moveTo(cx-r-4,cy)
//     ctx.arc(cx, cy,r+4,Math.PI,-Math.PI/2)
//     ctx.moveTo(cx-r,cy)
//     ctx.arc(cx, cy,r,Math.PI,-Math.PI/2)
//     ctx.moveTo(cx-r+4,cy)
//     ctx.arc(cx, cy,r-4,Math.PI,-Math.PI/2)
// },

// the rectangle for the overlay
rectRect(ctx,x,y,w,h,cLine,cFill) {

    if (cFill) {
        ctx.fillStyle = cFill
        ctx.fillRect(x,y,w,h)
    }
    if (cLine) {
        ctx.strokeStyle = cLine
        ctx.strokeRect(x,y,w,h)
    }
},

circle(ctx, x,y,r, color) {
    ctx.beginPath()
    ctx.strokeStyle=color
    ctx.moveTo(x,y)
    ctx.arc(x,y,r,0, 2*Math.PI)
    ctx.stroke()
},

diamond(ctx,x,y,w,h,cFill) {
    ctx.beginPath()
    ctx.fillStyle = cFill
    ctx.moveTo(x+w/2,y)
    ctx.lineTo(x+w,y+h/2)
    ctx.lineTo(x+w/2,y+h)
    ctx.lineTo(x,y+h/2)
    ctx.lineTo(x+w/2,y)
    ctx.fill()
},

viewTitle(ctx, x, y, h, titleClr, title) {
    ctx.fillStyle = titleClr
    ctx.fillText(title, x + h * 0.5, y + h * 0.75)
},

// a rectangle with rounded corners
viewRect(ctx, x, y, w, h, r, wLine, cLine, cFill) {

    const pi = Math.PI

    ctx.beginPath();
    ctx.lineWidth = wLine
    ctx.moveTo(x, y+r);
    ctx.arc(x+r, y+r,r,pi,-pi/2)
    ctx.lineTo(x+w-r, y)
    ctx.arc(x+w-r,y+r,r,-pi/2,0)
    ctx.lineTo(x+w, y+h-r)
    ctx.arc(x+w-r, y+h-r,r,0,pi/2)
    ctx.lineTo(x+r, y+h)
    ctx.arc(x+r,y+h-r,r,pi/2,pi)
    ctx.lineTo(x,y+r)

    // make a resize symbol in the bottom right corner
    ctx.moveTo(x+w, y+h-r)
    ctx.lineTo(x+w-r, y+h)

    if (cFill) {
        ctx.fillStyle = cFill
        ctx.fill()
    }
    if (cLine) {
        ctx.strokeStyle = cLine
        ctx.stroke()
    }
},

// a rectangle with rounded corners
roundedRect(ctx, x, y, w, h, r, wLine, cLine, cFill) {

    const pi = Math.PI

    ctx.beginPath();
    ctx.lineWidth = wLine
    ctx.moveTo(x, y+r);
    ctx.arc(x+r, y+r,r,pi,-pi/2)
    ctx.lineTo(x+w-r, y)
    ctx.arc(x+w-r,y+r,r,-pi/2,0)
    ctx.lineTo(x+w, y+h-r)
    ctx.arc(x+w-r, y+h-r,r,0,pi/2)
    ctx.lineTo(x+r, y+h)
    ctx.arc(x+r,y+h-r,r,pi/2,pi)
    ctx.lineTo(x,y+r)
    if (cFill) {
        ctx.fillStyle = cFill
        ctx.fill()
    }
    if (cLine) {
        ctx.strokeStyle = cLine
        ctx.stroke()
    }
},

roundedHeader(ctx, x, y, w, h, r, wLine, cLine, cFill) {

    const pi = Math.PI

    ctx.beginPath();
    ctx.lineWidth = wLine
    ctx.moveTo(x, y+r);
    ctx.arc(x+r, y+r,r,pi,-pi/2)
    ctx.lineTo(x+w-r, y)
    ctx.arc(x+w-r,y+r,r,-pi/2,0)
    ctx.lineTo(x+w, y+h)
    ctx.lineTo(x, y+h)
    ctx.lineTo(x,y+r)
    if (cFill) {
        ctx.fillStyle = cFill
        ctx.fill()
    }
    if (cLine) {
        ctx.strokeStyle = cLine
        ctx.stroke()
    }
},

grid(ctx, x, y, w, h, dx, dy, cLine, cAxis) {

    ctx.beginPath()

    ctx.lineWidth = 1
    ctx.strokeStyle = cLine

    const maxy = y + h
    for (let sy = y-y%dy; sy < maxy; sy += dy) {
        ctx.moveTo(x, sy)
        ctx.lineTo(x+w, sy)
    }
    const maxx = x + w
    for (let sx = x-x%dx; sx < maxx; sx += dx) {
        ctx.moveTo(sx, y)
        ctx.lineTo(sx, y+h)
    }
    ctx.stroke()

    // The x and y axis
    ctx.beginPath()
    ctx.strokeStyle = cAxis
    ctx.moveTo(x,0)
    ctx.lineTo(x+w, 0)
    ctx.moveTo(0, y)
    ctx.lineTo(0, y+h)
    ctx.stroke()
},

bullet(ctx,x,y,R,cLine,cFill) {
    ctx.beginPath()
    ctx.arc(x,y,R,0,2*Math.PI)
    if (cFill) {
        ctx.fillStyle = cFill
        ctx.fill()
    }
    if (cLine) {
        ctx.lineWidth = 1
        ctx.strokeStyle = cLine
        ctx.stroke()
    }
},

textWidth(ctx,text) {
    return ctx.measureText(text).width
},

// Fit a string to a given pixel width using the current ctx.font.
// Returns the possibly truncated string, optionally ending with an ellipsis.
fitText(ctx, text, maxWidth) {

    // Early accept
    const fullWidth = ctx.measureText(text).width;
    if (fullWidth <= maxWidth) return text;

    const ellipsis = '…';
    const ellW = ctx.measureText(ellipsis).width;

    // Binary search for the largest prefix that fits (including ellipsis width)
    let low = 0, high = text.length;
    let best = 0;
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const substr = text.slice(0, mid);
        const w = ctx.measureText(substr).width + ellW;
        if (w <= maxWidth) {
            best = mid;
            low = mid;
        } else {
            high = mid - 1;
        }
    }

    const clipped = text.slice(0, best);
    return clipped + ellipsis;
},

labelText(ctx, text, font, cText,x,y,w,h) {

    // change the font
    const saveFont = ctx.font
    ctx.font = font

    ctx.fillStyle = cText
    ctx.fillText(text,x,y + 0.5*h)

    // set the font back
    ctx.font = saveFont
},
labelCursor(ctx,text,x,y,w,h,pCursor) {
    let cx = ctx.measureText(text.slice(0,pCursor)).width
    return {x: x + cx + 1, y: y-0.25*h}
},


leftText(ctx, text, cText,x,y,w,h) {
    ctx.fillStyle = cText
    ctx.fillText(text,x,y + 0.75*h)
},

rightText(ctx, text,cText,x,y,w,h) {
    ctx.fillStyle = cText
    let tw = ctx.measureText(text).width
    ctx.fillText(text, x + w - tw, y+0.75*h)
},

rightTextMulti(ctx, text, fMulti, cText,x,y,w,h) {

    // set the color
    ctx.fillStyle = cText

    // set the actual y-position
    y += 0.75*h

    // cut the text in three parts 
    const opbr = text.indexOf('[')
    const clbr = text.indexOf(']')
    const pre = text.slice(0, opbr+1)
    const multi = text.slice(opbr+1,clbr)
    const post = text.slice(clbr)

    // save the font
    const savedFont = ctx.font

    // total width 
    const wPre = ctx.measureText(pre).width 
    const wPost = ctx.measureText(post).width
    ctx.font = fMulti
    const wMulti = ctx.measureText(multi).width

    // write the text
    ctx.font = savedFont
    x = x + w - wPre - wMulti - wPost
    ctx.fillText(pre,x,y)

    ctx.font = fMulti
    x += wPre
    ctx.fillText(multi,x, y)

    ctx.font = savedFont
    x += wMulti
    ctx.fillText(post,x,y)
},

leftTextMulti(ctx, text, fMulti, cText,x,y,w,h) {

    ctx.fillStyle = cText
 
    // set the color
    ctx.fillStyle = cText

    // set the actual y-position
    y += 0.75*h

    // cut the text in three parts 
    const opbr = text.indexOf('[')
    const clbr = text.indexOf(']')
    const pre = text.slice(0, opbr+1)
    const multi = text.slice(opbr+1,clbr)
    const post = text.slice(clbr)

    // save the font
    const savedFont = ctx.font

    // sizes
    const wPre = ctx.measureText(pre).width 
    ctx.font = fMulti
    const wMulti = ctx.measureText(multi).width

    // write the text
    ctx.font = savedFont
    ctx.fillText(pre,x,y)

    ctx.font = fMulti
    x += wPre
    ctx.fillText(multi,x, y)

    ctx.font = savedFont
    x += wMulti
    ctx.fillText(post,x,y)
},

centerText(ctx, text,font, cText,x,y,w,h) {

    const saveFont = ctx.font
    ctx.font = font
    ctx.fillStyle = cText
    let tm = ctx.measureText(text)
    ctx.fillText(text, x + (w - tm.width)/2, y+0.75*h)
    ctx.font = saveFont
},

centerLineText(ctx, text,cText,cLine,x,y,w,h) {

    ctx.beginPath()
    ctx.fillStyle = cText
    ctx.strokeStyle = cLine
    const tm = ctx.measureText(text)
    const guard = 5

    ctx.moveTo(x,y+h/2)
    ctx.lineTo(x + (w - tm.width)/2 - guard, y+h/2)
    ctx.moveTo(x + (w + tm.width)/2 + guard, y+h/2)
    ctx.lineTo(x+w,y+h/2)
    ctx.stroke()

    ctx.fillText(text, x + (w - tm.width)/2, y+0.75*h)
},

// interface text - link = 0, 1 or 2
ifName(ctx, text,color,rc) {

    const {x,y,w,h} = rc
    
    ctx.beginPath()

    ctx.strokeStyle = color.line
    ctx.fillStyle = color.line
    const tm = ctx.measureText(text)
    const guard = 5

    const left = x + (w - tm.width)/2
    const cy = y+h/2

    ctx.moveTo(x,cy)
    ctx.lineTo(left - guard, cy)
    ctx.moveTo(left + tm.width + guard, cy)
    ctx.lineTo(x+w,cy)
    ctx.stroke()

    ctx.fillStyle = color.text
    ctx.fillText(text, left, y+0.75*h)
},

centerTextCursor(ctx,rc,text,pChar) {
    let x = rc.x + rc.w/2 - ctx.measureText(text).width/2
    let cx = ctx.measureText(text.slice(0,pChar)).width
    return {x: x + cx + 1, y: rc.y}
},

leftTextCursor(ctx,text,x,y,w,h,pCursor) {
    let cx = ctx.measureText(text.slice(0,pCursor)).width
    return {x: x + cx + 1, y:y}
},

// get  the cursor position for a pin - cursor at position p is infront of character p
rightTextCursor(ctx,text,x,y,w,h,pCursor) {
    let cx = ctx.measureText(text.slice(0,pCursor)).width
    return {x: x + w - ctx.measureText(text).width + cx, y: y}
},

// draw a cursor
cursor(ctx,x,y,w,h,cCursor) {

    ctx.fillStyle = cCursor
    ctx.fillRect(x,y,w,h)
},

// to draw pads
bulletRect(ctx,x,y,w,h,cRect, rBullet) {

    ctx.beginPath()
    ctx.fillStyle = cRect
    ctx.fillRect(x + rBullet, y, w, h)
    ctx.arc(x + rBullet,y+h/2,rBullet,Math.PI/2,-Math.PI/2)
    //ctx.arc(x + rBullet,y+h/2,rBullet,0,2*Math.PI)
    ctx.fill()
},

rectBullet(ctx,x,y,w,h, cRect, rBullet) {

    ctx.beginPath()
    ctx.fillStyle = cRect
    ctx.fillRect(x, y, w - rBullet, h)
    ctx.arc(x + w - rBullet,y+h/2,rBullet,-Math.PI/2,Math.PI/2)
    //ctx.arc(x + w - rBullet,y+h/2,rBullet,0,2*Math.PI)
    ctx.fill()
},

corner(ctx,top,left, x,y,w,h, cFill) {

    ctx.beginPath()
    ctx.fillStyle = cFill
    if (left){
        ctx.moveTo(x, y)
        ctx.lineTo(x+w,y+h)
        ctx.arc(x+w/2, y+h/2,w/2,Math.PI/2,Math.PI)
        ctx.lineTo(x,y)
    }
    else {
        ctx.moveTo(x, y+h)
        ctx.lineTo(x+w,y)
        ctx.arc(x+w/2, y+h/2,w/2,0,Math.PI/2)
        ctx.lineTo(x,y+h)
    }
    ctx.fill()
},

leftTriangle(ctx, x,y,w,h,cFill) {
    ctx.beginPath()
    ctx.fillStyle = cFill
    ctx.moveTo(x,y+h/2)
    ctx.lineTo(x+w,y+h)
    ctx.lineTo(x+w,y)
    ctx.lineTo(x,y+h/2)
    ctx.fill()
},

rightTriangle(ctx, x,y,w,h,cFill) {
    ctx.beginPath()
    ctx.fillStyle = cFill
    ctx.moveTo(x,y)
    ctx.lineTo(x,y+h)
    ctx.lineTo(x+w,y+h/2)
    ctx.lineTo(x,y)
    ctx.fill()
},

triangleBall(ctx, x,y,w,h,cFill) {

    const r = 3
    const h2 = h/2

    ctx.beginPath()
    ctx.fillStyle = cFill
    ctx.moveTo(x,y+h2)
    ctx.lineTo(x+w,y+h)
    ctx.lineTo(x+w,y)
    ctx.lineTo(x,y+h2)

    ctx.arc(x+w+r,y+h2,r,0,2*Math.PI)

    ctx.fill()
},

ballTriangle(ctx, x,y,w,h,cFill) {

    const r = 3
    const h2 = h/2

    ctx.beginPath()
    ctx.fillStyle = cFill
    ctx.moveTo(x,y)
    ctx.lineTo(x,y+h)
    ctx.lineTo(x+w,y+h2)
    ctx.lineTo(x,y)

    ctx.arc(x-r,y+h2,r,0,2*Math.PI)

    ctx.fill()
},

triangle(ctx, x,y,w,h,type,cFill) {

    ctx.beginPath()
    ctx.fillStyle = cFill
    switch (type) {

    case "up":
        ctx.moveTo(x, y+h)
        ctx.lineTo(x+w,y+h)
        ctx.lineTo(x+w/2,y)
        ctx.lineTo(x,y+h)
        break

    case "down" :
        ctx.moveTo(x,y)
        ctx.lineTo(x+w/2,y+h)
        ctx.lineTo(x+w,y)
        ctx.lineTo(x,y)
        break

    case "left" :
        ctx.moveTo(x,y+h/2)
        ctx.lineTo(x+w,y+h)
        ctx.lineTo(x+w,y)
        ctx.lineTo(x,y+h/2)
        break

    case "right" :
        ctx.moveTo(x,y)
        ctx.lineTo(x,y+h)
        ctx.lineTo(x+w,y+h/2)
        ctx.lineTo(x,y)
        break
    }
    ctx.fill()
},


// t is the width of the top segment
tack(ctx, type, channel, top, rc,t,cFill) {

    ctx.beginPath()
    ctx.fillStyle = cFill

    let {x,y,w,h} = rc

    const r = 3
    let cx = x + w/2
    let cy = y + h/2

    switch (type) {

    case "up":
        ctx.moveTo(x, y+h)
        ctx.lineTo(x+w,y+h)
        ctx.lineTo(x+(w+t)/2,y)
        ctx.lineTo(x+(w-t)/2,y)
        ctx.lineTo(x,y+h)
        if (channel) cy = top ? y - r : y + h + r
        break

    case "down" :
        ctx.moveTo(x,y)
        ctx.lineTo(x+(w-t)/2,y+h)
        ctx.lineTo(x+(w+t)/2,y+h)
        ctx.lineTo(x+w,y)
        ctx.lineTo(x,y)
        if (channel) cy = top ? y + h + r : y - r
        break

    case "left" :
        ctx.moveTo(x,y+(h-t)/2)
        ctx.lineTo(x,y+(h+t)/2)
        ctx.lineTo(x+w,y+h)
        ctx.lineTo(x+w,y)
        ctx.lineTo(x,y+(h-t)/2)
        if (channel) cx = top ? x - r : x + w + r
        break

    case "right" :
        ctx.moveTo(x,y)
        ctx.lineTo(x,y+h)
        ctx.lineTo(x+w,y+(h+t)/2)
        ctx.lineTo(x+w,y+(h-t)/2)
        ctx.lineTo(x,y)
        if (channel) cx = top ? x + w + r : x - r
        break
    }
    if (channel) ctx.arc(cx,cy,r,0,2*Math.PI)
    ctx.fill()
},

filterSign(ctx,point, width, color){

    let cx = point.x - width/2
    let cy = point.y - width/2

    ctx.fillStyle = color
    ctx.fillRect(cx, cy, width, width)
    ctx.fillStyle = "#000000"
    ctx.fillRect(cx + 2, cy + 2, width-4, width-4)
},

// the text is centered in the label 
hBusbarLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    ctx.beginPath();
    ctx.fillStyle = cRect
    shape._roundedRect(ctx,x,y,w,h,r)
    ctx.fill();

    // center the text
    ctx.fillStyle = cText
    ctx.fillText(text,x + w/2 - ctx.measureText(text).width/2, y + 0.75*h)  
},

// the text is centered in the label 
vBusbarLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    ctx.beginPath();
    ctx.fillStyle = cRect
    shape._roundedRect(ctx,x,y,w,h,r)
    ctx.fill();

    ctx.save();                 // Save the current state
    ctx.translate(x,y);         // the rectangle is at the origin
    ctx.rotate(-Math.PI / 2);   // Rotate the canvas 90 degrees counterclockwise
    ctx.fillStyle = cText
    ctx.fillText(text, -h/2 - ctx.measureText(text).width/2  , 0.75*w)  // center the text
    ctx.restore();              // Restore the state
},

// draws three arches
wirelessSymbol(ctx, x, y,r,color) {

    // router symbol
    ctx.beginPath()
    ctx.strokeStyle = color
    //shape._router(ctx,x,y,r)

    let cx = x-2
    let cy = y-2
    ctx.moveTo(cx-r-4,cy)
    ctx.arc(cx, cy,r+4,Math.PI,-Math.PI/2)
    ctx.moveTo(cx-r,cy)
    ctx.arc(cx, cy,r,Math.PI,-Math.PI/2)
    ctx.moveTo(cx-r+4,cy)
    ctx.arc(cx, cy,r-4,Math.PI,-Math.PI/2)

    ctx.stroke()
},

// draws a funnel symbol - s is the size of the square
filterSymbol(ctx, x, y, s, color) {

    // router symbol
    ctx.beginPath()
    ctx.strokeStyle = color

    const dx = s/3
    const dy = s/2

    ctx.moveTo(x,y)
    ctx.lineTo(x+s,y)
    ctx.lineTo(x+s-dx,y+dy)
    ctx.lineTo(x+s-dx,y+s)
    ctx.lineTo(x+dx,y+s)
    ctx.lineTo(x+dx,y+dy)
    ctx.lineTo(x,y)

    ctx.stroke()
},

// the text is centered in the label 
hCableLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    // big filled oval
    ctx.beginPath();
    ctx.fillStyle = cRect
    //shape._roundedRect(ctx, x-3, y-3, w+6, h+6, r+3)
    shape._roundedRect(ctx, x-2, y-2, w+4, h+4, r+2)
    ctx.fill();

    // black line inside
    ctx.beginPath()
    ctx.strokeStyle = cText
    shape._roundedRect(ctx,x,y,w,h,r)
    ctx.stroke();    

    // text
    ctx.fillStyle = cText
    ctx.fillText(text,x + w/2 - ctx.measureText(text).width/2, y + 0.75*h)  
},

// the text is centered in the label 
vCableLabel(ctx,text,x,y,w,h,r,cRect,cText) {

    // big filled oval
    ctx.beginPath();
    ctx.fillStyle = cRect
    //shape._roundedRect(ctx, x-3, y-3, w+6, h+6, r+3)
    shape._roundedRect(ctx, x-2, y-2, w+4, h+4, r+2)
    ctx.fill();

    // black line inside
    ctx.beginPath()
    ctx.strokeStyle = cText
    shape._roundedRect(ctx,x,y,w,h,r)
    ctx.stroke();    

    ctx.save();                 // Save the current state
    ctx.translate(x,y);         // the rectangle is at the origin
    ctx.rotate(-Math.PI / 2);   // Rotate the canvas 90 degrees counterclockwise
    ctx.fillStyle = cText
    ctx.fillText(text, -h/2 - ctx.measureText(text).width/2  , 0.75*w)  // center the text
    ctx.restore();              // Restore the state
},

// draw straigth 
drawBusbar(ctx, p, cLine, wLine) {

    const wSave = ctx.lineWidth

    if (p.len < 2) return
    ctx.beginPath()
    ctx.lineWidth = wLine
    ctx.strokeStyle = cLine
    ctx.moveTo(p[0].x, p[0].y)
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y)
    ctx.stroke()

    ctx.lineWidth = wSave
},

drawCable(ctx, p, cLine, wLine) {

    if (p.len < 2) return

    const wSave = ctx.lineWidth

    ctx.beginPath()
    ctx.lineWidth = wLine 
    ctx.strokeStyle = cLine
    ctx.moveTo(p[0].x, p[0].y)
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y)
    ctx.stroke()

    ctx.lineWidth = wLine - 4
    ctx.strokeStyle = '#000000'
    ctx.moveTo(p[0].x, p[0].y)
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y)
    ctx.stroke()

    ctx.lineWidth = wLine - 6
    ctx.strokeStyle = cLine
    ctx.moveTo(p[0].x, p[0].y)
    for (let i=1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y)
    ctx.stroke()

    ctx.lineWidth = wSave
},

drawPoints(ctx,points) {

    // check
    let l = points.length
    if (l < 2) return

    const arcRadius = 7.5
    const arcSpace = 15

    // ..move to the first point
    ctx.moveTo(points[0].x, points[0].y)

    // draw the segments ..
    for (let i=0; i < l-1; i++) {

        const a = points[i]
        const b = points[i+1]

        // ..if there is enough space..
        if (( Math.abs(a.y - b.y)  >= arcSpace ) || (  Math.abs(a.x - b.x)  >= arcSpace )) 

            // ..draw a line with an arc..
            ctx.arcTo(a.x, a.y, b.x, b.y, arcRadius)
        
        else {
            // ..otherwise draw a right angle
            ctx.lineTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
        }
    }

    // ..but the last segment is straight.
    ctx.lineTo(points[l-1].x, points[l-1].y)
    ctx.stroke()
},

drawWire(ctx, color, width, points) {

    ctx.beginPath()

    ctx.lineWidth = width
    ctx.strokeStyle = color

    this.drawPoints(ctx, points)
},

// draw twisted segments with an arc
twistedPair(ctx, color, width, points) {

    // we have segments to draw..
    ctx.beginPath()

    // set the linewidth
    ctx.strokeStyle = color
    ctx.lineWidth = 2*width

    // the dash pattern
    //ctx.setLineDash([3,3])
    //ctx.setLineDash([24,4,3,4])

    this.drawPoints(ctx, points)

    // reset the dash pattern to nothing
    //ctx.setLineDash([])
},

}
