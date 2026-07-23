import * as vscode from 'vscode';
import * as path from 'path';

export interface SymbolInfo {
    name: string;
    kind: vscode.SymbolKind;
}

function getIconForSymbolKind(kind: vscode.SymbolKind): string {
    switch (kind) {
        case vscode.SymbolKind.File: return 'symbol-file';
        case vscode.SymbolKind.Module: return 'symbol-module';
        case vscode.SymbolKind.Namespace: return 'symbol-namespace';
        case vscode.SymbolKind.Package: return 'symbol-package';
        case vscode.SymbolKind.Class: return 'symbol-class';
        case vscode.SymbolKind.Method: return 'symbol-method';
        case vscode.SymbolKind.Property: return 'symbol-property';
        case vscode.SymbolKind.Field: return 'symbol-field';
        case vscode.SymbolKind.Constructor: return 'symbol-constructor';
        case vscode.SymbolKind.Enum: return 'symbol-enum';
        case vscode.SymbolKind.Interface: return 'symbol-interface';
        case vscode.SymbolKind.Function: return 'symbol-function';
        case vscode.SymbolKind.Variable: return 'symbol-variable';
        case vscode.SymbolKind.Constant: return 'symbol-constant';
        case vscode.SymbolKind.String: return 'symbol-string';
        case vscode.SymbolKind.Number: return 'symbol-numeric';
        case vscode.SymbolKind.Boolean: return 'symbol-boolean';
        case vscode.SymbolKind.Array: return 'symbol-array';
        case vscode.SymbolKind.Object: return 'symbol-misc';
        case vscode.SymbolKind.Key: return 'symbol-key';
        case vscode.SymbolKind.Null: return 'symbol-misc';
        case vscode.SymbolKind.EnumMember: return 'symbol-enum-member';
        case vscode.SymbolKind.Struct: return 'symbol-struct';
        case vscode.SymbolKind.Event: return 'symbol-event';
        case vscode.SymbolKind.Operator: return 'symbol-operator';
        case vscode.SymbolKind.TypeParameter: return 'symbol-type-parameter';
        default: return 'symbol-misc';
    }
}

export class LocationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconId?: string,
        public readonly location?: vscode.Location,
        desc?: string
    ) {
        super(label, collapsibleState);
        this.description = desc;
        
        if (iconId) {
            this.iconPath = new vscode.ThemeIcon(iconId);
        }
        
        if (location) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [
                    location.uri,
                    {
                        selection: location.range
                    }
                ]
            };
        }
    }
}

export class ReferenceTreeViewProvider implements vscode.TreeDataProvider<LocationTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LocationTreeItem | undefined | void> = new vscode.EventEmitter<LocationTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<LocationTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private locations: vscode.Location[] = [];
    private title: string = '';
    private symbolInfo?: SymbolInfo;

    refresh(locations: vscode.Location[], title: string, symbolInfo: SymbolInfo): void {
        this.locations = locations;
        this.title = title;
        this.symbolInfo = symbolInfo;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LocationTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LocationTreeItem): Promise<LocationTreeItem[]> {
        if (!this.locations || this.locations.length === 0 || !this.symbolInfo) {
            return [];
        }

        if (!element) {
            // Root node: The original symbol
            const rootItem = new LocationTreeItem(
                this.symbolInfo.name,
                vscode.TreeItemCollapsibleState.Expanded,
                getIconForSymbolKind(this.symbolInfo.kind),
                undefined,
                this.title
            );
            rootItem.contextValue = 'rootSymbol';
            return [rootItem];
        } else if (element.contextValue === 'rootSymbol') {
            // Children of root are files
            const files = new Map<string, vscode.Uri>();
            for (const loc of this.locations) {
                files.set(loc.uri.toString(), loc.uri);
            }

            const items = Array.from(files.values()).map(uri => {
                const item = new LocationTreeItem(
                    path.basename(uri.fsPath),
                    vscode.TreeItemCollapsibleState.Expanded,
                    'file',
                    undefined,
                    vscode.workspace.asRelativePath(uri)
                );
                item.resourceUri = uri;
                item.contextValue = 'fileNode';
                return item;
            });

            return items;
        } else if (element.contextValue === 'fileNode' && element.resourceUri) {
            // Children of file are locations
            const fileUri = element.resourceUri;
            const fileLocs = this.locations.filter(loc => loc.uri.toString() === fileUri.toString());
            
            fileLocs.sort((a, b) => a.range.start.line - b.range.start.line);

            const items = await Promise.all(fileLocs.map(async loc => {
                let lineText = `Line ${loc.range.start.line + 1}`;
                
                try {
                    const doc = await vscode.workspace.openTextDocument(loc.uri);
                    const text = doc.lineAt(loc.range.start.line).text.trim();
                    if (text) {
                        lineText = text;
                    }
                } catch (e) {
                    // Ignore
                }

                return new LocationTreeItem(
                    lineText,
                    vscode.TreeItemCollapsibleState.None,
                    'go-to-file', 
                    loc,
                    `Line ${loc.range.start.line + 1}`
                );
            }));
            
            return items;
        }

        return [];
    }
}
