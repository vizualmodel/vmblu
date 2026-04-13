/* eslint-disable no-undef */
// import arl to change some of the functions
import {ARL, Path} from '../../core/types/arl/index.js';

export const vscode = acquireVsCodeApi();
let rqKey = 1;

// the callback map
export const promiseMap = new Map();

export function requestVsCode(verb, payload = {}) {
	const currentKey = rqKey++;
	const promise = new Promise(resolve => promiseMap.set(currentKey, resolve));
	vscode.postMessage({verb, rqKey: currentKey, ...payload});
	return promise;
}

// The function called to change some of the methods of ARL
export function adaptARL() {
	
	// change some of the ARL methods
	Object.assign(ARL.prototype, vscodeARLmethods);
}

// The list of methods that need to be changed...
const vscodeARLmethods = {

	absolute(url) {
		const asString = typeof url === 'string' ? url : String(url);
		let locator = asString;
		try {
			locator = Path.normalizeSeparators(decodeURIComponent(new URL(asString).pathname));
		}
		catch {}

		this._locator = locator;
		this.url = url;

		return this;
	},

	// resolves a userpath wrt this arl - returns a new arl
	resolve(userPath) {

		const normalizedPath = Path.normalizeSeparators(userPath);
		if (!normalizedPath?.length) return this.copy();

		// absolute native windows path
		if (/^[a-zA-Z]:\//.test(normalizedPath)) return this.nativeWindows(normalizedPath);

		// absolute uri or rooted path
		if (Path.getKind(normalizedPath) === Path.Kind.Absolute) {
			if (/^[a-zA-Z]+:\/\//.test(normalizedPath)) return new ARL(normalizedPath).absolute(normalizedPath);

			const arl = new ARL(normalizedPath);
			arl.url = this.makeFileUri(normalizedPath);
			return arl;
		}

		// relative path: resolve against the current uri
		if (!this.url) return null;

		const url = new URL(normalizedPath, this.url).toString();
		const arl = new ARL(Path.absolute(normalizedPath, this.getPath()));
		arl.url = url;

		return arl;
	},

	// absolute native windows format (mainly from the documentation)
	nativeWindows(windowsPath) {

		const normalizedPath = Path.normalizeSeparators(windowsPath);
		const arl = new ARL(normalizedPath);
		arl.url = this.makeFileUri(normalizedPath);
		return arl;
	},

	// two arl are equal if the url are equal
	equals(arl) {
		return !!(this.url && arl?.url && (this.url === arl.url));
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
		const arl = new ARL(this._locator);
		arl.url = this.url ? this.url.slice() : null;
		return arl;
	},

	// returns the full path of the vscode uri
	getFullPath() {
		if (this.url) {
			try {
				return Path.normalizeSeparators(decodeURIComponent(new URL(this.url).pathname));
			}
			catch {}
		}
		return this._locator;
	},

	getPath() {
		return this._locator;
	},

	makeFileUri(filePath) {
		const normalizedPath = Path.normalizeSeparators(filePath);
		const prefixed = normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath;
		return 'file://' + encodeURI(prefixed);
	},

	// for get we use the access to the filesystem that we have at the vscode-side - therefore we send a message
	async get( as = 'text') {
		return requestVsCode('HTTP-GET', {arl:this, format: as});
	},

	async jsImport() {
	},


	async save(body) {
		// encode the string as a Utf8Array
		const encoder = new TextEncoder();
		const bodyAsBytes = encoder.encode(body);

		return requestVsCode('HTTP-POST', {arl:this, bytes: bodyAsBytes});
	}
};
