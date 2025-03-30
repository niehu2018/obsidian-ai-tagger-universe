import { App, TFile, Notice } from 'obsidian';

export interface TagOperationResult {
    success: boolean;
    message: string;
    tags?: string[];
}

export class TagUtils {
    static async updateNoteTags(
        app: App,
        file: TFile,
        newTags: string[],
        matchedTags: string[],
        silent: boolean = false
    ): Promise<TagOperationResult> {
        return {
            success: true,
            message: 'Tags updated',
            tags: [...newTags, ...matchedTags]
        };
    }
    
    static getAllTags(app: App): string[] {
        return [];
    }
} 