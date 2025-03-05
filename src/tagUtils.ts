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
        const tagRegex = /^#?[\p{L}\p{N}/\u4e00-\u9fff-]+$/u;
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
        //if (invalid.length > 0) {
        //    console.debug(`Invalid tags found: ${invalid.join(', ')}`);
        //}

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
            
            // Process frontmatter
            let newContent = content;
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;

            const processFrontMatter = (frontmatter: string) => {
                const yaml = frontmatter.split('\n');
                const processed = yaml.filter(line => !line.trim().startsWith('- '));
                if (!processed.some(line => line.trim().startsWith('tags:'))) {
                    processed.push('tags:');
                }
                return processed.join('\n');
            };

            if (frontmatterRegex.test(content)) {
                newContent = content.replace(frontmatterRegex, (_, frontmatter) => {
                    return `---\n${processFrontMatter(frontmatter)}\n---`;
                });
            } else {
                newContent = `---\ntags:\n---\n\n${content}`;
            }

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
            const { valid: validMatchedTags } = this.validateTags(matchedTags);

            // Show invalid tags notice only once
            if (invalidNewTags.length > 0) {
                new Notice(
                    `Some generated tags were invalid and will be skipped: ${invalidNewTags.join(', ')}`, 
                    3000
                );
            }

            if (validNewTags.length === 0 && validMatchedTags.length === 0) {
                return { success: true, message: 'No valid tags to add', tags: [] };
            }

            // Read note content
            const content = await app.vault.read(file);
            
            // Get existing tags and prepare all tags
            const cache = app.metadataCache.getFileCache(file);
            const existingTags = this.getExistingTags(cache?.frontmatter || null);
            const allTags = this.mergeTags(existingTags, [...validNewTags, ...validMatchedTags])
                .map(tag => tag.startsWith('#') ? tag.substring(1) : tag);

            // Process frontmatter
            let newContent = content;
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const yamlTags = allTags.map(tag => `  - ${tag}`).join('\n');

            const processFrontMatter = (frontmatter: string) => {
                const yaml = frontmatter.split('\n');
                const processed = yaml.filter(line => !(
                    line.trim().startsWith('tags:') ||
                    line.trim().startsWith('- ')
                ));
                processed.push('tags:');
                if (allTags.length > 0) {
                    processed.push(...allTags.map(tag => `  - ${tag}`));
                }
                return processed.join('\n');
            };

            if (frontmatterRegex.test(content)) {
                newContent = content.replace(frontmatterRegex, (_, frontmatter) => {
                    return `---\n${processFrontMatter(frontmatter)}\n---`;
                });
            } else {
                newContent = `---\ntags:\n${yamlTags}\n---\n\n${content}`;
            }

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
        const tags = new Set<string>();
        
        app.vault.getMarkdownFiles().forEach((file) => {
            const cache = app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                const fileTags = this.getExistingTags(cache.frontmatter);
                fileTags.forEach(tag => tags.add(tag));
            }
        });
        
        return Array.from(tags).sort();
    }

    /**
     * Reset any internal caches (currently a no-op as no caching is implemented)
     */
    static resetCache(): void {
        // No-op for now as we don't have any caching implemented
    }
}