
// a function to check if a point is inside or outside a rectangle
export const inside =  (p,R) => ((p.x >= R.x) && (p.x <= R.x + R.w) && (p.y >= R.y) && (p.y <= R.y + R.h)) 
export const outside = (p,R) => ((p.x < R.x) || (p.x > R.x + R.w) || (p.y < R.y) || (p.y > R.y + R.h))

//export const onBorder = (p,R,d) => ((p.x <= R.x + d) || (p.x >= R.x - R.w - d) || (p.y <= R.y + d) || (p.y <= R.y + R.h - d))
// const dx = 2
// const dy = 2
// export const inBigRect    = (p,R) => ((p.x >= R.x - dx) && (p.x <= R.x + R.w + dx) && (p.y >= R.y - dy) && (p.y <= R.y + R.h + dy)) 
// export const outSmallRect = (p,R) => ((p.x <= R.x + dx) || (p.x >= R.x - R.w - dx) || (p.y <= R.y + dy) || (p.y <= R.y + R.h - dy))

// export const onBorder = (p,R,d) => {
//     // if inside the big rectangle and outside small rectangle..
//     return   ((p.x >= R.x - dx) && (p.x <= R.x + R.w + dx) && (p.y >= R.y - dy) && (p.y <= R.y + R.h + dy)) 
//             ? (p.x <= R.x + dx) || (p.x >= R.x - R.w - dx) || (p.y <= R.y + dy) || (p.y <= R.y + R.h - dy) 
//             : false
// }

// we know p lies inside the rectangle
export const whichBorder = (p,R,d) => {

        if (p.x <= R.x + d)        return 'left'
        if (p.x >= R.x + R.w - d)  return 'right'
        if (p.y <= R.y + d)        return 'top'
        if (p.y >= R.y + R.h - d)  return 'bottom'

        return null
}

// returns a random 64 bit number as a 16 char hexadecimal string
export function makeUID() {
    return (  Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1)
            + Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1))
}

// returns a random 64 bit 
export function randomBigInt64() {

    // Generate two random 32-bit number as a BigInt
    const lower32Bits = BigInt(Math.floor(Math.random() * 0xFFFFFFFF))
    const upper32Bits = BigInt(Math.floor(Math.random() * 0xFFFFFFFF))

    // Combine them into a 64-bit BigInt
    return BigInt.asUintN(64, (upper32Bits << 32n ) | lower32Bits)
}

// makes a random string from a 64 character set
const c64 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-!'
const l64 = c64.length
export function rndStr64Set(len) {
    let rs = ''
    for (let i = 0; i < len; i++) {
        let p = Math.floor(Math.random() * l64)
        rs += c64[p]
    }
    return rs
}

// makes a random string from a given characterset
const sAlfa = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const lAlfa = sAlfa.length 
export function rndAlfa(n) {
    let str = ''
    for (let i = 0; i < n; i++) {
        let p = Math.floor(Math.random() * lAlfa)
        str += p < lAlfa ? sAlfa[p] : sAlfa[lAlfa-1]
    }
    return str
}

// random string from a section of the UTF16 codepoints
export function rndStr(len) {

    // get an array 
    const n = Array(len).fill(0)

    // fill with random number sbetween 32 and 126
    const rn = n.map(() => 32 + Math.floor(Math.random()*126))

    // convert to char from space to ~
    return String.fromCodePoint(...rn)
}

// BETTER EJECT
export function eject(arr, el) {
    // remove an element from an array
    const i = arr.indexOf(el)
    if (i >= 0) arr.splice(i, 1)
    return i >= 0
}

// remove an element from an array
// export function eject(arr, el) {

//     // get the length of the array
//     let L = arr.length

//     // go through all elements
//     for (let i=0; i<L; i++) {

//         // check if found
//         if (el == arr[i]) {

//             // shift the elements below one position up
//             for (let j=i; j<L-1; j++) arr[j] = arr[j+1]

//             // the array is one position shorter
//             arr.pop()

//             // no need to continue
//             return true
//         }
//     }
//     // not found
//     return false
// }

// find a string in a sorted table 
export function findInTable(msg, table) {

    // the entries to search between
    let low = 0,middle = 0, high = table.length - 1, entry

    // search the table
    while (low <= high) {

        middle = (low+high)>>1
        entry = table[middle]
        if (entry.msg > msg) high = middle - 1
        else if (entry.msg < msg) low = middle + 1
        else return entry
    }

    // nothing was found 
    return null
}

