import * as vscode from 'vscode';

export type LensType = 'refs' | 'impls' | 'methods';

export class GoReferenceCodeLens extends vscode.CodeLens {
    constructor(
        range: vscode.Range, 
        public uri: vscode.Uri, 
        public identifierPosition: vscode.Position,
        public kind: vscode.SymbolKind,
        public lensType: LensType,
        public parentKind?: vscode.SymbolKind,
        public methodLocations?: vscode.Location[]
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

        const allSymbols: {sym: vscode.DocumentSymbol, parentKind?: vscode.SymbolKind}[] = [];
        const flatten = (syms: vscode.DocumentSymbol[], parent?: vscode.SymbolKind) => {
            for (const s of syms) {
                allSymbols.push({sym: s, parentKind: parent});
                if (s.children) flatten(s.children, s.kind);
            }
        };
        flatten(symbols);

        const structMethods = new Map<string, vscode.Location[]>();
        for (const item of allSymbols) {
            if (item.sym.kind === vscode.SymbolKind.Method || item.sym.kind === vscode.SymbolKind.Function) {
                const firstLine = document.lineAt(item.sym.range.start.line).text;
                const match = firstLine.match(/func\s+\(\s*\w+\s+\*?\s*(\w+)\s*\)/);
                if (match) {
                    const structName = match[1];
                    if (!structMethods.has(structName)) structMethods.set(structName, []);
                    structMethods.get(structName)!.push(new vscode.Location(document.uri, item.sym.selectionRange));
                }
            }
        }

        for (const item of allSymbols) {
            if (token.isCancellationRequested) return [];
            
            const sym = item.sym;
            const isSystemFunc = sym.kind === vscode.SymbolKind.Function && (sym.name === "main" || sym.name === "init");
            if (isSystemFunc) continue;

            const addLens = (type: LensType, locs?: vscode.Location[]) => {
                lenses.push(new GoReferenceCodeLens(
                    sym.range, document.uri, sym.selectionRange.start, sym.kind, type, item.parentKind, locs
                ));
            };

            if (sym.kind === vscode.SymbolKind.Interface) {
                addLens('refs');
                addLens('impls');
                const interfaceMethods = sym.children ? sym.children
                    .filter(c => c.kind === vscode.SymbolKind.Method || c.kind === vscode.SymbolKind.Function)
                    .map(c => new vscode.Location(document.uri, c.selectionRange)) : [];
                addLens('methods', interfaceMethods);
            } else if (sym.kind === vscode.SymbolKind.Struct || sym.kind === vscode.SymbolKind.Class) {
                addLens('refs');
                addLens('impls'); 
                const mLocs = structMethods.get(sym.name) || [];
                addLens('methods', mLocs);
            } else if (sym.kind === vscode.SymbolKind.Method) {
                addLens('refs');
                addLens('impls'); 
            } else if (sym.kind === vscode.SymbolKind.Function) {
                addLens('refs');
            }
        }

        return lenses;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens> {
        if (token.isCancellationRequested) return codeLens;
        if (!(codeLens instanceof GoReferenceCodeLens)) return codeLens;

        const position = codeLens.identifierPosition;
        
        if (codeLens.lensType === 'methods') {
            const locs = codeLens.methodLocations || [];
            const count = locs.length;
            codeLens.command = {
                title: `${count} method${count !== 1 ? 's' : ''}`,
                command: 'newgovision.showLocations',
                arguments: [locs]
            };
            return codeLens;
        }

        let refLocations: vscode.Location[] = [];
        let implLocations: vscode.Location[] = [];
        
        try {
            if (codeLens.lensType === 'refs') {
                refLocations = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeReferenceProvider',
                    codeLens.uri,
                    position
                ) || [];
            } else if (codeLens.lensType === 'impls') {
                implLocations = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeImplementationProvider',
                    codeLens.uri,
                    position
                ) || [];
            }
        } catch (error) {
            return codeLens;
        }

        if (token.isCancellationRequested) return codeLens;

        if (codeLens.lensType === 'refs') {
            const pureRefs = refLocations.filter(ref => {
                const isSelf = ref.uri.toString() === codeLens.uri.toString() && !!ref.range.intersection(codeLens.range);
                return !isSelf;
            });
            let pureImplsForDedup: vscode.Location[] = [];
            try {
                pureImplsForDedup = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeImplementationProvider', codeLens.uri, position
                ) || [];
            } catch (e) {}

            const finalRefs = pureRefs.filter(ref => {
                return !pureImplsForDedup.some(impl => 
                    impl.uri.toString() === ref.uri.toString() && !!impl.range.intersection(ref.range)
                );
            });

            const refCount = finalRefs.length;
            codeLens.command = {
                title: `${refCount} ref${refCount !== 1 ? 's' : ''}`,
                command: 'newgovision.showLocations',
                arguments: [finalRefs]
            };
        } else if (codeLens.lensType === 'impls') {
            const pureImpls = implLocations.filter(impl => {
                const isSelf = impl.uri.toString() === codeLens.uri.toString() && !!impl.range.intersection(codeLens.range);
                return !isSelf;
            });
            const implCount = pureImpls.length;
            
            let title = `${implCount} impls`;
            if (codeLens.kind === vscode.SymbolKind.Struct || codeLens.kind === vscode.SymbolKind.Class) {
                title = `implements ${implCount} intfc`;
            } else if (codeLens.kind === vscode.SymbolKind.Method && codeLens.parentKind !== vscode.SymbolKind.Interface) {
                title = `impls ${implCount} intfc method${implCount !== 1 ? 's' : ''}`;
            }

            codeLens.command = {
                title: title,
                command: 'newgovision.showLocations',
                arguments: [pureImpls]
            };
        }

        return codeLens;
    }
}
