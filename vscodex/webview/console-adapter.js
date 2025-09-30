/* eslint-disable no-undef */
import {vscode} from './arl-adapter.js';

// This function catches the console.log output in the webview part
// save the original console function
const consoleLog = console.log;

// and adapt it now
export function adaptConsole() {

	// Overriding console.log to capture logs and send them to the extension
	console.log = function(...args) {

		// keeps the default behavior
		consoleLog.apply(console, args);

        // sanitize data is a recursive function - max depth avoids endless loops
        const maxDepth = 2;
        const visited = new WeakSet(); // Use a single WeakSet for all arguments

		// Sanitize each argument
		const sanitizedArgs = args.map(arg => sanitizeData(arg, maxDepth, visited));

		// Convert each argument to a string in a readable form
		const stringifiedArgs = sanitizedArgs.map(arg => {
			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg, null, 2); // Pretty print objects
				} catch (e) {
					return '[Unable to stringify]';
				}
			}
			return arg; // Non-objects are returned as is
		});
		
		// send the resulting string
		vscode.postMessage({ verb: 'console log', string: stringifiedArgs.join(' ')}); 
	};
}

// sanitize the data
function sanitizeData(data, depth, visited) {

    if (depth == 0) return '[Max depth]';

    if (data === null || data === undefined) return data; // Null or undefined can be cloned

    // Check if data is an object or an array, and prepare to iterate
    if (typeof data === 'object' || Array.isArray(data)) {

        // Detect circular references
        if (visited.has(data)) {
            return '[Circular]';
        }
        visited.add(data);

        // Initialize as array or object
        const newData = Array.isArray(data) ? [] : {}; 

        // Go through the data
        for (const key in data) {

            // Ensure the property belongs to the object and not its prototype
            if (Object.prototype.hasOwnProperty.call(data, key)) {

                if (typeof data[key] === 'function') {

                    // Functions can't be cloned => replacing with a descriptive string
                    newData[key] = `Function: ${data[key].name}`;

                } else {

                    // Recursively sanitize nested objects or arrays
                    newData[key] = sanitizeData(data[key], depth - 1, visited);
                }
            }
        }
        visited.delete(data); // Remove from visited to handle other branches correctly
        return newData;
    }

    // Directly return non-object, non-array types
    return data;
}
