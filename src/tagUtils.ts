import { TFile, FrontMatterCache, Notice, App } from 'obsidian';

export interface TagOperationResult {
    success: boolean;
    message: string;
    tags?: string[];
}

export class TagUtils {
    /**
     * Validate tag format
     * Must start with # and contain only letters, numbers, and hyphens
     */
    static validateTag(tag: string): boolean {
        if (!tag) {
            return false;
        }
        tag = tag.trim();
        const tagRegex = /^#[\p{L}\p{N}-]+$/u;
        return tagRegex.test(tag);
    }

    /**
     * Validate multiple tags and return only valid ones
     */
    static validateTags(tags: string[]): { valid: string[], invalid: string[] } {
        const valid: string[] = [];
        const invalid: string[] = [];

        for (const tag of tags) {
            if (this.validateTag(tag)) {
                valid.push(tag);
            } else {
                invalid.push(tag);
            }
        }

        return { valid, invalid };
    }

    /**
     * Extract existing tags from note's frontmatter
     */
    static getExistingTags(frontmatter: FrontMatterCache | null): string[] {
        if (!frontmatter || !frontmatter.tags) {
            return [];
        }

        // Handle cases where tags might be a string array or a single string
        let tags: string[] = [];
        if (Array.isArray(frontmatter.tags)) {
            tags = frontmatter.tags;
        } else if (typeof frontmatter.tags === 'string') {
            tags = [frontmatter.tags];
        }

        // Validate and filter tags
        const { valid, invalid } = this.validateTags(tags);
        if (invalid.length > 0) {
            new Notice(`Invalid tags found: ${invalid.join(', ')}`);
        }

        return valid;
    }

    /**
     * Merge new and existing tags with deduplication
     */
    static mergeTags(existingTags: string[], newTags: string[]): string[] {
        const { valid: validExisting } = this.validateTags(existingTags);
        const { valid: validNew } = this.validateTags(newTags);
        
        const allTags = [...validExisting, ...validNew];
        return [...new Set(allTags)].sort();
    }

    /**
     * Format tag (ensure it starts with #)
     */
    static formatTag(tag: string): string {
        tag = tag.trim();
        const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
        
        if (!this.validateTag(formattedTag)) {
            throw new Error(`Invalid tag format: ${tag} (can only contain letters, numbers, and hyphens)`);
        }

        return formattedTag;
    }