// returns the segments that cut the rectangle
export function segmentsInside(p, r) {

    if (p.length < 2) return null

    const segments = []
    let a =0, b=0
    for (let i=0; i<p.length-1;i++) {
        a = p[i]
        b = p[i+1]

        // x direction 
        if ( ( (a.y > r.y) && (a.y < r.y + r.h)) && ((b.y > r.y) && (b.y < r.y + r.h) )) {

            if ( ((a.x < r.x + r.w) && (b.x > r.x)) || ((b.x < r.x + r.w)&&( a.x > r.x))) segments.push(i+1)
        }
        // y-direction
        else if ( ( (a.x > r.x) && (a.x < r.x + r.w)) && ((b.x > r.x) && (b.x < r.x + r.w) )) {

            if (((a.y < r.y + r.h) && (b.y > r.y))||((b.y < r.y + r.h) && (a.y > r.y))) segments.push(i+1)
        }
    }
    return segments
}

// in order not to cut both points have to be in an area above, below, right or left of the rectangle
export function mightCutRectangle(p1,p2,rc) {

    const left = rc.x
    const right = rc.x + rc.w
    const bottom = rc.y
    const top = rc.y + rc.h

    if ((p1.x <= left && p2.x <= left)||(p1.x >= right && p2.x >= right) ||
        (p1.y <= bottom && p2.y <= bottom) ||(p1.y >= top && p2.y >= top)) return false

    return true
}

// The correct and elaborate version of the function above
// returns true if the line segment p1 p2 cuts the rectangle
// The cases where the points are exactly on the edge do not count as cuts
export function cutsRectangle(p1, p2, rc) {

    // Define rectangle boundaries (rc.x, rc.y is bottom-left, width and height are positive)
    const left   = rc.x;
    const right  = rc.x + rc.w;
    const bottom = rc.y;
    const top    = rc.y + rc.h;
  
    // Trivial rejection: if both points are strictly on one side of the rectangle.
    if ((p1.x <= left && p2.x <= left) || (p1.x >= right && p2.x >= right) ||
        (p1.y <= bottom && p2.y <= bottom) || (p1.y >= top && p2.y >= top)) {
        return false;
    }
  
    // If either endpoint is strictly inside the rectangle, we consider that as a cut.
    if (p1.x > left && p1.x < right && p1.y > bottom && p1.y < top) return true;
    if (p2.x > left && p2.x < right && p2.y > bottom && p2.y < top) return true;
  
    // Helper function: checks intersection with a vertical line (x = k)
    // Returns true if the intersection y coordinate lies within the rectangle's vertical bounds.
    const checkVertical = (k) => {
        // Avoid division by zero if p2.x equals p1.x (vertical line)
        if (p2.x === p1.x) return false;
        const t = (k - p1.x) / (p2.x - p1.x);
        if (t > 0 && t < 1) {
            const y = p1.y + t * (p2.y - p1.y);
            return y > bottom && y < top;
        }
        return false;
    };
  
    // Helper function: checks intersection with a horizontal line (y = k)
    // Returns true if the intersection x coordinate lies within the rectangle's horizontal bounds.
    const checkHorizontal = (k) => {
        // Avoid division by zero if p2.y equals p1.y (horizontal line)
        if (p2.y === p1.y) return false;
        const t = (k - p1.y) / (p2.y - p1.y);
        if (t > 0 && t < 1) {
            const x = p1.x + t * (p2.x - p1.x);
            return x > left && x < right;
        }
        return false;
    };
  
    // Check intersection with the left and right vertical edges.
    if (checkVertical(left)) return true;
    if (checkVertical(right)) return true;
  
    // Check intersection with the bottom and top horizontal edges.
    if (checkHorizontal(bottom)) return true;
    if (checkHorizontal(top)) return true;
  
    return false;
  }
  

export function logObject(obj) {
    //Don't use console.log(obj), use console.log(JSON.parse(JSON.stringify(obj))).
    console.log(JSON.parse(JSON.stringify(obj)))
}

export function blockDistance(p1, p2) {
    return Math.abs(p2.x - p1.x)  + Math.abs(p2.y - p1.y)
}

