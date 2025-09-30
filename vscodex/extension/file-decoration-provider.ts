import * as vscode from 'vscode';

export class VmbluFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {

    provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {

        if (uri.scheme === 'untitled') return undefined;

        const lowerPath = uri.path.toLowerCase();
        if (!lowerPath.endsWith('.vmblu'))return undefined;

        const decoration = new vscode.FileDecoration('▞', 'vmblu model file', new vscode.ThemeColor('vmblu.dataBadge'));
        return decoration;
    }

    dispose(): void {
        // nothing to dispose; present to satisfy the interface for subscriptions
    }

}

