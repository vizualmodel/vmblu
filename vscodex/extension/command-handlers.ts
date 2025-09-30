import * as vscode from 'vscode';

// The handler for the globe icon...
export function globeHandler() {

    //const uri = vscode.Uri.joinPath(,file)
    if (!vscode.workspace.workspaceFolders) {
        console.log('No folders...');
        return;
    }

    // make the uri for the document
    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, "vscodex/src/document-model.ts");

    // open and show the document
    vscode.workspace.openTextDocument(uri)
    .then( newDocument => {
        vscode.window.showTextDocument(newDocument);
        console.log('file was opened', newDocument);
    });
}