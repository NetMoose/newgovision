import * as vscode from 'vscode';

class GoReferenceCodeLens extends vscode.CodeLens {
    constructor(
        range: vscode.Range, 
        public uri: vscode.Uri, 
        public identifierPosition: vscode.Position,
        public kind: vscode.SymbolKind,
        public parentKind?: vscode.SymbolKind
    ) {
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

        const traverseSymbols = (syms: vscode.DocumentSymbol[], parentKind?: vscode.SymbolKind) => {
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
                    const isSystemFunc = symbol.kind === vscode.SymbolKind.Function && (symbol.name === "main" || symbol.name === "init");
                    if (!isSystemFunc) {
                        lenses.push(new GoReferenceCodeLens(
                            symbol.range, 
                            document.uri, 
                            symbol.selectionRange.start,
                            symbol.kind,
                            parentKind
                        ));
                    }
                }
                if (symbol.children && symbol.children.length > 0) {
                    traverseSymbols(symbol.children, symbol.kind);
                }
            }
        };

        traverseSymbols(symbols);

        return lenses;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens> {
        if (token.isCancellationRequested) return codeLens;
        if (!(codeLens instanceof GoReferenceCodeLens)) return codeLens;

        const position = codeLens.identifierPosition;
        let refLocations: vscode.Location[] = [];
        let implLocations: vscode.Location[] = [];
        
        try {
            const [refs, impls] = await Promise.all([
                vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeReferenceProvider',
                    codeLens.uri,
                    position
                ).then(r => r || []),
                vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeImplementationProvider',
                    codeLens.uri,
                    position
                ).then(r => r || [])
            ]);

            refLocations = refs;
            implLocations = impls;
        } catch (error) {
            console.error('Error fetching lens data:', error);
            return codeLens;
        }

        if (token.isCancellationRequested) return codeLens;

        let refCount = Math.max(0, refLocations.length - 1);
        let implCount = implLocations.length;
        
        const titles: string[] = [];

        if (codeLens.kind === vscode.SymbolKind.Interface || (codeLens.kind === vscode.SymbolKind.Method && codeLens.parentKind === vscode.SymbolKind.Interface)) {
            titles.push(`${implCount} impls`);
            if (refCount > 0) titles.push(`${refCount} refs`);
        } else if (codeLens.kind === vscode.SymbolKind.Struct || codeLens.kind === vscode.SymbolKind.Class || codeLens.kind === vscode.SymbolKind.Method) {
            if (refCount > 0 || implCount === 0) titles.push(`${refCount} refs`);
            if (implCount > 0) titles.push(`implements ${implCount} intf`);
        } else {
            titles.push(`${refCount} refs`);
        }

        if (titles.length === 0) titles.push(`0 refs`);

        const allLocations = [...refLocations, ...implLocations];

        codeLens.command = {
            title: titles.join(' | '),
            command: 'editor.action.showReferences',
            arguments: [codeLens.uri, position, allLocations]
        };

        return codeLens;
    }
}
