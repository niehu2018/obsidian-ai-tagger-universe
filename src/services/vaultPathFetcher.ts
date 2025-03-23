import { App, TFolder, TFile } from 'obsidian';

export interface VaultItem {
    path: string;
    isFolder: boolean;
    name: string;
    children?: VaultItem[];
}

export function getVaultItems(app: App, searchTerm?: string): VaultItem[] {
    const items: VaultItem[] = [];
    const rootFolder = app.vault.getRoot();
    
    processFolder(rootFolder, items);
    
    if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        return items.filter(item => 
            item.path.toLowerCase().includes(term) || 
            item.name.toLowerCase().includes(term)
        );
    }
    
    return items;
}

function processFolder(folder: TFolder, items: VaultItem[]): void {
    const folderItem: VaultItem = {
        path: folder.path,
        isFolder: true,
        name: folder.name,
        children: []
    };
    
    if (folder.path !== '/') {
        items.push(folderItem);
    }
    
    for (const child of folder.children) {
        if (child instanceof TFolder) {
            processFolder(child, folderItem.path === '/' ? items : folderItem.children!);
        } else if (child instanceof TFile) {
            const fileItem: VaultItem = {
                path: child.path,
                isFolder: false,
                name: child.name
            };
            
            if (folderItem.path === '/') {
                items.push(fileItem);
            } else {
                folderItem.children!.push(fileItem);
            }
        }
    }
}

export function flattenVaultItems(items: VaultItem[]): string[] {
    const result: string[] = [];
    
    function traverse(item: VaultItem) {
        result.push(item.path);
        
        if (item.children) {
            for (const child of item.children) {
                traverse(child);
            }
        }
    }
    
    for (const item of items) {
        traverse(item);
    }
    
    return result;
}
