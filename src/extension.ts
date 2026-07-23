import * as vscode from 'vscode';
import { ReferenceCodeLensProvider } from './ReferenceCodeLensProvider';
import { ReferenceTreeViewProvider } from './ReferenceTreeView';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ReferenceCodeLensProvider();
    
    let disposable = vscode.languages.registerCodeLensProvider(
        { language: 'go', scheme: 'file' },
        provider
    );
    context.subscriptions.push(disposable);

    const treeProvider = new ReferenceTreeViewProvider();
    vscode.window.registerTreeDataProvider('newgovision.refsView', treeProvider);

    const cmdDisposable = vscode.commands.registerCommand('newgovision.showLocations', async (locations: vscode.Location[]) => {
        if (!locations || locations.length === 0) {
            return;
        }

        if (locations.length === 1) {
            // Jump directly
            const loc = locations[0];
            const doc = await vscode.workspace.openTextDocument(loc.uri);
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new vscode.Selection(loc.range.start, loc.range.end);
            editor.revealRange(loc.range, vscode.TextEditorRevealType.InCenter);
        } else {
            // Show in custom tree view panel
            treeProvider.refresh(locations);
            vscode.commands.executeCommand('newgovision.refsView.focus');
        }
    });
    context.subscriptions.push(cmdDisposable);
}

export function deactivate() {}
