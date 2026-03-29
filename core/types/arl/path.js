// regular expression for a file name and path
// The file extension is handled separately when required
export const regex = {
    filename: /^[\w\s-]*(\.[\w]+)?$/,
    /*
        [\w\s-]*                starts with a name - whitespace and hyphen allowed
        (\.[\w]+)?              optional extension starts with . followed by one or more characters 
    */
    linuxPath: /^(\/[^/ ]*)+\/?$/,
    /*
        (\/[^/ ]*)+             starts with / followed by string not containing / or space - (at least one)
        \/?                     can have a / at the end 
    */
    vizPath:  /^((?:\.\/)?|(?:\.\.\/)*|\/|(?:[\w\s-]+\:\/?))((?:[\w\s-]+\/)*)([\w\s-\.]+)$/,
    /*
        ((?:\.\/)?|(?:\.\.\/)*|\/|(?:[\w\s-]+\:\/?))    can start with ./ or a sequence of ../  or  / or domain: or domain:/
        ((?:[\w\s-]+\/)*)                               followed by 0 or more directory_name/
        ([\w\s-\.]+)                                    followed by filename - can have an extension

                                                        *Note that (:?) prevents capturing the group

        the array returned contains
        0 the string
        1 the first part: / or ./ or ../../../ or domain: or domain:/
        2 the list of directory names: a/b/c/d/e/
        3 the filename: mysource - can have an extension
    */
    projectPath:  /^((?:\.\/)?|(?:\.\.\/)*|\/)((?:[\w\s-]+\/)*)([\w\s-\.]+)$/,
    /*
        ((?:\.\/)?|(?:\.\.\/)*|\/|(?:[\w\s-]+\:\/?))    can start with ./ or a sequence of ../  or  / or domain: or domain:/
        ((?:[\w\s-]+\/)*)                               followed by 0 or more directory_name/
        ([\w\s-\.]+)                                    followed by filename - can have an extension

                                                        *Note that (:?) prevents capturing the group

        the array returned contains
        0 the string
        1 the first part: / or ./ or ../../../ 
        2 the list of directory names: a/b/c/d/e/
        3 the filename: mysource - can have an extension
    */
    url: /^(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/
    /* 
    TO BE CHECKED !
    */
}

const MAX_EXT_LENGTH = 6

// The path type that 
export const Kind = {
    Unknown: 0,
    Absolute: 1,
    Relative: 2,
    Empty: 3,
}

export function getKind(path) {
    if (path == null || path.length == 0) return Kind.Empty
    return isAbsolutePath(path) ? Kind.Absolute : Kind.Relative
}

export function normalizeSeparators(value) {
    return (typeof value === 'string') ? value.replace(/\\/g, '/') : value
}

export function getDomain(str) {

    // find the first colon and the first slash
    const colon = str.indexOf(':')
    const slash = str.indexOf('/')

    // format = domain:path - so find a colon that is not part of the path /...:... is not valid !
    if ((colon < 0) || (slash < colon)) return null

    return str.slice(0, colon)
}

export function hasExt(path) {

    // get the position of the last period
    let n = path.lastIndexOf('.')

    // check
    return (n>0 && ((path.length - n) <= MAX_EXT_LENGTH))
}

// extension period not included
export function getExt(path) {
    // get the position of the last period
    let n = path.lastIndexOf('.')

    // get the extension of the file - if any
    return n < 0 ? '' : path.slice(n+1)
}

export function changeExt(path, newExt) {

    let n = path.lastIndexOf('.')
    const ext = newExt[0] == '.' ? newExt : '.' + newExt
    return n > 0 ? path.slice(0,n) + newExt : path + '.' + newExt
}

// splits 'file.ext' in 'file' and '.ext' and 'file.ext1.ext2' if 'file' and '.ext1.ext2'
export function getSplit(path)  {

    // we only need the fileName
    let slash = path.lastIndexOf('/')
    const fileName = slash > 0 ? path.slice(slash+1) : path

    let p1 = fileName.lastIndexOf('.')
    let p2 = fileName.lastIndexOf('.', p1-1)
    
    return {
        name: p2 > 0 ? fileName.slice(0,p2) : (p1 > 0 ? fileName.slice(0,p1) : fileName),
        ext: p2 > 0 ? fileName.slice(p2) : (p1 > 0 ? fileName.slice(p1) : null)
    }
}

// splits 'name.ext' in 'name' and '.ext' and 'name.kind.ext' if 'file' '.kind' and '.ext'
export function split(path)  {

    // we only need the fileName
    let slash = path.lastIndexOf('/')
    const fileName = slash > 0 ? path.slice(slash+1) : path

    let p1 = fileName.lastIndexOf('.')
    let p2 = fileName.lastIndexOf('.', p1-1)
    
    return {
        name:   p2 > 0 ? fileName.slice(0,p2) : (p1 > 0 ? fileName.slice(0,p1) : fileName),
        kind:   p2 > 0 ? fileName.slice(p2,p1) : null,
        ext:    p1 > 0 ? fileName.slice(p1) : null
    }
}

export function removeExt(path) {

    const split = getSplit(path)

    if (!split.ext) return path

    return path.slice(0, path.length - split.ext.length)
}

export function checkPath(path) {

    return regex.vizPath.test(path) ? path : null
}

export function fileName(path) {

    const slash = path.lastIndexOf('/')
    return slash < 0 ? path : path.slice(slash+1)
}

export function nameOnly(path) {
    // get the last slash or 0
    let slash = path.lastIndexOf('/')

    // find the extension if any
    let period = path.lastIndexOf('.')

    // return the relevant part of the path
    return (period > slash) ? path.slice(slash+1, period) : path.slice(slash+1)
}

// Examples
// console.log(isAbsolutePath('/users/docs'));  // Returns true
// console.log(isAbsolutePath('users/newfile.txt'));  // Returns false
// console.log(isAbsolutePath('https://example.com'));  // Returns true
// console.log(isAbsolutePath('C:\\Users\\docs'));  // Returns true
// console.log(isAbsolutePath('file:///C:/Users/docs'));  // Returns true

export function isAbsolutePath(path) {
    // Checks if the path starts with '/', 'http://', 'https://', 'file://', or a Windows drive letter
    return /^(\/|https?:\/\/|file:\/\/\/|[a-zA-Z]:[\\/]|[\w\s-]+:\/)/.test(path);
}



// returns the last i where the strings are the same
function commonPart(a,b) { 
    const max = a.length < b.length ? a.length : b.length
    for (let i=0;i<max;i++) { if (a[i] != b[i]) return i } 
}

// make a path relative to the reference
// relativePath  /A/B/C/filea , /A/B/fileb => ./C/filea
// relativePath  /A/B/C/filea , /A/B/G/fileb => ../C/filea
// relativePath  /A/B/C/filea , /A/B/G/F/fileb => ../../C/filea
export function relative(path, ref) {

    path = normalizeSeparators(path)
    ref = normalizeSeparators(ref)

    // empty values are returned unchanged
    if (!path?.length || !ref?.length) return path

    // do not try to relativize across different schemes / domains
    const pathDomain = getDomain(path)
    const refDomain = getDomain(ref)
    if (pathDomain || refDomain) {
        if (pathDomain !== refDomain) return path
    }

    const pathRooted = path.startsWith('/')
    const refRooted = ref.startsWith('/')
    if (pathRooted !== refRooted) return path

    // split into path components; ref is always treated as a file
    const pathParts = path.split('/').filter(Boolean)
    const refParts = ref.split('/').filter(Boolean)
    const refDirParts = refParts.slice(0, -1)

    let same = 0
    const max = Math.min(pathParts.length, refDirParts.length)
    while (same < max && pathParts[same] === refDirParts[same]) same++

    const upCount = refDirParts.length - same
    const downParts = pathParts.slice(same)

    if (upCount === 0) return './' + downParts.join('/')

    return '../'.repeat(upCount) + downParts.join('/')
}

// if path starts with ./ or ../ or just name, make it into an absolute path based on the ref path.
// the ref path is always considered to be a file 
// The rules are as follows
//                      /a/b/c + /d = /d
//                      /a/b/c + ./d = /a/b/d
//                      /a/b/c + ../d = /a/d
//                      /a/b/c + d = /a/b/d
export function absolute(path, ref) {

    path = normalizeSeparators(path)
    ref = normalizeSeparators(ref)

    // keep the original values intact while resolving
    const target = path ?? ''
    const reference = ref ?? ''

    if (!reference.length) return target
    if (!target.length)    return reference

    // already absolute
    if (isAbsolutePath(target) || getDomain(target)) return target

    // derive the base directory from the reference (ref is a file)
    const lastSlash = reference.lastIndexOf('/')
    const baseDir = lastSlash < 0 ? '' : reference.slice(0, lastSlash)
    const rooted = reference.startsWith('/')
    const stack = baseDir ? baseDir.split('/').filter(Boolean) : []
    let extraUp = 0

    // split and normalize the target path components
    const parts = target.split('/')
    for (const part of parts) {

        // ignore empty segments and current directory markers
        if (!part || part === '.') continue

        if (part === '..') {
            if (stack.length) {
                stack.pop()
            } else if (!rooted) {
                extraUp++
            }
            // if rooted and nothing to pop, stay at root
        } else {
            stack.push(part)
        }
    }

    // rebuild the path
    let resolved = rooted ? '/' : ''
    if (!rooted && extraUp) resolved += '../'.repeat(extraUp)

    resolved += stack.join('/')

    // avoid returning an empty string; rooted means '/'
    return resolved || (rooted ? '/' : '.')
}

// domain path resource are the shorthands as they appear in the workspace file 
export function stringCheck(userPath) {
    if (typeof userPath === 'string') return userPath;
    if (userPath && typeof userPath === 'object') {
        if (typeof userPath.fsPath === 'string') return userPath.fsPath;
        if (typeof userPath.path === 'string') return userPath.path;
        if (typeof userPath.url === 'string') return userPath.url;
    }
    return null;
}
