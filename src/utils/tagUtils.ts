import { TFile, Notice, App, TFolder } from 'obsidian';
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
        if (!frontmatter?.tags) return [];

        const tags = Array.isArray(frontmatter.tags) ? 
            frontmatter.tags : 
            typeof frontmatter.tags === 'string' ? 
                [frontmatter.tags] : 
                [];

        return tags.map(tag => String(tag)); // 所有标签都视为有效
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
        
        // Replace special characters with hyphens
        formatted = formatted.replace(/[^\p{L}\p{N}]/gu, '-');
        
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
                console.error('YAML parse error:', yamlError);
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
                    console.error('Error modifying file:', modifyError);
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
            console.error('Error in clearTags:', error);
            new Notice(`Error clearing tags: ${message}`, 3000);
            return {
                success: false,
                message: `Clear failed: ${message}`
            };
        }
    }

    /**
     * Updates tags in a file's frontmatter
     * @param app - Obsidian App instance
     * @param file - File to update tags in
     * @param newTags - Array of new tags to add
     * @param matchedTags - Array of matched existing tags to add
     * @returns Promise resolving to operation result
     */
    static async updateNoteTags(
        app: App,
        file: TFile,
        newTags: string[],
        matchedTags: string[],
        silent: boolean = false
    ): Promise<TagOperationResult> {
        try {
            if (!Array.isArray(newTags) || !Array.isArray(matchedTags)) {
                throw new TagError('Tag parameters must be arrays');
            }

            const stringNewTags = newTags.map(tag => String(tag));
            const stringMatchedTags = matchedTags.map(tag => String(tag));
            
            const filteredNewTags = [...new Set(stringNewTags.filter(tag => tag.trim()))];
            const filteredMatchedTags = [...new Set(stringMatchedTags.filter(tag => tag.trim()))];

            // 将所有标签视为有效
            const validNewTags = filteredNewTags;
            const invalidNewTags: string[] = [];
            const validMatchedTags = filteredMatchedTags;

            if (invalidNewTags.length > 0 && !silent) {
                new Notice(`Skipped invalid tags: ${invalidNewTags.join(', ')}`, 3000);
            }

            if (validNewTags.length === 0 && validMatchedTags.length === 0) {
                !silent && new Notice('No valid tags to add', 3000);
                return { success: true, message: 'No valid tags to add', tags: [] };
            }

            const content = await app.vault.read(file);
            const cache = app.metadataCache.getFileCache(file);
            const existingTags = this.getExistingTags(cache?.frontmatter || null);
            
            const allTags = this.mergeTags(existingTags, [...validNewTags, ...validMatchedTags])
                .map(tag => tag.startsWith('#') ? tag.substring(1) : tag);

            let newContent = content;
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const yamlTags = allTags.map(tag => `  - ${tag}`).join('\n');

            const processFrontMatter = (frontmatter: string) => {
                // Remove empty object if present
                frontmatter = frontmatter.replace(/^\s*{}\s*$/m, '').trim();
                
                const yaml = frontmatter.split('\n');
                // Filter out any existing tags and empty objects
                const processed = yaml.filter(line => {
                    const trimmed = line.trim();
                    return !(
                        trimmed.startsWith('tags:') || 
                        trimmed.startsWith('- ') || 
                        trimmed === '{}'
                    );
                });
                
                // Add tags section
                processed.push('tags:');
                if (allTags.length > 0) {
                    processed.push(...allTags.map(tag => `  - ${tag}`));
                }
                
                return processed.join('\n');
            };

            const hasFrontmatter = frontmatterRegex.test(content);

            newContent = hasFrontmatter
                ? content.replace(frontmatterRegex, (_, frontmatter) => `---\n${processFrontMatter(frontmatter)}\n---`)
                : `---\ntags:\n${yamlTags}\n---\n${content}`;

            await app.vault.modify(file, newContent);
            await this.waitForMetadataUpdate(app, file);
            app.workspace.trigger('file-open', file);

            const successMessage = `Added ${allTags.length} tag${allTags.length === 1 ? '' : 's'}`;
            !silent && new Notice(successMessage, 3000);

            return {
                success: true,
                message: successMessage,
                tags: allTags.map(tag => `#${tag}`)
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
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
                const changedFile = args[0] as TFile;
                if (changedFile?.path === file.path) {
                    clearTimeout(timeout);
                    app.metadataCache.off('changed', eventHandler);
                    // Add small delay to ensure cache is fully updated
                    setTimeout(resolve, 50);
                }
            };
            
            app.metadataCache.on('changed', eventHandler);
            app.metadataCache.trigger('changed', file);
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
            console.error('Error reading tags file:', error);
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
                const existingTags = this.getExistingTags(cache?.frontmatter || null);
                finalTags = this.mergeTags(existingTags, formattedTags);
            }
            
            // Create new content with updated frontmatter
            let newContent: string;
            const frontmatterPosition = cache?.frontmatterPosition;
            
            if (frontmatterPosition) {
                // Extract and modify existing frontmatter
                const frontmatterText = content.substring(
                    frontmatterPosition.start.offset + 4, // Skip '---\n'
                    frontmatterPosition.end.offset - 4    // Skip '\n---'
                );
                
                let frontmatter: any;
                try {
                    frontmatter = yaml.load(frontmatterText) || {};
                } catch (yamlError) {
                    console.error('YAML parse error:', yamlError);
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
            } else {
                // Create new frontmatter
                const yamlTags = finalTags.map(tag => `  - ${tag}`).join('\n');
                newContent = `---\ntags:\n${yamlTags}\n---\n${content}`;
            }
            
            // Write changes to file
            await app.vault.modify(file, newContent);
            
            // Allow a short delay for the metadata cache to update
            await new Promise(resolve => setTimeout(resolve, 300));
            
            return {
                success: true,
                message: `Added ${finalTags.length} tag${finalTags.length === 1 ? '' : 's'}`,
                tags: finalTags.map(tag => `#${tag}`)
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error writing tags to frontmatter:', error);
            return {
                success: false,
                message: `Failed to update tags: ${message}`
            };
        }
    }
}
