import * as vscode from 'vscode';

class GoReferenceCodeLens extends vscode.CodeLens {
    constructor(range: vscode.Range, public uri: vscode.Uri, public identifierPosition: vscode.Position) {
        super(range);
    }
}

export class ReferenceCodeLensProvider implements vscode.CodeLensProvider {
    private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        if (token.isCancellationRequested) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        
        let symbols: vscode.DocumentSymbol[] | undefined;
        try {
            symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );
        } catch (error) {
            console.error('Error fetching document symbols:', error);
            return lenses;
        }

        if (!symbols) {
            return lenses;
        }

        const traverseSymbols = (syms: vscode.DocumentSymbol[]) => {
            for (const symbol of syms) {
                if (token.isCancellationRequested) {
                    return;
                }
                if (
                    symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method ||
                    symbol.kind === vscode.SymbolKind.Struct ||
                    symbol.kind === vscode.SymbolKind.Interface ||
                    symbol.kind === vscode.SymbolKind.Class
                ) {
                    lenses.push(new GoReferenceCodeLens(symbol.range, document.uri, symbol.selectionRange.start));
                }
                if (symbol.children && symbol.children.length > 0) {
                    traverseSymbols(symbol.children);
                }
            }
        };

        traverseSymbols(symbols);

        return lenses;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens> {
        if (token.isCancellationRequested) {
            return codeLens;
        }

        if (!(codeLens instanceof GoReferenceCodeLens)) {
            return codeLens;
        }

        const position = codeLens.identifierPosition;
        let locations: vscode.Location[] | undefined;
        
        try {
            locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                codeLens.uri,
                position
            );
        } catch (error) {
            console.error('Error fetching references:', error);
            return codeLens;
        }

        if (token.isCancellationRequested) {
            return codeLens;
        }

        let refCount = 0;
        if (locations) {
            // Вычитаем 1, так как часто executeReferenceProvider возвращает и само определение
            refCount = Math.max(0, locations.length - 1); 
        }

        codeLens.command = {
            title: `${refCount} reference${refCount === 1 ? '' : 's'}`,
            command: 'editor.action.showReferences',
            arguments: [codeLens.uri, position, locations || []]
        };

        return codeLens;
    }
}
