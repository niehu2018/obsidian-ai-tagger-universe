import { App, TFolder, TFile } from 'obsidian';

export interface VaultItem {
    path: string;
    isFolder: boolean;
    name: string;
    children?: VaultItem[];
}

/**
 * Get vault items matching a search term
 */
export function getVaultItems(app: App, searchTerm?: string): VaultItem[] {
    // First collect all paths
    const allItems: VaultItem[] = [];
    collectAllPaths(app, allItems);
    
    // Filter by search term if provided
    if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const filteredItems = allItems.filter(item => 
            item.path.toLowerCase().includes(term) || 
            item.name.toLowerCase().includes(term)
        );
        return filteredItems;
    }
    
    return allItems;
}

/**
 * Collect all paths from the vault in a flattened structure
 */
function collectAllPaths(app: App, result: VaultItem[]): void {
    // Get root folder
    const rootFolder = app.vault.getRoot();
    
    // Process root folder contents
    const files = app.vault.getFiles();
    const folders = getAllFolders(app);
    
    // Add all folders to the result
    for (const folder of folders) {
        if (folder.path === '/') continue; // Skip root folder
        
        result.push({
            path: folder.path.endsWith('/') ? folder.path : folder.path + '/',
            isFolder: true,
            name: folder.name
        });
    }
    
    // Add all files to the result
    for (const file of files) {
        result.push({
            path: file.path,
            isFolder: false,
            name: file.name
        });
    }
}

/**
 * Get all folders in the vault
 */
function getAllFolders(app: App): TFolder[] {
    const result: TFolder[] = [];
    const rootFolder = app.vault.getRoot();
    
    // Function to recursively collect folders
    function collectFolders(folder: TFolder) {
        result.push(folder);
        
        // Process all subfolders
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                collectFolders(child);
            }
        }
    }
    
    collectFolders(rootFolder);
    return result;
}

/**
 * Get all flattened paths as strings
 */
export function getPathStrings(app: App, includeFiles: boolean = true): string[] {
    const items = getVaultItems(app);
    
    if (includeFiles) {
        return items.map(item => item.path);
    } else {
        return items.filter(item => item.isFolder).map(item => item.path);
    }
}

/**
 * Helper function to test if a path should be excluded
 */
export function isPathExcluded(path: string, excludedPatterns: string[]): boolean {
    for (const pattern of excludedPatterns) {
        try {
            // Check if pattern is a regex (enclosed in /)
            if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
                const regex = new RegExp(pattern.slice(1, -1));
                if (regex.test(path)) {
                    return true;
                }
            } 
            // Simple glob-like matching (* as wildcard)
            else if (pattern.includes('*')) {
                const regexPattern = pattern.replace(/\*/g, '.*');
                const regex = new RegExp(`^${regexPattern}$`);
                if (regex.test(path)) {
                    return true;
                }
            }
            // Direct path or folder matching 
            else if (path === pattern || path.startsWith(pattern)) {
                return true;
            }
        } catch (error) {
            // Keep this error logging as it's important for debugging invalid patterns
            //console.error(`Invalid exclusion pattern: ${pattern}`, error);
        }
    }
    
    return false;
} 