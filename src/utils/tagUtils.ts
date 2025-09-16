import { TFile, Notice, App, TFolder, TAbstractFile } from 'obsidian';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ConfirmationModal } from '../ui/modals/ConfirmationModal';
import { TAG_RANGE, TAG_PREDEFINED_RANGE, TAG_GENERATE_RANGE } from './constants';

// Re-export constants for backward compatibility
export { TAG_RANGE, TAG_PREDEFINED_RANGE, TAG_GENERATE_RANGE };

/**
 * Custom error type for tag-related operations
 */
export class TagError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TagError';
    }
}

/**
 * Represents the result of a tag operation
 */
export interface TagOperationResult {
    /** Whether the operation was successful */
    success: boolean;
    /** Message describing the result */
    message: string;
    /** Array of affected tags */
    tags?: string[];
}

export class TagUtils {
    /**
     * Gets existing tags from frontmatter
     * @param frontmatter - The frontmatter object from Obsidian's metadata cache
     * @returns Array of valid tags
     */
    static getExistingTags(frontmatter: { tags?: string | string[] | null } | null): string[] {
        if (!frontmatter) return [];
        if (!('tags' in frontmatter) || frontmatter.tags === null || frontmatter.tags === undefined) return [];

        try {
            const tags = Array.isArray(frontmatter.tags) ? 
                frontmatter.tags : 
                typeof frontmatter.tags === 'string' ? 
                    [frontmatter.tags] : 
                    [];

            return tags.filter(tag => tag !== null && tag !== undefined)
                .map(tag => String(tag)); // Convert all tags to strings
        } catch (error) {
            //console.error('Error getting existing tags:', error);
            return [];
        }
    }

    /**
     * Merges two arrays of tags, removing duplicates and sorting
     * @param existingTags - Array of existing tags
     * @param newTags - Array of new tags to merge
     * @returns Array of unique, sorted tags
     */
    static mergeTags(existingTags: string[], newTags: string[]): string[] {
        const validExisting = existingTags.map(tag => String(tag));
        const validNew = newTags.map(tag => String(tag));
        return [...new Set([...validExisting, ...validNew])].sort();
    }

    /**
     * Formats a tag to ensure consistent formatting
     * @param tag - Tag to format
     * @returns Properly formatted tag
     */
    static formatTag(tag: unknown): string {
        // Handle non-string tags by converting to string
        if (tag === null || tag === undefined) {
            return '';
        }
        
        const tagStr = typeof tag === 'string' ? tag : String(tag);
        
        // Remove leading # if present
        let formatted = tagStr.trim();
        if (formatted.startsWith('#')) {
            formatted = formatted.substring(1);
        }
        
        // Safety check: Remove problematic prefixes that shouldn't be in tag names
        // This provides an additional layer of protection against the prefix issue
        const problematicPrefixes = [
            'matchedExistingTags-',
            'suggestedTags-',
            'matchedTags-',
            'newTags-'
        ];
        
        for (const prefix of problematicPrefixes) {
            if (formatted.startsWith(prefix)) {
                formatted = formatted.substring(prefix.length);
                break;
            }
        }
        
        // Replace spaces and special characters with hyphens
        formatted = formatted.replace(/\s+/g, '-'); // First replace spaces with hyphens
        formatted = formatted.replace(/[^\p{L}\p{N}/-]/gu, '-'); // Then replace other special chars
        
        // Collapse multiple consecutive hyphens into a single one
        formatted = formatted.replace(/-{2,}/g, '-');
        
        // Remove hyphens from start and end
        formatted = formatted.replace(/^-+|-+$/g, '');
        
        return formatted.length > 0 ? formatted : '';
    }

