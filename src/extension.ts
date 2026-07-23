import * as vscode from 'vscode';
import { ReferenceCodeLensProvider } from './ReferenceCodeLensProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ReferenceCodeLensProvider();
    
    const disposable = vscode.languages.registerCodeLensProvider(
        { language: 'go', scheme: 'file' },
        provider
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}