// returns a point and the segment on which the point lies 
export function closestPointOnCurve(curve, q) {

    let minDistance = Infinity;
    let point = null;
    let segment = 0;
    let endPoint = false;   // true if the closest point is and endpoint of the segment

    for (let i = 0; i < curve.length - 1; i++) {
        let { x: x1, y: y1 } = curve[i];
        let { x: x2, y: y2 } = curve[i + 1];

        if (x1 === x2) { // Vertical segment
            if (Math.min(y1, y2) <= q.y && q.y <= Math.max(y1, y2)) {

                let distance = Math.abs(q.x - x1);

                if (distance < minDistance) {
                    minDistance = distance;
                    point = { x: x1, y: q.y };
                    segment = i+1;
                    endPoint = false;
                }
            } else {

                let distanceToY1 = (q.x - x1) ** 2 + (q.y - y1) ** 2;
                let distanceToY2 = (q.x - x2) ** 2 + (q.y - y2) ** 2;

                let [distance, candidatePoint, candidateSegment] = distanceToY1 < distanceToY2
                    ? [distanceToY1, { x: x1, y: y1 }, i+1]
                    : [distanceToY2, { x: x1, y: y2 }, i+1];

                if (distance < minDistance) {
                    minDistance = distance;
                    point = candidatePoint;
                    segment = candidateSegment;
                    endPoint = true;
                }
            }
        } else if (y1 === y2) { // Horizontal segment
            if (Math.min(x1, x2) <= q.x && q.x <= Math.max(x1, x2)) {

                let distance = Math.abs(q.y - y1);

                if (distance < minDistance) {
                    minDistance = distance;
                    point = { x: q.x, y: y1 };
                    segment = i+1;
                    endPoint = false;
                }
            } else {

                let distanceToX1 = (q.x - x1) ** 2 + (q.y - y1) ** 2;
                let distanceToX2 = (q.x - x2) ** 2 + (q.y - y2) ** 2;

                let [distance, candidatePoint, candidateSegment] = distanceToX1 < distanceToX2
                    ? [distanceToX1, { x: x1, y: y1 }, i+1]
                    : [distanceToX2, { x: x2, y: y2 }, i+1];

                if (distance < minDistance) {
                    minDistance = distance;
                    point = candidatePoint;
                    segment = candidateSegment;
                    endPoint = true;
                }
            }
        }
    }

    return { point, segment, endPoint };
}

// interpollate close to p on the segment
export function interpolateSegment(point, segment, curve) {

    let newX = point.x
    let newY = point.y
    let fr = 0.1*(1+Math.random())

    // get the endpoints of the segment
    let a = curve[segment-1] 
    let b = curve[segment]

    // a should be the first
    if (b.x < a.x || b.y < a.y) [a,b] = [b,a]

    // vertical
    if (a.x == b.x) {
        // closer to a or b ?
        newY = (Math.abs(a.y - p.y) < Math(b.y - p.y)) ? a.y + fr*(b.y-a.y) : b.y - fr*(b.y - a.y)
    }
    // horizontal
    else {
        // closer to a or b ?
        newX = (Math.abs(a.x - p.x) < Math(b.x - p.x)) ? a.x + fr*(b.x-a.x) : b.x - fr*(b.x - a.x)
    }

    return {x:newX, y:newY}
}

export function jsonDeepCopy(toCopy) {

    return toCopy ? JSON.parse(JSON.stringify(toCopy)) : null;
}

// REVIEW THIS
export function updateDerivedSettings(original, derived) {

    // If the original is null, return the derived as is
    if (original === null) {
        return derived;
    }

    // If the derived is null, make a copy of the original
    if (derived === null) {
        return JSON.parse(JSON.stringify(original));
    }

    // keep arrays as is 
    // MAYBE CHECK IF THE ELEMENT OF THE ARRAY ?
    if (Array.isArray(original) && Array.isArray(derived)) return derived;

    // Iterate over the keys in the original settings
    for (let key in original) {
        if (original.hasOwnProperty(key)) {
            if ( (typeof original[key] === 'object') && !Array.isArray(original[key]) && (original[key] !== null)) {
                // Recursively update if both original and derived have this key as an object
                derived[key] = updateDerivedSettings(original[key], derived[key] || {});
            } else {
                // If the key exists in original, ensure it's in derived
                if (!derived.hasOwnProperty(key)) {
                    derived[key] = original[key];
                }
            }
        }
    }

    // Iterate over the keys in the derived settings
    for (let key in derived) {
        if (derived.hasOwnProperty(key)) {
            // If the key doesn't exist in original, delete it from derived
            if (!original.hasOwnProperty(key)) {
                delete derived[key];
            }
        }
    }

    return derived;
}
  
