import {convert} from './convert.js'
// The styling parameters for the editor

// Checks if a color is a valid hex color
function isValidHexColor(hex) {
    const regex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
    return regex.test(hex);
}

// fixed colors
const color = {

    // The base colors for the nodes etc
    shade1: '#fff',
    shade2: '#fff',
    shade3: '#fff',
    shade4: '#fff',
    shade5: '#fff',

    // view colors
    view1:  '#222',
    view2:  '#444',
    vIcon1: '#fd4d0c',
    vIcon2: '#3399ff',
    vIcon3: '#33cc33',
    vIcon4: '#e9bb16',

    // absolute node colors
    select:      '#ff8000',
    selectT:     '#ff800022',
    add:         '#7fff00',
    highLight:   '#ff80ff',

    icon1: '#00ffff',
    icon2: '#00ffff',
    icon3: '#00ffff',
    icon4: '#00ffff',

    // grey 
    grey3: '#333',
    grey6: '#666',
    greyC: '#ccc',

    // absolute colors
    black:  '#000',
    white:  '#fff',
    red:    '#FE2712', 
    redT:   '#FE271222', 
    blue:   '#0000ff',

    // set the shades for this color object
    setShades(rgb) {

        // transform the hex color to hsl
        const hsl = convert.hexToHsl(rgb)

        // take the hue
        const comma1 = hsl.indexOf(',',4)
        const comma2 = hsl.indexOf(',',comma1+1)
        const hue = hsl.substring(4, comma1)
        const sat = hsl.substring(comma1+1, comma2)

        // change the shades
        this.shade1 = convert.hslToHex(`hsl(${hue},${sat},40%,1)`)          // box, seperator line, pin unconnected, title background
        this.shade2 = convert.hslToHex(`hsl(${hue},${sat},30%,0.50)`)       // box bg, pad bg - 0.5 transparency
        this.shade3 = convert.hslToHex(`hsl(${hue}, 100%, 90%, 1)`)         // title
        this.shade4 = convert.hslToHex(`hsl(${hue},${sat},60%,1)`)          // pin connected
        this.shade5 = convert.hslToHex(`hsl(${hue}, 50%, 75%, 1)`)          // ifPins


        // change the shades - dark theme...
        // this.shade1 = convert.hslToHex(`hsl(${hue},0%,40%,1)`)          // box, seperator line, pin unconnected, title background
        // this.shade2 = convert.hslToHex(`hsl(${hue},0%,20%,0.50)`)       // box bg, pad bg - 0.5 transparency
        // this.shade3 = convert.hslToHex(`hsl(${hue},100%, 50%, 1)`)      // icon, title
        // this.shade4 = convert.hslToHex(`hsl(${hue},0%,75%,1)`)          // route, bus, seperator text, pin connected
    }
}

