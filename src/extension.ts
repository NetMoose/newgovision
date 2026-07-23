import * as vscode from 'vscode';
import * as path from 'path';
import { ReferenceCodeLensProvider } from './ReferenceCodeLensProvider';
import { ReferenceTreeViewProvider, SymbolInfo } from './ReferenceTreeView';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ReferenceCodeLensProvider();
    
    let disposable = vscode.languages.registerCodeLensProvider(
        { language: 'go', scheme: 'file' },
        provider
    );
    context.subscriptions.push(disposable);

    const treeProvider = new ReferenceTreeViewProvider();
    vscode.window.registerTreeDataProvider('newgovision.refsView', treeProvider);

    const showLocsDisposable = vscode.commands.registerCommand('newgovision.showLocations', async (locations: vscode.Location[], title: string, symbolInfo: SymbolInfo) => {
        if (!locations || locations.length === 0) {
            return;
        }

        if (locations.length === 1) {
            const loc = locations[0];
            const doc = await vscode.workspace.openTextDocument(loc.uri);
            const editor = await vscode.window.showTextDocument(doc);
            editor.selection = new vscode.Selection(loc.range.start, loc.range.end);
            editor.revealRange(loc.range, vscode.TextEditorRevealType.InCenter);
        } else {
            treeProvider.refresh(locations, title, symbolInfo);
            vscode.commands.executeCommand('newgovision.refsView.focus');
        }
    });
    context.subscriptions.push(showLocsDisposable);

    const runMainDisposable = vscode.commands.registerCommand('newgovision.runMain', async (uri: vscode.Uri, isDebug: boolean) => {
        const dir = path.dirname(uri.fsPath);
        
        const config: vscode.DebugConfiguration = {
            type: 'go',
            name: isDebug ? 'Debug Main' : 'Run Main',
            request: 'launch',
            mode: 'auto',
            program: dir,
            noDebug: !isDebug
        };
        
        vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(uri), config);
    });
    context.subscriptions.push(runMainDisposable);
}

export function deactivate() {}
