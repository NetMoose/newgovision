import * as vscode from 'vscode';
import * as path from 'path';

export class LocationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly location?: vscode.Location,
        desc?: string
    ) {
        super(label, collapsibleState);
        this.description = desc;
        
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

    refresh(locations: vscode.Location[]): void {
        this.locations = locations;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LocationTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LocationTreeItem): Promise<LocationTreeItem[]> {
        if (!this.locations || this.locations.length === 0) {
            return [];
        }

        if (element) {
            // It's a file node, return locations in this file
            const fileUri = element.resourceUri;
            if (!fileUri) return [];
            
            const fileLocs = this.locations.filter(loc => loc.uri.toString() === fileUri.toString());
            
            // Try to extract lines if possible, or just return line numbers
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
                    loc,
                    `Line ${loc.range.start.line + 1}`
                );
            }));
            
            return items;
        } else {
            // Root nodes are files
            const files = new Map<string, vscode.Uri>();
            for (const loc of this.locations) {
                files.set(loc.uri.toString(), loc.uri);
            }

            const items = Array.from(files.values()).map(uri => {
                const item = new LocationTreeItem(
                    path.basename(uri.fsPath),
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined,
                    vscode.workspace.asRelativePath(uri)
                );
                item.resourceUri = uri;
                return item;
            });

            return items;
        }
    }
}