// get a style object - it uses the colors above
// ** check adapt() below for the allocation of the shades ***
function StyleFactory() {

    // save the new rgb
    this.rgb = "#fff"

    this.std = {
        font: "normal 12px tahoma", lineCap: "round",  lineJoin: "round", lineWidth: 1.0, 
        cBackground: color.black, cLine: color.white, cFill: color.blue,
        wCursor: 2, blinkRate: 500, cBlinkOn: color.white, cBlinkOff: color.black
    } 
    this.look = {
        wBox:150, hTop:20, hBottom:6, wExtra:15, wMax:300, dxCopy: 20, dyCopy:20,  smallMove: 5, 
    } 
    this.box = {
        rCorner:7.5,  wLine:2, cLine: color.shade1, cBackground:color.shade2, 
        cSelected: color.selectT, cAlarm: color.redT, dxSel:10, dySel:10, wLineSel: 1
    }
    this.header = {
        font: "normal 13px tahoma", hHeader:15, hTitle:15, wLine:1, wChar:6, rCorner:7.5,
        cTitle: color.shade3, cBackground: color.shade1, cBad: color.red, cHighLighted: color.highLight
    }

    this.icon = {
        wIcon:8, hIcon:10, blinkRate: 500, nBlinks: 2,
        cSrc:color.shade5, cLink: color.shade5, cGroup: color.shade5, cCog: color.shade5, cPulse: color.shade5, cComment: color.shade5,
        cBadLink: color.red, cAlarm: color.red, cHighLighted: color.highLight,
        xPadding:6, yPadding:2, xSpacing:4,
    }

    this.label = {
        font: "italic 12px tahoma", hLabel: 15, cNormal: color.greyC,
    }
    this.ifName = {
        font: "normal 12px tahoma", hSep: 15, cNormal: color.shade5, cBackground: color.shade1, cAdded: color.add, cBad: color.red, 
        cSelected: color.select, cHighLighted: color.highLight
    }
    this.pin = {
        hPin: 15,  wOutside:10, wMargin:21, hArrow:10, wArrow:10, wChar:7,
        cNormal: color.shade1, cSelected: color.select, cHighLighted: color.highLight, 
        cConnected: color.shade4, cAdded: color.add,  cBad: color.red, cText: color.shade1,  cCursor: color.black,
        fMulti: "italic 11px tahoma"
    } 
    this.pad = {
        hPad: 15,hSpace: 15, rBullet: 7.5, wArrow:10, hArrow:10, wExtra: 30, wMargin:4,  wViewLeft: 10,  wViewRight: 100, 
        cBackground: color.shade2, cSelected: color.select, cHighLighted: color.highLight, cConnected: color.shade4, 
        cBad: color.red, cText: color.shade1, cArrow:color.shade1, 
    } 
    this.route = {
        wSelected: 2, wNormal: 2, split: 30, tooClose: 15, 
        cNormal: color.shade4, cSelected: color.highLight, cHighLighted: color.highLight , cNotUsed: color.grey3, 
        cAdded: color.add, cDeleted: color.red
    } 
    this.bus = {
        wNormal: 6, wBusbar: 6, wCable: 6, wSelected: 6, split: 50, tooClose: 25, wArrow : 10, hArrow : 10, sChar: 5, hLabel: 15, radius: 7.5, wFilter: 15,
        cNormal: color.shade4, cSelected: color.highLight, cHighLighted: color.highLight, cBad: color.red, cText: color.black, hAlias:15, fAlias: "italic 11px tahoma"
    } 
    this.selection = {
        xPadding: 20, yPadding: 20, 
        cRect: color.selectT, cPinGroup: color.selectT, wLine: 0, rCorner: 7.5,
    } 
    this.view = {
        wDefault: 800, hDefault: 500, wLine: 4, rCorner: 15, wExtra:200, hExtra: 20,
        cBackground: color.black, cLine:color.view1, cHighLight: color.view2,

        // The header
        fHeader: "normal 15px arial", hHeader: 20, cTitle: color.grey6, cTitleHighLight: color.shade3,

        // The grid
        grid: {dx: 30, dy: 30, cLine: color.grey3, cAxis: color.grey6},

        // The icons
        wIcon:10, hIcon:10, xPadding:10, xSpacing:8, cDim: color.grey6,
        cClose: color.vIcon1, cFullscreen: color.vIcon2, cCalibrate: color.vIcon3, cGrid: color.vIcon4
    }
    this.placement = {
        marginTop: 30, marginLeft: 90, marginLeftPads: 210, nodesPerRow: 5, rowStep: 360, colStep: 300, spacing: 50, tolerance: 10, padGutterGap: 60
    }
    this.autoroute = {
        xMargin: 15, xDelta: 10, yDelta: 15
    }
}
StyleFactory.prototype = {

    // changes to a new style and returns the previous style
    switch( newStyle ) {
        if (!newStyle) return style
        const previous = style
        style = newStyle
        return previous
    },

    // create a new style
    create: (rgb) => isValidHexColor(rgb) ? new StyleFactory().adapt(rgb) : new StyleFactory().adapt("#00aaff"),

    // change the shades of the variable items
    adapt(rgb) {

        // save
        this.rgb = rgb

        // change the specific color
        color.setShades(rgb)

        // shade1
        this.box.cLine = 
        this.header.cBackground = 
        this.ifName.cBackground = 
        this.pin.cNormal = 
        this.pin.cText = color.shade1;

        // shade2
        this.box.cBackground = 
        this.pad.cBackground = color.shade2;

        // shade 3
        this.header.cTitle =
        this.view.cTitleHighLight = color.shade3;

        // shade4
        this.route.cNormal =
        this.bus.cNormal = 
        this.pin.cConnected = 
        this.pad.cConnected = color.shade4;

        // shade5
        this.icon.cSrc = 
        this.icon.cCog = 
        this.icon.cPulse = 
        this.icon.cComment = 
        this.icon.cLink = 
        this.icon.cGroup =
        this.ifName.cNormal = color.shade5;

        // return this for chaining
        return this
    }

    // a small function to test color settings interactively (see editor-message.js onShowSettings)
    ,adaptinteractive(rgb) {
        this.route.cNormal = rgb;
    }
}

// The style that is active at a given moment. Set to a default style.
export let style = new StyleFactory().adapt("#0066ff")
