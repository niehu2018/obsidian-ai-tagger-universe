import { App } from 'obsidian';

export interface VaultItem {
    path: string;
    isFolder: boolean;
    name: string;
}

/**
 * Gets all paths from the vault, including files and folders
 * @param app The Obsidian app instance
 * @returns Array of VaultItem objects with path, isFolder, and name
 */
export function getVaultItems(app: App): VaultItem[] {
    const items: VaultItem[] = [];
    
    // Add all files
    app.vault.getFiles().forEach(file => {
        items.push({
            path: file.path,
            isFolder: false,
            name: file.name
        });
    });
    
    // Add all folders
    app.vault.getAllLoadedFiles().forEach(abstractFile => {
        if ('children' in abstractFile) {  // Check if it's a folder
            items.push({
                path: abstractFile.path,
                isFolder: true,
                name: abstractFile.name
            });
        }
    });
    
    return items;
}

/**
 * Gets just the path strings from all vault items
 * @param app The Obsidian app instance
 * @returns Array of path strings
 */
export function getPathStrings(app: App): string[] {
    return getVaultItems(app).map(item => item.path);
} 