    /**
     * Clear all tags while keeping the tags field
     */
    static async clearTags(
        app: App,
        file: TFile
    ): Promise<TagOperationResult> {
        try {
            // Read note content
            const content = await app.vault.read(file);
            
            // Check if there's a frontmatter section
            if (!content.startsWith('---\n')) {
                return {
                    success: false,
                    message: 'No frontmatter found in the note'
                };
            }

            const endOfFrontMatter = content.indexOf('---\n', 4);
            if (endOfFrontMatter === -1) {
                return {
                    success: false,
                    message: 'Invalid frontmatter format'
                };
            }

            // Parse the frontmatter section
            const frontMatter = content.slice(4, endOfFrontMatter);
            const afterFrontMatter = content.slice(endOfFrontMatter);
            
            // Get the lines before and after tags field
            const lines = frontMatter.split('\n');
            const newLines = [];
            let inTagsBlock = false;
            let tagsFound = false;

            for (const line of lines) {
                if (line.trim().startsWith('tags:')) {
                    tagsFound = true;
                    newLines.push('tags:');
                    inTagsBlock = true;
                    continue;
                }

                if (inTagsBlock) {
                    if (line.trim().startsWith('-') || line.trim().startsWith('  -')) {
                        continue; // Skip tag entries
                    } else {
                        inTagsBlock = false;
                    }
                }

                if (!inTagsBlock) {
                    newLines.push(line);
                }
            }

            // If no tags field was found, add it
            if (!tagsFound) {
                newLines.push('tags:');
            }

            // Construct new content
            const newContent = `---\n${newLines.join('\n')}${afterFrontMatter}`;

            // Save updated content and wait for it to complete
            try {
                await app.vault.modify(file, newContent);
                
                // Wait for metadata cache to update
                await new Promise<void>((resolve) => {
                    const handler = (...args: any[]) => {
                        const changedFile = args[0] as TFile;
                        if (changedFile?.path === file.path) {
                            app.metadataCache.off('changed', handler);
                            resolve();
                        }
                    };
                    app.metadataCache.on('changed', handler);
                    app.metadataCache.trigger('changed', file);
                });
                
                app.workspace.trigger('file-open', file);
            } catch (err) {
                throw new Error(`File update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }

            return {
                success: true,
                message: 'Successfully cleared all tags',
                tags: []
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            new Notice('Error clearing tags');
            return {
                success: false,
                message: `Failed to clear tags: ${errorMessage}`
            };
        }
    }

    /**
     * Update note's frontmatter
     */
    static async updateNoteTags(
        app: App,
        file: TFile,
        newTags: string[],
        matchedTags: string[]
    ): Promise<TagOperationResult> {
        try {
            // Check input arrays
            if (!Array.isArray(newTags) || !Array.isArray(matchedTags)) {
                throw new Error('Tag parameters must be arrays');
            }

            // Remove empty strings and duplicates
            newTags = [...new Set(newTags.filter(tag => tag.trim()))];
            matchedTags = [...new Set(matchedTags.filter(tag => tag.trim()))];

            // Validate all tags first
            const { valid: validNewTags, invalid: invalidNewTags } = this.validateTags(newTags);
            const { valid: validMatchedTags, invalid: invalidMatchedTags } = this.validateTags(matchedTags);

            if (validNewTags.length === 0 && validMatchedTags.length === 0) {
                return { success: true, message: 'No valid tags to add', tags: [] };
            }

            // Read note content
            const content = await app.vault.read(file);
            const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
            const frontmatterToUse = frontmatter || null;

            // Get existing tags
            const existingTags = this.getExistingTags(frontmatterToUse);
            
            // Merge all tags and remove # prefix for YAML
            const allTags = this.mergeTags(existingTags, [...validNewTags, ...validMatchedTags])
                .map(tag => tag.startsWith('#') ? tag.substring(1) : tag); // Remove # for YAML
            
            // Build new frontmatter
            let newContent = content;
            const yamlTags = allTags.map(tag => `  - ${tag}`).join('\n');

            if (content.startsWith('---\n')) {
                // Update existing frontmatter
                const endOfFrontMatter = content.indexOf('---\n', 4);
                if (endOfFrontMatter !== -1) {
                    const beforeFrontMatter = content.slice(0, endOfFrontMatter);
                    const afterFrontMatter = content.slice(endOfFrontMatter);
                    
                    // Check if frontmatter already has tags field
                    if (beforeFrontMatter.includes('\ntags:')) {
                        // Replace existing tags section
                        const tagsRegex = /\ntags:.*?(?=\n[^\s]|\n---)/s;
                        newContent = beforeFrontMatter.replace(
                            tagsRegex,
                            `\ntags:\n${yamlTags}`
                        ) + afterFrontMatter;
                    } else {
                        // Add new tags section
                        newContent = beforeFrontMatter +
                            `\ntags:\n${yamlTags}` +
                            afterFrontMatter;
                    }
                }
            } else {
                // Create new frontmatter
                newContent = `---\ntags:\n${yamlTags}\n---\n\n${content}`;
            }

            // Save updated content
            try {
                await app.vault.modify(file, newContent);
                
                // Wait for metadata cache to update
                await new Promise<void>((resolve) => {
                    const handler = (...args: any[]) => {
                        const changedFile = args[0] as TFile;
                        if (changedFile?.path === file.path) {
                            app.metadataCache.off('changed', handler);
                            resolve();
                        }
                    };
                    app.metadataCache.on('changed', handler);
                    app.metadataCache.trigger('changed', file);
                });
            } catch (err) {
                throw new Error(`File update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }

            // Reload the file to update the view
            app.workspace.trigger('file-open', file);

            return {
                success: true,
                message: `Successfully updated tags: ${validNewTags.length} new tags added, ${validMatchedTags.length} existing tags matched`,
                tags: allTags.map(tag => `#${tag}`) // Add # back for return value
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            new Notice('Error updating tags');
            return {
                success: false,
                message: `Failed to update tags: ${errorMessage}`
            };
        }
    }

    /**
     * Get all existing tags
     */
    static getAllTags(app: App): string[] {
        // Use cache to improve performance
        if (!this._tagCache) {
            this._tagCache = new Map<string, string[]>();
            this._lastCacheUpdate = 0;
        }

        const now = Date.now();
        if (!this._lastCacheUpdate || now - this._lastCacheUpdate > 300000) { // If cache is older than 5 minutes
            const tags = new Set<string>();
            app.vault.getMarkdownFiles().forEach((file) => {
                const cache = app.metadataCache.getFileCache(file);
                if (cache?.frontmatter?.tags) {
                    const fileTags = this.getExistingTags(cache.frontmatter);
                    fileTags.forEach(tag => tags.add(tag));
                    this._tagCache?.set(file.path, fileTags);
                }
            });
            this._lastCacheUpdate = now;
            return Array.from(tags).sort();
        }

        // Use cache for recently modified files
        const tags = new Set<string>();
        const recentlyModifiedFiles = app.vault.getMarkdownFiles().filter(file => 
            file.stat.mtime > this._lastCacheUpdate
        );

        // Update tags for recently modified files
        recentlyModifiedFiles.forEach((file) => {
            const cache = app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                const fileTags = this.getExistingTags(cache.frontmatter);
                fileTags.forEach(tag => tags.add(tag));
                this._tagCache?.set(file.path, fileTags);
            }
        });

        return Array.from(tags).sort();
    }

    /**
     * Reset the tag cache
     * Should be called when the plugin is unloaded or when files are deleted
     */
    static resetCache(): void {
        this._tagCache = null;
        this._lastCacheUpdate = 0;
    }

    private static _tagCache: Map<string, string[]> | null = null;
    private static _lastCacheUpdate = 0;
}