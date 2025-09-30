import * as vscode from 'vscode';
import { getNonce } from './util.js';

export function makeHtmlPage(csp:string, app:vscode.Uri, css:vscode.Uri, icons:vscode.Uri): string {

	// Use a nonce to whitelist which scripts can be run (see content security policy)
	const nonce = getNonce();
	
	return `
	<!doctype html>
	<html>
	<head>
		<meta charset='utf-8'>
		<meta http-equiv="Content-Security-Policy" content="default-src ${csp};connect-src ${csp} filesystem; img-src ${csp} filesystem; style-src ${csp} https: 'unsafe-inline'; script-src 'nonce-${nonce}';">
		<meta name='viewport' content='width=device-width'>
		<title>Vmblu</title>
		<link rel="stylesheet" type="text/css" href= ${css}/>
		<link rel="stylesheet" type="text/css" href= ${icons}/>
		<script nonce="${nonce}" type='module' src=${app}></script>
	</head>
	<body style="overflow:hidden;">
	</body>
	</html>`;
	
	}
