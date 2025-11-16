// The ifName for most compact representations is '|'
const I = '|'

export const convert = {

    rectToString : rc => rc ? `x ${Math.round(rc.x)} y ${Math.round(rc.y)} w ${Math.round(rc.w)} h ${Math.round(rc.h)}` : 'x 0 y 0 w 0 h 0',

    stringToRect : str => {

        let a = str.indexOf("x")
        let b = str.indexOf("y")
        let c = str.indexOf("w")
        let d = str.indexOf("h")
        return {
            x: parseFloat(str.slice(a+1,b)),
            y: parseFloat(str.slice(b+1,c)),
            w: parseFloat(str.slice(c+1,d)),
            h: parseFloat(str.slice(d+1))
        }
    },

    // returns the rectangle string relative to the big rectangle
    relativeRect : (r,R) =>  `x ${Math.round(r.x - R.x)} y ${Math.round(r.y - R.y)} w ${Math.round(r.w)} h ${Math.round(r.h)}`,

    transformToString : tf => `sx ${tf.sx.toFixed(3)} sy ${tf.sy.toFixed(3)} dx ${tf.dx.toFixed(3)} dy ${tf.dy.toFixed(3)}`,

    stringToTransform : str => {
        let a = str.indexOf("sx")
        let b = str.indexOf("sy")
        let c = str.indexOf("dx")
        let d = str.indexOf("dy")

        if (a<0 || b<0 || c<0 || d<0) return {sx: 1.0, sy: 1.0, dx: 0, dy:0}
        
        return {
            sx: parseFloat(str.slice(a+2,b)),
            sy: parseFloat(str.slice(b+2,c)),
            dx: parseFloat(str.slice(c+2,d)),
            dy: parseFloat(str.slice(d+2))
        }
    },

    stringToPosition: str => {

        const comma = str.indexOf(',')
        if (comma < 0) return {rect:{x:0, y:0, w:0, h:0}, left:false}
        const rect = convert.stringToRect(str.slice(0,comma))
        const left = str.slice(comma+1).trim() === 'left'
        return {rect, left}
    },

    stringToUidWid(str) {
        const period = str.indexOf('.')
        if (period < 0) return [str, 0]
        return [str.slice(0,period), +str.slice(period+1)]
    },

    stringToWid(str) {
        const period = str.indexOf('.')
        if (period < 0) return 0
        return +str.slice(period+1)
    },

    stringToId(str) {
        const a = str.indexOf(I)

        return {
            uid: str.slice(0,a),
            name: str.slice(a+1)
        }
    },

    pointToString(point) {
        return `x ${point.x} y ${point.y}`;
    },
    
    stringToPoint(str) {
        const match = str.match(/x\s*(-?\d+\.?\d*)\s*y\s*(-?\d+\.?\d*)/);
        if (match) {
            return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
        return null
    },

    // returns the segment lengths in x and y direction
    wireToString: wire => {

        if (wire.length < 2) return ""

        const parts = []

        // save the segments
        for (let i = 1; i < wire.length; i++) {

            // get the step in x and y direction
            const dx = (wire[i].x - wire[i-1].x);
            const dy = (wire[i].y - wire[i-1].y);

            // save either in x or y direction
            Math.abs(dx) > Math.abs(dy) ? parts.push('x '+ dx.toFixed(1)) : parts.push('y '+ dy.toFixed(1))
        }
        return parts.join(' ')
    },

    stringToWire(start, end, wireString) {

        if (!wireString || wireString.length < 1) return []

        // build from the start
        if (start) {

            // build from the start
            let {x,y} = {...start}

            // set the first point
            let wire = [{x,y}];

            // split the string in parts
            const parts = wireString.split(" ");

            for (let i = 0; i < parts.length; i += 2) {

                const direction = parts[i];
                const length = parseFloat(parts[i + 1]);
                direction === "x" ? x += length : y += length
                wire.push({x,y});
            }
        
            return wire;           
        }
        
        // build from the end
        if (end) {

            // if we have no starting point, build the wire from the end
            let {x,y} = {...end}

            // set the first point
            let wire = [{x,y}];

            // split the string in parts
            const parts = wireString.split(" ").reverse()

            for (let i = 0; i < parts.length; i += 2) {

                const direction = parts[i+1]
                const length = parseFloat(parts[i]) 
                direction === "x" ? x -= length : y -= length
                wire.push({x,y});
            }
        
            return wire.reverse();          
        }
        else return []
    },

    routeToString(route) {

        // used below
        let from = route.from
        let to  = route.to

        //const pinString = (pin) =>  '(pin) ' + pin.name + ' @ ' + pin.node.name
        const pinString = (pin) =>  `(pin ${pin.wid}) ${pin.name} @ ${pin.node.name}`
        const busString = (tack) => '(bus) ' + tack.bus.name
        //const padString = (pad) =>  '(pad) ' + pad.proxy.name
        const padString = (pad) =>  `(pad ${pad.proxy.wid}) ${pad.proxy.name}`
        const itfString = (itf) =>  '(itf) ' + itf.name + ' @ ' + itf.node.name

        // check if the route is drawn from input to output or the other way around
        const fromTo = () => {
            if (to.is.pin) return to.is.input
            if (from.is.pin) return ! from.is.input
            if (to.is.pad) return to.proxy.is.input
            if (from.is.pad) return ! from.proxy.is.input
        }

        const strRoute = {}

        // arrange so that flow is from -> to
        if (fromTo()) {

            from.is.pin ? strRoute.from = pinString(from) :
            from.is.pad ? strRoute.from = padString(from) : 
            from.is.tack ? strRoute.from = busString(from) : null

            to.is.pin ? strRoute.to = pinString(to) :
            to.is.pad ? strRoute.to = padString(to) : 
            to.is.tack ? strRoute.to = busString(to) : null

            strRoute.wire = convert.wireToString(route.wire)
        }
        else {

            to.is.pin ? strRoute.from = pinString(to) :
            to.is.pad ? strRoute.from = padString(to) : 
            to.is.tack ? strRoute.from = busString(to) : null

            from.is.pin ? strRoute.to = pinString(from) :
            from.is.pad ? strRoute.to = padString(from) : 
            from.is.tack ? strRoute.to = busString(from) : null

            strRoute.wire = convert.wireToString(route.wire.slice().reverse())
        }

        return strRoute
    },

    // and endpoint starts with (pin) (pad) (bus) or (itf)
    rawToEndPoint(raw) {

        const kind = raw.trim().slice(1,4)
        let clbr=0, wid=0, at=0

        switch(kind) {

            case 'pin': 
                clbr = raw.indexOf(')')
                wid = raw.slice(4,clbr).trim()
                at = raw.indexOf('@')
                return {
                    pin: raw.slice(clbr+1,at).trim(),
                    wid: wid.length > 0 ? +wid : 0,
                    node: raw.slice(at+1).trim()  
                }

            case 'pad': 
                clbr = raw.indexOf(')')
                wid = raw.slice(4,clbr).trim()            
                return {
                    pad: raw.slice(clbr+1).trim(),
                    wid: wid.length > 0 ? +wid : 0
                }

            case 'bus': return {bus: raw.slice(5).trim()}

            case 'itf': return {itf: raw.slice(5).trim()}
        }
    },

    cleanInput(userInput) {
        return userInput
            .trim()                            // remove leading/trailing whitespace
            .replace(/\s+/g, ' ')              // collapse multiple spaces into one
            .replace(/@|->|=>/g, '')           // remove all '@' and '->' and '=>'
    },

    cleanLink(lName) {
        return lName
            .split('@')                            // split into name and group parts
            .map(part => convert.cleanInput(part).trim()) // clean each part
            .filter(part => part.length > 0)       // drop empty parts
            .join(' @ ');                          // reassemble with consistent spacing
    },

    // return an array with the parts of the link in an array
    splitLink(str) {
        return str
            .split('@')                      // split on '@'
            .map(part => part.trim())        // clean each part
            .filter(part => part.length > 0) // remove empty parts
            .reverse();                      // reverse: outermost to innermost
    },



    // check if a pin has a multi structure
    isMulti: str => {

        // now get the brackets
        const opbr = str.indexOf('[')
        const clbr = str.lastIndexOf(']')

        return ((opbr > -1) && (clbr > -1) && (clbr > opbr))
    },

    // extract the names between square brackets:  'any text [selector a, selector b, ...] any text'
    extractMultis: str => {

        const [pre, middle, post] = convert.getPreMiddlePost(str)

        // split, trim an filter
        return middle.split(',')
    },

    // makes a list of all full message names - if there are no multis, just returns the message in an array
    expandMultis: str => {

        const [pre, middle, post] = convert.getPreMiddlePost(str)

        // split, trim an filter
        const multis = middle.split(',')

        // re-assemble
        return multis.map(name => pre + name + post)
    },

    cleanMulti(str) {

        //get the parts before and after the multi part
        const [pre, middle, post] = convert.getPreMiddlePost(str)

        // reassemble the name
        return pre + '[' + middle + ']' + post
    },

    // get the part before and after a multi message
    getPreMiddlePost(str) {
        // now get the brackets
        const opbr = str.indexOf('[')
        const clbr = str.lastIndexOf(']')

        // get the parts before and after the multi part
        let pre = str.slice(0,opbr).trim()
        let middle = str.slice(opbr+1, clbr).split(',').map(n=>n.trim()).filter(Boolean).join(',')
        let post = str.slice(clbr+1).trim()

        // if there is no point or hyphen, we add a space
        const last = pre.at(-1)
        if ((pre.length > 0)&&(last != '.') && (last != '-') && (last != '_')) pre = pre + ' '
        const first = post[0]
        if ((post.length > 0)&&(first != '.') && (first != '-') && (first != '_')) post = ' ' + post

        return [pre, middle, post]
    },

    // a pin name that has been edited can start or end with a '+
    //hasPlus: str => str[0] == '+' || str.at(-1) == '+' ,

    needsPrefix: str => {
        const first = str[0]
        return (first == '+' || first == '.' || first == '-' || first == '_')
    },

    needsPostfix: str => {
        const last = str.at(-1)
        return (last == '+' || last == '.' || last == '-' || last == '_')
    },

    // add the prefix / postfix to a message
    combineWithPrefix(prefix, name) {

        // Default is just the name
        let complete = name

        const first = name[0]

        // Prefix
        if (first == '.' || first == '-' || first == '_') {
            const clean = name.slice(1).trim()
            complete = prefix + first + clean;
        }
        else if (first == '+') {
            const clean = name.slice(1).trim()
            complete = prefix + ' ' + clean
        }
        
        // done
        return complete
    },

    // add the prefix / postfix to a message
    combineWithPostfix(postFix, name) {

        // Default is just the name
        let complete = name
        const last = name.at(-1)

        if (last == '.' || last == '-' || last == '_') {
            const clean = name.slice(0,-1).trim()
            complete = clean + last + postFix;
        }
        else if (last == '+') {
            const clean = name.slice(0,-1).trim()
            complete = clean + ' ' + postFix
        }
        
        // done
        return complete
    },

    prefixMatch(prefix, name) {

        if (name.startsWith(prefix)) {

            const first = name[prefix.length]
            return ((first == '.') || (first == '-') || (first == ' ') || (first == '_'))
        }
    },

    postfixMatch(postfix, name) {

        if (name.endsWith(postfix)) {

            const last = name.at(-postfix.length-1)
            return ((last == '.') || (last == '-') || (last == ' ') || (last == "_"))
        }
    },

    // add the prefix / postfix to a message
    xxcombineWithPrefix(prefix, name) {

        // Default is just the name
        let complete = name

        // Prefix
        if (name[0] == '+') {

            const clean = name.slice(1).trim()

            // if there is some sort of a seperation character keep it
            if ((clean[0] == '.') || (clean[0] == '-') || (prefix.at(-1) == '.') || (prefix.at(-1) == '-')) 
                complete = prefix + clean
            else 
                // otherwise use a space
                complete = prefix + ' ' + clean
        }
        // Postfix
        else if (name.at(-1) == '+') {

            const clean = name.slice(0,-1).trim()

            if ((clean.at(-1) == '.') || (clean.at(-1) == '-') || (prefix[0] == '.') || (prefix[0] == '-')) 
                complete = clean + prefix
            else 
                complete = clean + ' ' + prefix
        }
        
        // done
        return complete
    },

    // change a string abcdef to abcdef(1) and a string abcdef(3) to abcdef(n)
    addNumber: (str, n) => {

        // Find the position of the last '(' in the string
        const opbr = str.lastIndexOf('(');
        const clbr = str.lastIndexOf(')');
    
        // Check if the last '(' is followed by a ')' and contains only digits between them
        if (opbr !== -1 && clbr === str.length - 1) {

            // get the number part
            const numberPart = str.slice(opbr + 1, clbr);

            // check if a number
            if (!isNaN(numberPart) && numberPart !== '') {

                // Replace the number with the newNumber
                return str.slice(0, opbr + 1) + n.toString() + ')'
            }
        }
        return str + '(' + n.toString() + ')'
    },

    viewToJSON: (view) => {

        let state, rect, transform

        // view can still be in its 'raw' format { state, rect, transform }
        if (view.viewState) {
            state = view.viewState.visible ? (view.viewState.big ? 'big':'open' ) : 'closed';
            rect = view.viewState.big ? convert.rectToString(view.viewState.rect): convert.rectToString(view.rect)
            transform = convert.transformToString(view.tf)
        }
        else {
            state = view.status
            rect = convert.rectToString( view.rect)
            transform = convert.transformToString(view.tf)
        }

        // done
        return {
            state, rect, transform
        }
    },

    stringToView: (rawView) => {

        // the view itself will be restored 
        return {   
            raw:    true,
            state:  rawView.state,
            rect:   convert.stringToRect( rawView.rect), 
            tf:     convert.stringToTransform(rawView.transform)
        }
    },

    // // The clean pin name is used to check if pins are connected
    // cleanPinName: (pinName) => {
    //     return pinName
    //         .toLowerCase()
    //         .replace(/\s+/g, ' ')             // collapse multiple spaces
    //         .trim();                          // remove leading/trailing spaces
    // },
   
    // transforms a name to a valid javascript camel-cased identifier
    pinToHandler(pinName) {
        const words = pinName
            // split on space, dot, or hyphen
            .split(/[ .-]+/)
            // Remove illegal characters from each segment, but keep underscores
            .map(w => w.replace(/[^a-zA-Z0-9_]/g, ''));

        // Remove empty segments (e.g. from "foo..bar")
        const cleaned = words.filter(Boolean);

        // CamelCase construction
        return 'on' + cleaned.map( word => word[0].toUpperCase() + word.slice(1)).join('');
    },

    // transforms a name to a valid javascript camel-cased identifier, starting with an upper case letter
    nodeToFactory: (nodeName) => {

       const words = nodeName
            // Convert to lowercase 
            .toLowerCase()
            // and split on space, dot, or hyphen
            .split(/[ .-]+/)
            // Remove illegal characters from each segment, but keep underscores
            .map(w => w.replace(/[^a-z0-9_]/g, ''));

        // Remove empty segments (e.g. from "foo..bar")
        const cleaned = words.filter(Boolean);

        // CamelCase construction
        let factory = cleaned
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join('');

        // If it starts with a digit, prefix with underscore
        if (/^[0-9]/.test(factory))  factory = '_' + factory;

        return factory;
    },

    // skip the first part of the path name
    skipPrefix: (path) => {
        // find the second slash (path starts with a slash)
        let slash = path.indexOf('/', 1)

        // check
        return slash < 0 ? path : path.slice(slash)
    },

    // convert specific characters to dashes
    spaceToDash: name => {
        // check if there are spaces
        if (!name.includes(' ')) return name

        // replace spaces with dashes
        let newName = ''
        for(let i=0;i<name.length;i++) newName += name[i] == ' ' ? '-' : name[i]
        return newName
    },

    // extracts the base name from a given name
    toBaseName: name => {
        const pos = name.indexOf('-model')
        return pos > 0 ? name.slice(0, pos) : name
    },

    // convert to the name for the source code outline
    nameToSource: name => convert.spaceToDash(name) + '.js',

    // convert the name of a node to a file name for the model
    nameToModel: name => convert.spaceToDash(name) + '.json',

    // convert a name to a lib build file name
    nameToBuild: name => convert.spaceToDash(name) + '.js',

    // convert a name to a app file name
    nameToApp: name => convert.spaceToDash(name) + '.js',

    // convert a name to a html start page
    nameToPage: name => convert.spaceToDash(name) + '.html',

    // converts an object to a javascript literal
    objectToJsLiteral(obj, indent = 4) {
        return JSON.stringify(obj, (key, value) => {
            // Convert undefined to a placeholder string
            if (value === undefined) return '__undefined__';
            return value;
        }, indent)
        .replace(/"__undefined__"/g, 'undefined')
        .replace(/"([^"]+)":/g, '$1:') // remove quotes around keys
        .replace(/"([^"]*)"/g, (_, str) => `'${str.replace(/'/g, "\\'")}'`); // single-quote strings
    },


    djb2: (str) => {
        var hash = 5381;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
        }
        const h = Math.abs(hash & ((2**32)-1)).toString(16).padStart(8,'0')

        // split into two times two bytes
        // return h.slice(0,4) + '-' + h.slice(4)
        return h
    },

    hexToHsl(rgb) {
        // Extract the RGB values from the hex string
        let r = parseInt(rgb.slice(1, 3), 16) / 255;
        let g = parseInt(rgb.slice(3, 5), 16) / 255;
        let b = parseInt(rgb.slice(5, 7), 16) / 255;
        let a = 1

        // do I have an alpha
        if (rgb.length > 7) {
            a = parseInt(rgb.slice(7, 9), 16) / 255
        }
        
        // Find the maximum and minimum values among R, G, and B
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            // Achromatic
            h = s = 0; 
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
        
            h /= 6;
        }
        
        // Convert to percentages
        s *= 100;
        l *= 100;
        h *= 360; // Convert hue to degrees
        
        return a == 1   ? `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`
                        : `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${a})`
    },
      
    // hsl = hsl(h,s%,l%, t)
    hslToHex(hsl) {

        let sep = hsl.indexOf(",") > -1 ? "," : " ";
        let parts = hsl.substring(4, hsl.lastIndexOf(")")).split(sep)

        let h = parseFloat(parts[0]),
            s = parseFloat(parts[1]) / 100, // Remove the '%' and convert to fraction
            l = parseFloat(parts[2]) / 100, // Remove the '%' and convert to fraction
            t = parseFloat(parts[3]);
        
        let c = (1 - Math.abs(2 * l - 1)) * s,
            x = c * (1 - Math.abs((h / 60) % 2 - 1)),
            m = l - c/2,
            r = 0, g = 0,b = 0, a = 'ff'
        
        if (0 <= h && h < 60) {
            r = c; g = x; b = 0;  
        } else if (60 <= h && h < 120) {
            r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
            r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
            r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
            r = x; g = 0; b = c;
        } else if (300 <= h && h < 360) {
            r = c; g = 0; b = x;
        }
        
        r = Math.round((r + m) * 255).toString(16);
        g = Math.round((g + m) * 255).toString(16);
        b = Math.round((b + m) * 255).toString(16);
        a = t==1 ? 'ff' : Math.round(t * 255).toString(16);
        
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        if (a.length < 2) b = "0" + a;

        return a == 'ff' ? "#" + r + g + b : "#" + r + g + b + a
    }
      
}