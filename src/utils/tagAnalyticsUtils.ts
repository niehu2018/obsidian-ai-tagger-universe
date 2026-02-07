import { App, TFile } from 'obsidian';
import { TagUtils } from './tagUtils';

export interface TagStats {
    name: string;
    frequency: number;
    status: 'healthy' | 'low-use' | 'orphaned';
    notes: string[];
}

export interface AnalyticsData {
    totalUniqueTags: number;
    totalTaggedNotes: number;
    totalUntaggedNotes: number;
    averageTagsPerNote: number;
    orphanedTagsCount: number;
    tags: TagStats[];
    untaggedNotes: string[];
    generatedAt: Date;
}

export class TagAnalyticsManager {
    private app: App;
    private analyticsData: AnalyticsData | null = null;

    constructor(app: App) {
        this.app = app;
    }

    async buildAnalytics(files?: TFile[]): Promise<void> {
        const markdownFiles = files || this.app.vault.getMarkdownFiles();
        const tagMap = new Map<string, string[]>();
        const untaggedNotes: string[] = [];
        let totalTagsAcrossNotes = 0;

        for (const file of markdownFiles) {
            const cache = this.app.metadataCache.getFileCache(file);
            const tags = cache?.frontmatter ? TagUtils.getExistingTags(cache.frontmatter) : [];

            if (tags.length === 0) {
                untaggedNotes.push(file.path);
            } else {
                totalTagsAcrossNotes += tags.length;
                for (const tag of tags) {
                    const normalizedTag = tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase();
                    if (!tagMap.has(normalizedTag)) {
                        tagMap.set(normalizedTag, []);
                    }
                    tagMap.get(normalizedTag)!.push(file.path);
                }
            }
        }

        const tags: TagStats[] = [];
        for (const [name, notes] of tagMap) {
            const frequency = notes.length;
            let status: 'healthy' | 'low-use' | 'orphaned';
            if (frequency >= 3) {
                status = 'healthy';
            } else if (frequency === 2) {
                status = 'low-use';
            } else {
                status = 'orphaned';
            }
            tags.push({ name, frequency, status, notes });
        }

        // Sort by frequency descending
        tags.sort((a, b) => b.frequency - a.frequency);

        const totalTaggedNotes = markdownFiles.length - untaggedNotes.length;
        const averageTagsPerNote = totalTaggedNotes > 0
            ? Math.round((totalTagsAcrossNotes / totalTaggedNotes) * 10) / 10
            : 0;

        this.analyticsData = {
            totalUniqueTags: tags.length,
            totalTaggedNotes,
            totalUntaggedNotes: untaggedNotes.length,
            averageTagsPerNote,
            orphanedTagsCount: tags.filter(t => t.status === 'orphaned').length,
            tags,
            untaggedNotes,
            generatedAt: new Date()
        };
    }

    getAnalyticsData(): AnalyticsData {
        return this.analyticsData || {
            totalUniqueTags: 0,
            totalTaggedNotes: 0,
            totalUntaggedNotes: 0,
            averageTagsPerNote: 0,
            orphanedTagsCount: 0,
            tags: [],
            untaggedNotes: [],
            generatedAt: new Date()
        };
    }

    getNotesWithTag(tagName: string): string[] {
        if (!this.analyticsData) return [];
        const tag = this.analyticsData.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        return tag ? tag.notes : [];
    }

    exportToCSV(): string {
        if (!this.analyticsData) return '';

        const headers = ['Tag Name', 'Frequency', 'Status', 'Notes'];
        const rows = this.analyticsData.tags.map(tag => [
            tag.name,
            String(tag.frequency),
            tag.status,
            tag.notes.join('; ')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        return csvContent;
    }
}
