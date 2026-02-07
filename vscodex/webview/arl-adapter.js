/* eslint-disable no-undef */
// import arl to change some of the functions
import {ARL, Path} from '../../core/arl/index.js';

// *************************************************************************************
// In the case of vscode extension, the url is the string path for the arl !! 
// It is **not** a uri structure 
// the string is converted from and to uri by using vscode.parse(uri) / uri.toString()
// *************************************************************************************

export const vscode = acquireVsCodeApi();
let rqKey = 1;

// the callback map
export const promiseMap = new Map();

// The function called to change some of the methods of ARL
export function adaptARL() {
	
	// change some of the ARL methods
	Object.assign(ARL.prototype, vscodeARLmethods);
}

// The list of methods that need to be changed...
const vscodeARLmethods = {

	// set the user path as ./last
	absolute(url) {

		// find the last slash
		const slash = url.lastIndexOf('/');

		// make the userpath
		this.userPath = slash >= 0 ? '.' + url.slice(slash) : url;

		// set the url
		this.url = url;

		// return the arl
		return this;
	},

	// resolves a userpath wrt this arl - returns a new arl
	resolve(userPath) {

		// if the filepath has backslashes it is a native windows format that has to be adapted
		if (userPath.indexOf('\\') > -1) return this.nativeWindows(userPath);

		// make a new arl
		const arl = new ARL(userPath);

		// make the url from this url and the user path
		arl.url = Path.absolute(userPath, this.url);


		// done
		return arl;
	},

	// absolute native windows format (mainly from the documentation)
	nativeWindows(windowsPath) {

		// change backslashes to forward slashes
		windowsPath = Path.normalizeSeparators(windowsPath);

		// change the ':' to '%3A'
		if (windowsPath.indexOf(':') > -1) windowsPath = windowsPath.replace(/:/g,'%3A');

		// find the last slash
		const slash = windowsPath.lastIndexOf('/');

		// make the userpath
		const userPath = slash >= 0 ? '.' + windowsPath.slice(slash) : url;

		// create a url
		const arl = new ARL(userPath);

		// and set the url
		arl.url = 'file:///' + windowsPath;

		return arl;
	},

	// two arl are equal if the url are equal
	equals(arl) {
		return this.url && arl.url ? (this.url == arl.url) : false;
	},

	// returns true if both files are in the same directory
	sameDir(arl) {

		if (!this.url || !arl.url) return false;

		const slash1 = this.url.lastIndexOf('/');
		const slash2 = arl.url.lastIndexOf('/');

		return this.url.slice(0,slash1) === arl.url.slice(0, slash2);
	},

	// returns a copy of this arl
	copy() {
		const arl = new ARL(this.userPath);
		arl.url = this.url.slice();
		return arl;
	},

	// returns the full path of the vscode uri
	getFullPath() {
		return this.url;
	},

	// for get we use the access to the filesystem that we have at the vscode-side - therefore we send a message
	async get( as = 'text') {

		// create a promise - save the resolve id in the resolve map
		const promise = new Promise( resolve => promiseMap.set(rqKey, resolve));

		// send a message to the message handler for the document
		vscode.postMessage({verb:'HTTP-GET', arl:this, format: as, rqKey});

		// increment the key value only now !
		rqKey++;

		// return the promise for this request
		return promise;
	},

	async jsImport() {
	},


	async save(body) {

		// create a promise - save the resolve id in the resolve map
		const promise = new Promise( resolve => promiseMap.set(rqKey, resolve));

		// encode the string as a Utf8Array
		const encoder = new TextEncoder();
		const bodyAsBytes = encoder.encode(body);

		// send a message to the message handler for the document
		vscode.postMessage({verb:'HTTP-POST', arl:this, bytes: bodyAsBytes, rqKey});

		// increment the key value only now !
		rqKey++;

		// return the promise for this request
		return promise;
	}
};

