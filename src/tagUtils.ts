import { TFile, FrontMatterCache, Notice, App } from 'obsidian';

export interface TagOperationResult {
    success: boolean;
    message: string;
    tags?: string[];
}

export class TagUtils {
    static validateTag(tag: string): boolean {
        if (!tag) return false;
        return /^#?[\p{L}\p{N}-]+$/u.test(tag.trim());
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

            await app.vault.modify(file, newContent);
            await this.waitForMetadataUpdate(app, file);
            app.workspace.trigger('file-open', file);
            
            return {
                success: true,
                message: 'Successfully cleared all tags',
                tags: []
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
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

            newContent = frontmatterRegex.test(content)
                ? content.replace(frontmatterRegex, (_, frontmatter) => `---\n${processFrontMatter(frontmatter)}\n---`)
                : `---\ntags:\n${yamlTags}\n---\n\n${content}`;

            await app.vault.modify(file, newContent);
            await this.waitForMetadataUpdate(app, file);
            app.workspace.trigger('file-open', file);

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

    static resetCache(): void {
        // Empty implementation for future cache management
    }
}
