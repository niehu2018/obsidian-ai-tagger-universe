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
 * Clears all tags from a file's frontmatter using a YAML parser for precise handling.
 * @param app - Obsidian App instance
 * @param file - File to clear tags from
 * @returns Promise resolving to operation result
 */
static async clearTags(app: App, file: TFile): Promise<TagOperationResult> {
  try {
    const content = await app.vault.read(file);
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const frontmatterMatch = frontmatterRegex.exec(content);
    if (!frontmatterMatch) {
      return { success: true, message: "Skipped: Note has no frontmatter", tags: [] };
    }

    const fmContent = frontmatterMatch[1];
    let fmObject: any;
    try {
      fmObject = yaml.load(fmContent);
    } catch (yamlError) {
      return { success: false, message: "YAML parse error: " + (yamlError instanceof Error ? yamlError.message : yamlError), tags: [] };
    }

    if (!fmObject || typeof fmObject !== 'object') {
      return { success: true, message: "No valid frontmatter", tags: [] };
    }

    // Only proceed if there are tags to remove
    if (!('tags' in fmObject)) {
      return { success: true, message: "No tags to clear", tags: [] };
    }

    // Only remove the tags property, keeping all other frontmatter intact
    delete fmObject['tags'];
    const newFmContent = yaml.dump(fmObject || {}).trim();
    
    // Always preserve the frontmatter block even if empty
    const newContent = `---\n${newFmContent || ''}\n---${content.slice(frontmatterMatch[0].length)}`;
    
    if (newContent !== content) {
      await app.vault.modify(file, newContent);
      await this.waitForMetadataUpdate(app, file);
      app.metadataCache.trigger('changed', file);
      app.workspace.trigger('file-open', file);
    }

    return {
      success: true,
      message: 'Cleared tags',
      tags: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
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
     * @throws {TagError} If metadata update times out
     */
    private static async waitForMetadataUpdate(app: App, file: TFile): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Set a timeout to prevent hanging
            const timeout = setTimeout(() => {
                app.metadataCache.off('changed', eventHandler);
                reject(new TagError('Metadata update timeout'));
            }, 5000);

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
            
            // Create YAML frontmatter with tags
            const yamlTags = finalTags.map(tag => `  - ${tag}`).join('\n');
            let newContent: string;
            
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const hasFrontmatter = frontmatterRegex.test(content);
            
            if (hasFrontmatter) {
                // Update existing frontmatter
                newContent = content.replace(frontmatterRegex, (_, frontmatter) => {
                    const processed = this.processFrontMatter(frontmatter);
                    processed.push('tags:');
                    if (finalTags.length > 0) {
                        processed.push(...finalTags.map(tag => `  - ${tag}`));
                    }
                    return `---\n${processed.join('\n')}\n---`;
                });
            } else {
                // Create new frontmatter
                newContent = `---\ntags:\n${yamlTags}\n---\n${content}`;
            }
            
            // Write changes to file
            await app.vault.modify(file, newContent);
            
            // Wait for metadata cache to update
            await this.waitForMetadataUpdate(app, file);
            
            // Trigger file reloading
            app.workspace.trigger('file-open', file);
            
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
    
    /**
     * Process frontmatter content to prepare for tag updates
     * @param frontmatter - Frontmatter content as string
     * @returns Array of processed lines
     */
    private static processFrontMatter(frontmatter: string): string[] {
        // Remove empty object if present
        frontmatter = frontmatter.replace(/^\s*{}\s*$/m, '').trim();
        
        const yaml = frontmatter.split('\n');
        // Filter out any existing tags and empty objects
        return yaml.filter(line => {
            const trimmed = line.trim();
            return !(
                trimmed.startsWith('tags:') || 
                trimmed.startsWith('- ') || 
                trimmed === '{}'
            );
        });
    }
}
