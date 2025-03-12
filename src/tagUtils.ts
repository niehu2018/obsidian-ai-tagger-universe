import { TFile, FrontMatterCache, Notice, App, TFolder } from 'obsidian';
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

export interface TagOperationResult {
    success: boolean;
    message: string;
    tags?: string[];
}

export class TagUtils {
    static validateTag(tag: string): boolean {
        if (!tag) return false;
        
        // Normalize the tag - trim and ensure it starts with #
        const normalizedTag = tag.trim();
        const tagWithHash = normalizedTag.startsWith('#') ? normalizedTag : `#${normalizedTag}`;
        
        // Check if the tag follows the pattern: # followed by letters, numbers, and hyphens
        const isValid = /^#[\p{L}\p{N}-]+$/u.test(tagWithHash);
        
        return isValid;
    }

    static validateTags(tags: string[]): { valid: string[], invalid: string[] } {
        const valid: string[] = [];
        const invalid: string[] = [];

        for (const tag of tags) {
            this.validateTag(tag) ? valid.push(tag) : invalid.push(tag);
        }

        return { valid, invalid };
    }

    static getExistingTags(frontmatter: FrontMatterCache | null): string[] {
        if (!frontmatter?.tags) return [];

        const tags = Array.isArray(frontmatter.tags) ? 
            frontmatter.tags : 
            typeof frontmatter.tags === 'string' ? 
                [frontmatter.tags] : 
                [];

        return this.validateTags(tags).valid;
    }

    static mergeTags(existingTags: string[], newTags: string[]): string[] {
        const { valid: validExisting } = this.validateTags(existingTags);
        const { valid: validNew } = this.validateTags(newTags);
        return [...new Set([...validExisting, ...validNew])].sort();
    }

    static formatTag(tag: string): string {
        const formattedTag = tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`;
        if (!this.validateTag(formattedTag)) {
            throw new Error(`Invalid tag format: ${tag} (can only contain letters, numbers, and hyphens)`);
        }
        return formattedTag;
    }

    static async clearTags(app: App, file: TFile): Promise<TagOperationResult> {
        try {
            const content = await app.vault.read(file);
            let newContent = content;
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;

            const processFrontMatter = (frontmatter: string) => {
                const yaml = frontmatter.split('\n');
                // Completely remove tags field and all tag entries
                const processed = yaml.filter(line => 
                    !line.trim().startsWith('tags:') && 
                    !line.trim().startsWith('- ')
                );
                return processed.join('\n');
            };

            if (frontmatterRegex.test(content)) {
                newContent = content.replace(frontmatterRegex, (_, frontmatter) => {
                    const processedFrontmatter = processFrontMatter(frontmatter);
                    // If frontmatter becomes empty, add a placeholder comment
                    const finalFrontmatter = processedFrontmatter.trim() ? 
                        processedFrontmatter : 
                        '# Frontmatter cleared by AI Tagger';
                    return `---\n${finalFrontmatter}\n---`;
                });
            } else {
                // If no frontmatter exists, don't add one just for tags
                newContent = content;
            }

            await app.vault.modify(file, newContent);
            await this.waitForMetadataUpdate(app, file);
            
            // Force a more thorough metadata update
            app.metadataCache.trigger('changed', file);
            app.workspace.trigger('file-open', file);
            
            return {
                success: true,
                message: 'Successfully cleared all tags',
                tags: []
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error clearing tags from ${file.path}:`, error);
            new Notice('Error clearing tags');
            return {
                success: false,
                message: `Failed to clear tags: ${message}`
            };
        }
    }

    static async updateNoteTags(
        app: App,
        file: TFile,
        newTags: string[],
        matchedTags: string[]
    ): Promise<TagOperationResult> {
        try {
            if (!Array.isArray(newTags) || !Array.isArray(matchedTags)) {
                throw new Error('Tag parameters must be arrays');
            }

            const filteredNewTags = [...new Set(newTags.filter(tag => tag.trim()))];
            const filteredMatchedTags = [...new Set(matchedTags.filter(tag => tag.trim()))];

            const { valid: validNewTags, invalid: invalidNewTags } = this.validateTags(filteredNewTags);
            const { valid: validMatchedTags } = this.validateTags(filteredMatchedTags);

            if (invalidNewTags.length > 0) {
                new Notice(`Some generated tags were invalid and will be skipped: ${invalidNewTags.join(', ')}`, 3000);
            }

            if (validNewTags.length === 0 && validMatchedTags.length === 0) {
                new Notice('No valid tags were generated or matched', 3000);
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

            new Notice(`Successfully added tags: ${allTags.map(tag => `#${tag}`).join(', ')}`, 5000);

            return {
                success: true,
                message: `Successfully updated tags: ${validNewTags.length} new tags added, ${validMatchedTags.length} existing tags matched`,
                tags: allTags.map(tag => `#${tag}`)
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice('Error updating tags');
            return {
                success: false,
                message: `Failed to update tags: ${message}`
            };
        }
    }

    private static async waitForMetadataUpdate(app: App, file: TFile): Promise<void> {
        return new Promise<void>((resolve) => {
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
    }

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

    static async saveAllTags(app: App, tagDir: string = 'tags'): Promise<void> {
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
        
        new Notice(`Tags saved to ${filePath}`);
    }
}
