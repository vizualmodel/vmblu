// Server error
export function ServerError(message, status, cause) {
    this.message = 'HTTP code: ' + status + ': ' + message
    this.cause = cause
}

// time-out before operation gets aborted
const msAbort=8000

// The Promise returned from fetch() won't reject on HTTP error status even if the response is an HTTP 404 or 500. 
// Instead, as soon as the server responds with headers, the Promise will resolve normally 
// (with the ok property of the response set to false if the response isn't in the range 200–299), 
// and it will only reject on network failure or if anything prevented the request from completing
export async function get(resource,options={}) {

    // get an abort controller - not reusable !
    const controller = new AbortController()

    // add the signal to the options
    options.signal = controller.signal

    // launch a timeout with the abort controller - when controller.abort is called - it generates a DOMException AbortError
    const id = setTimeout(() => controller.abort(), msAbort);

    // launch and wait for fetch
    return fetch(resource, options)
    .then( response => {
            // stop the timer
            clearTimeout(id)

            // check (200 - 299 range)
            if (response.ok) return response

            // throw the error
            throw new ServerError("GET failed", response.status, "")
    })
    .catch( error =>  {

        // stop the timer
        clearTimeout(id)

        // there was a network error - rethrow
        throw error
    })
}

// save with timeout
export async function post(resource,body,mime='text/plain') {

    // get an abort controller - not reusable !
    const controller = new AbortController()

    // launch a timeout with the abort controller
    const id = setTimeout(() => controller.abort(), msAbort);

    let options = {
        method: 'POST',                     // *GET, POST, PUT, DELETE, etc.
        mode: 'cors',                       // no-cors, *cors, same-origin
        cache: 'no-cache',                  // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin',         // include, *same-origin, omit
        headers: {
          'Content-Type': mime
        },
        redirect: 'follow',                 // manual, *follow, error
        referrerPolicy: 'no-referrer',      // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body,                               // body data type must match "Content-Type" header

        signal: controller.signal
    }
    // launch and wait for fetch
    const response = await fetch(resource, options)
    .catch(error => {
        // log
        console.log("Network failure", error)

        // rethrow
        throw error       
    })
    // stop the timer 
    clearTimeout(id);

    // check what we got in return
    if (response.ok) return response

    // throw the error
    let srvError = await response.json()
    throw new ServerError("POST failed", response.status, srvError)
}

// delete with timeout
export async function del(resource,body, mime='text/plain') {

    // get an abort controller - not reusable !
    const controller = new AbortController()

    // launch a timeout with the abort controller
    const id = setTimeout(() => controller.abort(), msAbort);

    let options = {
        method: 'DELETE',                     // *GET, POST, PUT, DELETE, etc.
        mode: 'cors',                       // no-cors, *cors, same-origin
        cache: 'no-cache',                  // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin',         // include, *same-origin, omit
        headers: {
          'Content-Type': mime
        },
        redirect: 'follow',                 // manual, *follow, error
        referrerPolicy: 'no-referrer',      // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body,                               // body data type must match "Content-Type" header

        signal: controller.signal
      }

    // launch and wait for fetch
    const response = await fetch(resource, options)
    .catch(error => {
        // log
        console.log("Network failure", error)

        // rethrow
        throw error       
    })

    // stop the timer 
    clearTimeout(id);

    // check the result 
    if (!response.ok) {

        let srvError = await response.json()
        throw new ServerError("Delete failed", response.status, srvError)
    }

    // return the result
    return response
}

export function getMime(response) {

    // get the mime part before the first semi-colon
    let mime = response.headers.get('Content-Type')
    const semiColon = mime.indexOf(';')
    if (semiColon > 0) mime = mime.slice(0, semiColon)
}