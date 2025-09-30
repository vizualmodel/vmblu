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
    // get the position of the last period
    let n = path.lastIndexOf('.')

    // change the extension (the period is part of path)
    return n > 0 ? path.slice(0,n+1) + newExt : path + '.' + newExt
}

export function removeExt(path) {

    // get the position of the last period
    let n = path.lastIndexOf('.')

    return n > 0 ? path.slice(0,n) : path
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
    return /^(\/|https?:\/\/|file:\/\/\/|[a-zA-Z]:\\)/.test(path);
}


// // returns the path as in the workspace
// // TWO FUNCTIONS BELOW TO BE IMPROVED !!!
// export function wsPath( arlPath) {
//     // find the second slash (path starts with a slash)
//     let slash = arlPath.indexOf('/', 1)
//     return slash < 0 ? arlPath : arlPath.slice(slash)
// }

// export function arlPath( wsPath) {
//     return '/public' + wsPath
// }

// breaks an entry into its different parts

// make a path when a newPath is enterd - it can be absolute or relative to the old path
export function xxxassemble(oldPath,newPath) {

    // check
    if (!oldPath) return newPath

    // check
    if (! newPath?.length) return null

    // check against regular expression for a vizual model path
    let components = newPath.match(regex.vizPath)

    // check - return null if the path is invalid
    if (components == null) return null

    // if the newPath has a domain spec, then just return the newPath
    const start = components[1][0]
    if ((start != '.')&&(start != '/')) return newPath

    // the first component is / or ../ etc.
    const redirect = components[1]

    // find the last slash
    let slash = oldPath.lastIndexOf('/')

    // strip the old path of the filename but keep final slash
    let reuse = slash > 0 ? oldPath.slice(0, slash+1) : '/'

    // check if the newpath starts with / or .
    if (redirect.length) {

        // absolute path
        //if (redirect[0] == '/') reuse = '/'

        // path relative to the old path
        if (redirect[0] == '.') {

            // copy the current path
            reuse = oldPath.slice()

            // go up in the directory tree if required
            if (redirect.slice(0,3) == "../") {

                // count the number of slashes in relative 
                let up = (redirect.length-1)/3 - 1

                // avoid the final slash in the next search
                slash--

                // remove the nr of directories as required...
                while (up-- > 0) {
                    slash = reuse.lastIndexOf('/',slash)
                    if (slash > -1)
                        reuse = reuse.slice(0,slash)
                    else
                        break
                }
                // if there is part of the path to reuse, terminate it with a slash
                if (reuse.length > 0) reuse = reuse + '/' 
            }
        }
    }

    // get the other components of the new filename
    const dirs = components[2] ?? ''
    let fileName = components[3] 

    // check the extension 
    let period = fileName.lastIndexOf('.')

    // if no extension use the extension of the oldPath
    if (period < 0) {
        // get the extension of the current path - including the period
        period = oldPath.lastIndexOf('.')

        // add the extension - if any - to the filename
        fileName += period > 1 ? oldPath.slice(period) : ''
    }

    // debugging
    // components?.forEach( (c,i) => console.log('%d>%s',i,c))
    // console.log(`new path: ${reuse} + ${dirs} + ${fileName}`)

    // return the path 
    return reuse + dirs + fileName 
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

    // find it - but change to lowercase first
    const common = commonPart( path,ref )

    // find the last / going backward
    let slash = path.lastIndexOf('/',common)

    // if nothing in common
    if (slash < 1) return path

    // get rid of the common part
    let newPath = path.slice(slash+1)
    let newRef = ref.slice(slash+1)

    // we will make a prefix
    let prefix ='./'

    // if the ref is in a subdirectory we first have to come out of that sub
    slash = newRef.indexOf('/')
    if ( slash > 0) {

        // go up the directory chain
        prefix = '../'
        while ((slash = newRef.indexOf('/',slash+1)) > -1) {

            // add a new step up
            prefix += '../'

            // keep it reasonable - do not get stuck in the loop
            if (prefix.length > 100) break
        }
    }

//console.log('PATH ',path, ref, '==>', prefix, '+', newPath)

    return prefix + newPath
}

// if path starts with ./ or ../ or just name, make it into an absolute path based on the ref path.
// the ref path is always considered to be a file 
// The rules are as follows
//                      /a/b/c + /d = /d
//                      /a/b/c + ./d = /a/b/d
//                      /a/b/c + ../d = /a/d
//                      /a/b/c + d = /a/b/d
export function absolute(path, ref) {

    let slash = 0
    let folder = null

    // check
    if (!ref  || ref.length == 0)  return path
    if (!path || path.length == 0) return ref

    // check that path and ref are valid path names - use the regex ..(TO DO)

    // if the path is already absolute, just return path
    if (path.startsWith('/')) {
        return path
    }
    // the path is relative to the ref
    else if (path.startsWith('./')) {

        slash = ref.lastIndexOf('/')
        folder = slash < 0 ? '' : ref.slice(0, slash)

        return folder + '/' + path.slice(2)
    }
    // the path starts with ../../ etc
    else if (path.startsWith('../')) {

        slash = ref.lastIndexOf('/')
        folder = slash < 0 ? '' : ref.slice(0, slash)

        while (path.startsWith('../')) {

            // remove one folder from folder
            slash = folder.lastIndexOf('/')
            folder = slash < 0 ? '' : folder.slice(0, slash)

            // take of the leading ../
            path = path.slice(3)
        }

        return folder + '/' + path
    }
    // the path starts with a character == same as ./ case
    else {
        slash = ref.lastIndexOf('/')

        folder = slash < 0 ? '' : ref.slice(0, slash)

        return folder + '/' + path
    }
}