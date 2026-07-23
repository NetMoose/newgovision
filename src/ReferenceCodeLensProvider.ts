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

        // Фильтруем чистые имплементации (исключаем саму декларацию)
        const pureImpls = implLocations.filter(impl => {
            const isSelf = impl.uri.toString() === codeLens.uri.toString() && !!impl.range.intersection(codeLens.range);
            return !isSelf;
        });

        // Фильтруем чистые references
        const pureRefs = refLocations.filter(ref => {
            // Исключаем саму декларацию
            const isSelf = ref.uri.toString() === codeLens.uri.toString() && !!ref.range.intersection(codeLens.range);
            if (isSelf) return false;

            // Исключаем всё, что gopls вернул как implementation
            const isImpl = pureImpls.some(impl => 
                impl.uri.toString() === ref.uri.toString() && !!impl.range.intersection(ref.range)
            );
            if (isImpl) return false;

            return true;
        });

        let refCount = pureRefs.length;
        let implCount = pureImpls.length;
        
        const titles: string[] = [];

        if (codeLens.kind === vscode.SymbolKind.Interface || (codeLens.kind === vscode.SymbolKind.Method && codeLens.parentKind === vscode.SymbolKind.Interface)) {
            titles.push(`${implCount} impls`);
            if (refCount > 0) titles.push(`${refCount} ref${refCount > 1 ? 's' : ''}`);
        } else if (codeLens.kind === vscode.SymbolKind.Struct || codeLens.kind === vscode.SymbolKind.Class || codeLens.kind === vscode.SymbolKind.Method) {
            if (refCount > 0 || implCount === 0) titles.push(`${refCount} ref${refCount > 1 ? 's' : ''}`);
            
            if (implCount > 0) {
                if (codeLens.kind === vscode.SymbolKind.Method) {
                    titles.push(`impls ${implCount} intfc method`);
                } else {
                    titles.push(`implements ${implCount} intf`);
                }
            }
        } else {
            titles.push(`${refCount} ref${refCount > 1 ? 's' : ''}`);
        }

        if (titles.length === 0) titles.push(`0 refs`);

        const allLocations = [...pureRefs, ...pureImpls];

        codeLens.command = {
            title: titles.join(' | '),
            command: 'editor.action.showReferences',
            arguments: [codeLens.uri, position, allLocations]
        };

        return codeLens;
    }
}
