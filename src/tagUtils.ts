import { TFile, Notice, App, TFolder } from 'obsidian';
import * as path from 'path';

// Min and Max values for tag range settings
export const TAG_RANGE = {
    MIN: 0,
    MAX: 10
} as const;

export const TAG_PREDEFINED_RANGE = {
    MIN: TAG_RANGE.MIN,
    MAX: 5
} as const;

export const TAG_MATCH_RANGE = {
    MIN: TAG_RANGE.MIN,
    MAX: 5
} as const;

export const TAG_GENERATE_RANGE = {
    MIN: TAG_RANGE.MIN,
    MAX: 5
} as const;

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
     * Validates a single tag according to Obsidian's tag requirements
     * @param tag - The tag to validate
     * @returns boolean indicating if the tag is valid
     */
    static validateTag(tag: unknown): boolean {
        let tagStr: string;
        if (typeof tag !== 'string') {
            try {
                tagStr = String(tag);
            } catch (e) {
                return false;
            }
        } else {
            tagStr = tag;
        }
        if (!tagStr) return false;
        
        const normalizedTag = tagStr.trim();
        if (!normalizedTag.startsWith('#')) {
            // First character must be a letter from any language
            if (!/^[\p{Letter}]/u.test(normalizedTag)) {
                return false;
            }
        }
        
        const tagWithHash = normalizedTag.startsWith('#') ? normalizedTag : `#${normalizedTag}`;
        // Tag can contain letters from any language, numbers, and hyphens
        const isValid = /^#[\p{Letter}\p{Number}-]+$/u.test(tagWithHash);
        // Obsidian doesn't allow tags to end with a hyphen
        return isValid && !tagWithHash.endsWith('-');
    }

    /**
     * Validates an array of tags
     * @param tags - Array of tags to validate
     * @returns Object containing arrays of valid and invalid tags
     */
    static validateTags(tags: unknown[]): { valid: string[], invalid: string[] } {
        if (!Array.isArray(tags)) {
            return { valid: [], invalid: [] };
        }

        const valid: string[] = [];
        const invalid: string[] = [];
        
        for (const tag of tags) {
            try {
                const tagStr = typeof tag === 'string' ? tag : String(tag);
                if (this.validateTag(tagStr)) {
                    valid.push(tagStr);
                } else {
                    invalid.push(tagStr);
                }
            } catch (e) {
                if (tag) invalid.push(String(tag));
            }
        }

        return { valid, invalid };
    }

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

        return this.validateTags(tags).valid;
    }

    /**
     * Merges two arrays of tags, removing duplicates and sorting
     * @param existingTags - Array of existing tags
     * @param newTags - Array of new tags to merge
     * @returns Array of unique, sorted tags
     */
    static mergeTags(existingTags: string[], newTags: string[]): string[] {
        const { valid: validExisting } = this.validateTags(existingTags);
        const { valid: validNew } = this.validateTags(newTags);
        return [...new Set([...validExisting, ...validNew])].sort();
    }

    /**
     * Formats a tag to ensure it starts with # and is properly formatted
     * @param tag - Tag to format
     * @throws {TagError} If tag format is invalid
     * @returns Formatted tag string
     */
    static formatTag(tag: unknown): string {
        const tagStr = typeof tag === 'string' ? tag : String(tag);
        const formattedTag = tagStr.trim().startsWith('#') ? tagStr.trim() : `#${tagStr.trim()}`;
        if (!this.validateTag(formattedTag)) {
            throw new TagError(`Invalid tag format: ${tagStr} (must start with # or a letter, and can only contain letters, numbers, and hyphens)`);
        }
        return formattedTag;
    }

    /**
     * Clears all tags from a file's frontmatter
     * @param app - Obsidian App instance
     * @param file - File to clear tags from
     * @returns Promise resolving to operation result
     */
    static async clearTags(app: App, file: TFile): Promise<TagOperationResult> {
        try {
            const content = await app.vault.read(file);
            let newContent = content;
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;

            const processFrontMatter = (frontmatter: string) => {
                const yaml = frontmatter.split('\n');
                const processed = yaml.filter(line => 
                    !line.trim().startsWith('tags:') && 
                    !line.trim().startsWith('- ')
                );
                return processed.join('\n');
            };

            if (frontmatterRegex.test(content)) {
                newContent = content.replace(frontmatterRegex, (_, frontmatter) => {
                    const processedFrontmatter = processFrontMatter(frontmatter);
                    if (!processedFrontmatter.trim()) {
                        // If frontmatter is empty after removing tags, remove the frontmatter section entirely
                        return '';
                    }
                    return `---\n${processedFrontmatter}\n---`;
                });
            }

            await app.vault.modify(file, newContent);
            await this.waitForMetadataUpdate(app, file);
            
            app.metadataCache.trigger('changed', file);
            app.workspace.trigger('file-open', file);
            
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
        matchedTags: string[]
    ): Promise<TagOperationResult> {
        try {
            if (!Array.isArray(newTags) || !Array.isArray(matchedTags)) {
                throw new TagError('Tag parameters must be arrays');
            }

            const stringNewTags = newTags.map(tag => String(tag));
            const stringMatchedTags = matchedTags.map(tag => String(tag));
            
            const filteredNewTags = [...new Set(stringNewTags.filter(tag => tag.trim()))];
            const filteredMatchedTags = [...new Set(stringMatchedTags.filter(tag => tag.trim()))];

            const { valid: validNewTags, invalid: invalidNewTags } = this.validateTags(filteredNewTags);
            const { valid: validMatchedTags } = this.validateTags(filteredMatchedTags);

            if (invalidNewTags.length > 0) {
                new Notice(`Skipped invalid tags: ${invalidNewTags.join(', ')}`, 3000);
            }

            if (validNewTags.length === 0 && validMatchedTags.length === 0) {
                new Notice('No valid tags to add', 3000);
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
                const yaml = frontmatter.split('\n');
                const processed = yaml.filter(line => !(line.trim().startsWith('tags:') || line.trim().startsWith('- ')));
                processed.push('tags:');
                if (allTags.length > 0) {
                    processed.push(...allTags.map(tag => `  - ${tag}`));
                }
                return processed.join('\n');
            };

            const hasFrontmatter = frontmatterRegex.test(content);

            newContent = hasFrontmatter
                ? content.replace(frontmatterRegex, (_, frontmatter) => `---\n${processFrontMatter(frontmatter)}\n---`)
                : `---\ntags:\n${yamlTags}\n---\n\n${content}`;

            await app.vault.modify(file, newContent);
            await this.waitForMetadataUpdate(app, file);
            app.workspace.trigger('file-open', file);

            const successMessage = `Added ${allTags.length} tag${allTags.length === 1 ? '' : 's'}`;
            new Notice(successMessage, 3000);

            return {
                success: true,
                message: successMessage,
                tags: allTags.map(tag => `#${tag}`)
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`Error updating tags: ${message}`, 3000);
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
    static getAllTags(app: App): string[] {
        const tags = new Set<string>();
        app.vault.getMarkdownFiles().forEach((file) => {
            const cache = app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                this.getExistingTags(cache.frontmatter).forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }
    
    /**
     * Saves all unique tags to a markdown file in the specified directory
     * @param app - Obsidian App instance
     * @param tagDir - Directory to save tags file in (default: 'tags')
     * @throws {TagError} If file operations fail
     */
    static async saveAllTags(app: App, tagDir: string = 'tags'): Promise<void> {
        try {
            const tags = this.getAllTags(app);
            const formattedTags = tags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag).join('\n');
        
            const vault = app.vault;
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const dateStr = `${year}${month}${day}`;
        
            const folderPath = tagDir;
            let folder = vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                folder = await vault.createFolder(folderPath);
            }
            
            const filePath = path.join(folderPath, `tags_${dateStr}.md`);
            let file = vault.getAbstractFileByPath(filePath);
            
            if (!file) {
                file = await vault.create(filePath, formattedTags);
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
}