    /**
     * Clears all tags from a file's frontmatter using Obsidian API.
     * @param app - Obsidian App instance
     * @param file - File to clear tags from
     * @returns Promise resolving to operation result
     */
    static async clearTags(app: App, file: TFile): Promise<TagOperationResult> {
        try {
            const content = await app.vault.read(file);
            const cache = app.metadataCache.getFileCache(file);
            const frontmatterPosition = cache?.frontmatterPosition;
            
            if (!frontmatterPosition) {
                return { success: true, message: "Skipped: Note has no frontmatter", tags: [] };
            }
            
            const frontmatterText = content.substring(
                frontmatterPosition.start.offset + 4, // Skip '---\n'
                frontmatterPosition.end.offset - 4    // Skip '\n---'
            );
            
            let frontmatter: any;
            try {
                frontmatter = yaml.load(frontmatterText) || {};
            } catch (yamlError) {
                //console.error('YAML parse error:', yamlError);
                return { 
                    success: false, 
                    message: "YAML parse error: " + (yamlError instanceof Error ? yamlError.message : String(yamlError)), 
                    tags: [] 
                };
            }
            
            if (!frontmatter || typeof frontmatter !== 'object') {
                return { success: true, message: "No valid frontmatter", tags: [] };
            }
            
            if (!('tags' in frontmatter)) {
                return { success: true, message: "No tags to clear", tags: [] };
            }
            
            const tagsToRemove = Array.isArray(frontmatter.tags) ? 
                frontmatter.tags.map(String) : 
                typeof frontmatter.tags === 'string' ? 
                    [frontmatter.tags] : [];
            
            delete frontmatter.tags;
            
            const newFrontmatter = yaml.dump(frontmatter).trim();
            
            const newContent = 
                '---\n' + 
                newFrontmatter + 
                '\n---' + 
                content.substring(frontmatterPosition.end.offset);
            
            if (newContent !== content) {
                try {
                    await app.vault.modify(file, newContent);
                    
                    // Allow a short delay for the metadata cache to update
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (modifyError) {
                    //console.error('Error modifying file:', modifyError);
                    throw new Error(`Failed to modify file: ${modifyError instanceof Error ? modifyError.message : String(modifyError)}`);
                }
            }
            
            const removedTags = tagsToRemove.map((tag: string) => `#${tag}`);
            
            return {
                success: true,
                message: `Cleared ${removedTags.length} tag${removedTags.length === 1 ? '' : 's'}`,
                tags: removedTags
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            //console.error('Error in clearTags:', error);
            new Notice(`Error clearing tags: ${message}`, 3000);
            return {
                success: false,
                message: `Clear failed: ${message}`
            };
        }
    }

    /**
     * Updates note tags in the frontmatter using Obsidian API
     * @param app - Obsidian App instance
     * @param file - File to update tags for
     * @param newTags - Array of new tags to add
     * @param matchedTags - Array of matched existing tags to add
     * @param silent - Whether to suppress notifications
     * @param replaceTags - Whether to replace existing tags (true) or merge with them (false)
     * @returns Promise resolving to operation result
     */
    static async updateNoteTags(
        app: App,
        file: TFile,
        newTags: string[],
        matchedTags: string[],
        silent: boolean = false,
        replaceTags: boolean = true
    ): Promise<TagOperationResult> {
        try {
            if (!Array.isArray(newTags) || !Array.isArray(matchedTags)) {
                throw new TagError('Tags parameter must be an array');
            }

            // Combine and format all tags
            const allTags = [...newTags, ...matchedTags];
            const yamlReadyTags = this.formatTags(allTags);
            
            if (yamlReadyTags.length === 0) {
                !silent && new Notice('No valid tags to add', 3000);
                return { success: true, message: 'No valid tags to add', tags: [] };
            }

            const content = await app.vault.read(file);
            
            try {
                const cache = app.metadataCache.getFileCache(file);
                const existingFrontmatter = cache?.frontmatter;
                
                // If we're not replacing tags, we need to merge with existing ones
                if (!replaceTags && existingFrontmatter) {
                    const existingTags = Array.isArray(existingFrontmatter.tags) ? 
                        existingFrontmatter.tags.map(String) : 
                        typeof existingFrontmatter.tags === 'string' ? 
                            [existingFrontmatter.tags] : [];
                    
                    // If we have existing tags and we're not replacing, combine them
                    if (existingTags.length > 0) {
                        const combined = this.mergeTags(existingTags, yamlReadyTags);
                        yamlReadyTags.length = 0;
                        yamlReadyTags.push(...combined);
                    }
                    
                    const existingSet = new Set(existingTags.map(t => t.toString().trim()));
                    const newSet = new Set(yamlReadyTags.map(t => t.toString().trim()));
                    
                    if (existingSet.size === newSet.size && 
                        [...existingSet].every(t => newSet.has(t))) {
                        const successMessage = `Tags already up to date (${yamlReadyTags.length} tag${yamlReadyTags.length === 1 ? '' : 's'})`;
                        !silent && new Notice(successMessage, 3000);
                        
                        return {
                            success: true,
                            message: successMessage,
                            tags: yamlReadyTags.map(tag => `#${tag}`)
                        };
                    }
                }
            } catch (compareError) {
                //console.error('Error comparing tags:', compareError);
            }
            
            try {
                const processor = app.metadataCache.getFileCache(file);
                const frontmatterPosition = processor?.frontmatterPosition;
                let newContent: string;
                
                if (frontmatterPosition) {
                    const frontmatterText = content.substring(
                        frontmatterPosition.start.offset + 4, // Skip '---\n'
                        frontmatterPosition.end.offset - 4    // Skip '\n---'
                    );
                    
                    let frontmatter: any;
                    try {
                        frontmatter = yaml.load(frontmatterText) || {};
                    } catch (e) {
                        //console.error('Error parsing frontmatter:', e);
                        frontmatter = {};
                    }
                    
                    frontmatter.tags = yamlReadyTags;
                    
                    const newFrontmatter = yaml.dump(frontmatter).trim();
                    
                    newContent = 
                        '---\n' + 
                        newFrontmatter + 
                        '\n---' + 
                        content.substring(frontmatterPosition.end.offset);
                } else {
                    const frontmatter = { tags: yamlReadyTags };
                    const newFrontmatter = yaml.dump(frontmatter).trim();
                    
                    newContent = '---\n' + newFrontmatter + '\n---\n\n' + content;
                }
                
                if (newContent !== content) {
                    await app.vault.modify(file, newContent);
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
            } catch (updateError) {
                //console.error('Error updating frontmatter:', updateError);
                throw new Error(`Failed to update frontmatter: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
            }

            const successMessage = `${replaceTags ? "Replaced" : "Added"} ${yamlReadyTags.length} tag${yamlReadyTags.length === 1 ? '' : 's'}`;
            !silent && new Notice(successMessage, 3000);

            return {
                success: true,
                message: successMessage,
                tags: yamlReadyTags.map(tag => `#${tag}`)
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            //console.error('Error in updateNoteTags:', error);
            !silent && new Notice(`Error updating tags: ${message}`, 3000);
            return {
                success: false,
                message: `Update failed: ${message}`
            };
        }
    }
    
    /**
     * Waits for Obsidian's metadata cache to update for a file
     * @param app - Obsidian App instance
     * @param file - File to wait for
     * @returns Promise that resolves when metadata is updated
     */
    private static async waitForMetadataUpdate(app: App, file: TFile): Promise<void> {
        return new Promise<void>((resolve) => {
            // Set a timeout to resolve anyway after a maximum wait time
            const timeout = setTimeout(() => {
                app.metadataCache.off('changed', eventHandler);
                console.warn('Metadata update timeout, continuing anyway');
                resolve();
            }, 2000);

            // Define event handler with proper type annotation
            const eventHandler = (...args: unknown[]) => {
                try {
                    const changedFile = args[0] as TFile;
                    if (changedFile?.path === file.path) {
                        clearTimeout(timeout);
                        app.metadataCache.off('changed', eventHandler);
                        // Add small delay to ensure cache is fully updated
                        setTimeout(resolve, 50);
                    }
                } catch (error) {
                    console.warn('Error in metadata change handler:', error);
                    clearTimeout(timeout);
                    app.metadataCache.off('changed', eventHandler);
                    // Resolve anyway to prevent hanging
                    resolve();
                }
            };
            
            app.metadataCache.on('changed', eventHandler);
            
            // Trigger the event if possible, but with a try/catch to handle any errors
            try {
                app.metadataCache.trigger('changed', file);
            } catch (error) {
                console.warn('Error triggering metadata change:', error);
                setTimeout(resolve, 50);
            }
        });
    }
    
    /**
     * Gets all unique tags from all markdown files in the vault
     * @param app - Obsidian App instance
     * @returns Array of unique tags, sorted alphabetically
     */
    static getAllTagsFromFrontmatter(app: App): string[] {
        const tags = new Set<string>();
        app.vault.getMarkdownFiles().forEach((file) => {
            const cache = app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                this.getExistingTags(cache.frontmatter).forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }

    static getAllTags(app: App): string[] {
        return this.getAllTagsFromFrontmatter(app);
    }
    
    /**
     * Saves all unique tags to a markdown file in the specified directory
     * @param app - Obsidian App instance
     * @param tagDir - Directory to save tags file in (default: 'tags')
     * @throws {TagError} If file operations fail
     */
    static async saveAllTags(app: App, tagDir: string = 'tags'): Promise<void> {
        const tags = this.getAllTagsFromFrontmatter(app);
        const formattedTags = tags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag).join('\n');
    
        const vault = app.vault;
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
    
        const folderPath = tagDir;
        const filePath = path.join(folderPath, `tags_${dateStr}.md`);

        // Show confirmation dialog
        const modal = new ConfirmationModal(
            app,
            'Save Tags',
            `Tags will be saved to: ${filePath}\nDo you want to continue?`,
            async () => {
                try {
                    // Try to create folder if it doesn't exist (ignore if already exists)
                    const folder = vault.getAbstractFileByPath(folderPath);
                    if (!folder) {
                        try {
                            await vault.createFolder(folderPath);
                        } catch (e) {
                            // Ignore folder exists error
                            if (!(e instanceof Error) || !e.message.includes('already exists')) {
                                throw e;
                            }
                        }
                    }
                    
                    // Create or modify file
                    const file = vault.getAbstractFileByPath(filePath);
                    if (!file) {
                        await vault.create(filePath, formattedTags);
                    } else {
                        await vault.modify(file as TFile, formattedTags);
                    }
                    
                    new Notice(`Tags saved to ${filePath}`, 3000);
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    new Notice(`Error saving tags: ${message}`, 3000);
                    throw new TagError(`Failed to save tags: ${message}`);
                }
            }
        );
        
        modal.open();
    }

    /**
     * Gets tags from a specified file
     * @param app - Obsidian App instance
     * @param filePath - Path to the tags file
     * @returns Promise resolving to an array of tags, or null if file not found
     */
    static async getTagsFromFile(app: App, filePath: string): Promise<string[] | null> {
        try {
            if (!filePath) {
                return null;
            }
            
            const file = app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                return null;
            }
            
            const content = await app.vault.read(file);
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(tag => this.formatTag(tag));
        } catch (error) {
            //console.error('Error reading tags file:', error);
            return null;
        }
    }
    
    /**
     * Formats an array of tags, filtering out invalid ones
     * @param tags - Array of tags to format
     * @param keepHashPrefix - Whether to keep # prefix in the returned tags
     * @returns Array of formatted valid tags
     */
    static formatTags(tags: unknown[], keepHashPrefix: boolean = false): string[] {
        if (!Array.isArray(tags)) {
            return [];
        }
        
        return tags
            .filter(tag => tag !== null && tag !== undefined)
            .map(tag => {
                try {
                    const formatted = this.formatTag(tag);
                    return keepHashPrefix ? `#${formatted}` : formatted;
                } catch (error) {
                    return null;
                }
            })
            .filter((tag): tag is string => tag !== null);
    }

    /**
     * Writes tags to a note's frontmatter
     * @param app - Obsidian App instance
     * @param file - File to update
     * @param tags - Array of tags to add
     * @param replace - Whether to replace existing tags (default: false)
     * @returns Promise resolving to operation result
     */
    static async writeTagsToFrontmatter(
        app: App, 
        file: TFile, 
        tags: string[], 
        replace: boolean = false
    ): Promise<TagOperationResult> {
        try {
            if (!Array.isArray(tags)) {
                throw new Error('Tags parameter must be an array');
            }

            // Format and sanitize tags
            const formattedTags = this.formatTags(tags);
            
            if (formattedTags.length === 0) {
                return { 
                    success: true, 
                    message: 'No valid tags to add', 
                    tags: [] 
                };
            }

            const content = await app.vault.read(file);
            const cache = app.metadataCache.getFileCache(file);
            
            // Get existing tags if we're not replacing them
            let finalTags: string[];
            if (replace) {
                finalTags = formattedTags;
            } else {
                // Safely get existing tags even if frontmatter is undefined
                const existingTags = cache && cache.frontmatter 
                    ? this.getExistingTags(cache.frontmatter) 
                    : [];
                finalTags = this.mergeTags(existingTags, formattedTags);
            }
            
            // Create new content with updated frontmatter
            let newContent: string;
            const frontmatterPosition = cache?.frontmatterPosition;
            
            if (frontmatterPosition) {
                try {
                    // Extract and modify existing frontmatter
                    const frontmatterText = content.substring(
                        frontmatterPosition.start.offset + 4, // Skip '---\n'
                        frontmatterPosition.end.offset - 4    // Skip '\n---'
                    );
                    
                    let frontmatter: any;
                    try {
                        frontmatter = yaml.load(frontmatterText) || {};
                    } catch (yamlError) {
                        //console.error('YAML parse error:', yamlError);
                        throw new Error(`YAML parse error: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`);
                    }
                    
                    // Update tags in frontmatter
                    frontmatter.tags = finalTags;
                    
                    // Convert back to YAML
                    const newFrontmatter = yaml.dump(frontmatter).trim();
                    
                    // Reconstruct the file content
                    newContent = 
                        '---\n' + 
                        newFrontmatter + 
                        '\n---' + 
                        content.substring(frontmatterPosition.end.offset);
                } catch (error) {
                    //console.error('Error processing existing frontmatter:', error);
                    // Fall back to creating new frontmatter
                    const yamlTags = finalTags.map(tag => `  - ${tag}`).join('\n');
                    newContent = `---\ntags:\n${yamlTags}\n---\n${content}`;
                }
            } else {
                // Create new frontmatter
                const yamlTags = finalTags.map(tag => `  - ${tag}`).join('\n');
                newContent = `---\ntags:\n${yamlTags}\n---\n${content}`;
            }
            
            // Write changes to file
            await app.vault.modify(file, newContent);
            
            // Instead of waiting for metadata cache update which could fail,
            // just add a simple delay to allow file system operations to complete
            await new Promise(resolve => setTimeout(resolve, 300));
            
            return {
                success: true,
                message: `Added ${finalTags.length} tag${finalTags.length === 1 ? '' : 's'}`,
                tags: finalTags.map(tag => `#${tag}`)
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            //console.error('Error writing tags to frontmatter:', error);
            return {
                success: false,
                message: `Failed to update tags: ${message}`
            };
        }
    }

    /**
     * Checks if a file should be excluded based on patterns
     * @param file - The file to check
     * @param excludePatterns - Array of exclusion patterns
     * @returns True if the file should be excluded, false otherwise
     */
    static isFileExcluded(file: TAbstractFile, excludePatterns: string[]): boolean {
        if (!excludePatterns || excludePatterns.length === 0) {
            return false;
        }

        const filePath = file.path;
        
        for (const pattern of excludePatterns) {
            try {
                // Simple wildcard pattern matching
                if (this.matchesGlobPattern(filePath, pattern)) {
                    return true;
                }
                
                // Path pattern matching - use startsWith for precise matching
                if (filePath.toLowerCase().startsWith(pattern.toLowerCase())) {
                    return true;
                }
                
                // Regex pattern (enclosed in slashes)
                if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
                    const regexPattern = pattern.slice(1, -1);
                    try {
                        const regex = new RegExp(regexPattern, 'i');
                        if (regex.test(filePath)) {
                            return true;
                        }
                    } catch {
                        // Invalid regex pattern - silently ignore and continue to next pattern
                    }
                }
            } catch (error) {
                // If any pattern fails, log it but continue with other patterns
                //console.error(`Error checking pattern "${pattern}":`, error);
            }
        }
        
        return false;
    }

    /**
     * Gets all markdown files from a folder recursively, including nested files
     * @param folder - The folder to search in
     * @returns Array of TFile objects that are markdown files
     */
    private static getMarkdownFilesFromFolder(folder: TFolder): TFile[] {
        const markdownFiles: TFile[] = [];
        
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                markdownFiles.push(child);
            } else if (child instanceof TFolder) {
                // Recursively get files from subfolders
                markdownFiles.push(...this.getMarkdownFilesFromFolder(child));
            }
        }
        
        return markdownFiles;
    }

    /**
     * Gets non-excluded markdown files from vault or specific folder
     * @param app - Obsidian App instance
     * @param excludePatterns - Array of exclusion patterns
     * @param folder - Optional folder to limit search to (includes nested files)
     * @returns Array of TFile objects that are markdown files and not excluded
     */
    static getNonExcludedMarkdownFiles(
        app: App, 
        excludePatterns: string[] = [], 
        folder?: TFolder
    ): TFile[] {
        let allFiles: TFile[];
        
        if (folder) {
            // Get all markdown files from the specified folder (including nested)
            allFiles = this.getMarkdownFilesFromFolder(folder);
        } else {
            // Get all markdown files from the vault
            allFiles = app.vault.getMarkdownFiles();
        }
        
        // Filter out excluded files
        return allFiles.filter(file => !this.isFileExcluded(file, excludePatterns));
    }
    
    /**
     * Simple glob pattern matching implementation
     * Supports * (any characters) and ? (single character)
     * @param str - String to test
     * @param pattern - Glob pattern
     * @returns True if the string matches the pattern
     */
    private static matchesGlobPattern(str: string, pattern: string): boolean {
        // Convert glob pattern to regex
        let regexPattern = pattern
            .replace(/\./g, '\\.') // Escape dots
            .replace(/\*\*/g, '###GLOBSTAR###') // Temporarily replace ** with placeholder
            .replace(/\*/g, '[^/]*') // Replace * with regex that doesn't match path separator
            .replace(/\?/g, '[^/]') // Replace ? with regex for any character except path separator
            .replace(/###GLOBSTAR###/g, '.*'); // Replace placeholder with regex for any characters
        
        // If pattern doesn't start with *, add ^ to match start of string
        if (!pattern.startsWith('*')) {
            regexPattern = '^' + regexPattern;
        }
        
        // If pattern doesn't end with *, add $ to match end of string
        if (!pattern.endsWith('*')) {
            regexPattern = regexPattern + '$';
        }
        
        try {
            const regex = new RegExp(regexPattern, 'i');
            return regex.test(str);
        } catch (e) {
            //console.error('Error creating regex from pattern:', pattern, e);
            return false;
        }
    }
}
