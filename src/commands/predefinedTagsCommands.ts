import { Editor, MarkdownFileInfo, MarkdownView, Notice, TFile } from 'obsidian';
import AITaggerPlugin from '../main';
import { TagUtils } from '../utils/tagUtils';
import { TaggingMode } from '../services/prompts/tagPrompts';

export function registerPredefinedTagsCommands(plugin: AITaggerPlugin) {
    // Command to assign predefined tags for current note
    plugin.addCommand({
        id: 'assign-predefined-tags-for-current-note',
        name: 'Assign predefined tags for current note',
        icon: 'tag',
        editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const view = ctx instanceof MarkdownView ? ctx : null;
            if (!view?.file) {
                new Notice('No active file');
                return;
            }

            if (!plugin.settings.predefinedTagsPath) {
                new Notice('Set tags file');
                return;
            }

            try {
                const tagsContent = await plugin.app.vault.adapter.read(plugin.settings.predefinedTagsPath);
                const predefinedTags = tagsContent.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                if (predefinedTags.length === 0) {
                    new Notice('No tags in file');
                    return;
                }

                const content = await plugin.app.vault.read(view?.file);
                const analysis = await plugin.llmService.analyzeTags(content, predefinedTags, TaggingMode.PredefinedTags, plugin.settings.tagRangePredefinedMax);
                const matchedTags = analysis.matchedExistingTags || [];
                
                if (matchedTags.length === 0) {
                    new Notice('No matching tags');
                    return;
                }

                const result = await TagUtils.updateNoteTags(plugin.app, view.file, [], matchedTags, false, true);
                plugin.handleTagUpdateResult(result);
            } catch (error) {
                // console.error('Error assigning predefined tags:', error);
                new Notice('Assign failed');
            }
        }
    });

    // Command to assign predefined tags for current folder
    plugin.addCommand({
        id: 'assign-predefined-tags-for-current-folder',
        name: 'Assign predefined tags for current folder',
        icon: 'tag',
        callback: async () => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('Open a note');
                return;
            }

            const parentFolder = activeFile.parent;
            if (!parentFolder) {
                new Notice('No parent folder');
                return;
            }

            if (!plugin.settings.predefinedTagsPath) {
                new Notice('Set tags file');
                return;
            }

            const filesInFolder = plugin.getNonExcludedMarkdownFilesFromFolder(parentFolder);

            if (filesInFolder.length === 0) {
                new Notice('No md files');
                return;
            }

            try {
                const tagsContent = await plugin.app.vault.adapter.read(plugin.settings.predefinedTagsPath);
                const predefinedTags = tagsContent.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                if (predefinedTags.length === 0) {
                    new Notice('No predefined tags found in the file');
                    return;
                }
                
                const confirmed = await plugin.showConfirmationDialog(
                    `This will assign predefined tags to ${filesInFolder.length} notes in the current folder. This may take some time.`
                );
                
                if (!confirmed) {
                    new Notice('Operation cancelled');
                    return;
                }

                new Notice(`Assigning predefined tags to ${filesInFolder.length} notes in the current folder...`);
                
                let processedCount = 0;
                let successCount = 0;
                let lastNoticeTime = Date.now();

                for (const file of filesInFolder) {
                    try {
                        const content = await plugin.app.vault.read(file);
                        if (!content.trim()) continue;

                        const analysis = await plugin.llmService.analyzeTags(content, predefinedTags, TaggingMode.PredefinedTags, plugin.settings.tagRangePredefinedMax);
                        const matchedTags = analysis.matchedExistingTags || [];
                        
                        const result = await TagUtils.updateNoteTags(plugin.app, file, [], matchedTags, false, true);
                        if (result.success) {
                            successCount++;
                        }
                        
                        processedCount++;
                        const currentTime = Date.now();
                        if (currentTime - lastNoticeTime >= 15000 || processedCount === filesInFolder.length) {
                            new Notice(`Progress: ${processedCount}/${filesInFolder.length}`);
                            lastNoticeTime = currentTime;
                        }
                    } catch (error) {
                        // Silent fail for batch processing
                    }
                }
                new Notice(`Completed: ${successCount}/${filesInFolder.length}`);
            } catch (error) {
                new Notice('Failed to assign predefined tags to notes in current folder');
            }
        }
    });

    // Command to assign predefined tags for vault
    plugin.addCommand({
        id: 'assign-predefined-tags-for-vault',
        name: 'Assign predefined tags for vault',
        icon: 'tag',
        callback: async () => {
            if (!plugin.settings.predefinedTagsPath) {
                new Notice('Set tags file');
                return;
            }

            const files = plugin.getNonExcludedMarkdownFiles();
            if (files.length === 0) {
                new Notice('No md files');
                return;
            }

            try {
                const tagsContent = await plugin.app.vault.adapter.read(plugin.settings.predefinedTagsPath);
                const predefinedTags = tagsContent.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                if (predefinedTags.length === 0) {
                    new Notice('No predefined tags found in the file');
                    return;
                }
                
                const confirmed = await plugin.showConfirmationDialog(
                    `This will assign predefined tags to ${files.length} notes in your vault. This may take a long time.`
                );
                
                if (!confirmed) {
                    new Notice('Operation cancelled');
                    return;
                }

                new Notice(`Assigning predefined tags to ${files.length} notes in your vault...`);
                
                let processedCount = 0;
                let successCount = 0;
                let lastNoticeTime = Date.now();

                for (const file of files) {
                    try {
                        const content = await plugin.app.vault.read(file);
                        if (!content.trim()) continue;

                        const analysis = await plugin.llmService.analyzeTags(content, predefinedTags, TaggingMode.PredefinedTags, plugin.settings.tagRangePredefinedMax);
                        const matchedTags = analysis.matchedExistingTags || [];
                        
                        const result = await TagUtils.updateNoteTags(plugin.app, file, [], matchedTags, false, true);
                        if (result.success) {
                            successCount++;
                        }
                        
                        processedCount++;
                        const currentTime = Date.now();
                        if (currentTime - lastNoticeTime >= 15000 || processedCount === files.length) {
                            new Notice(`Progress: ${processedCount}/${files.length}`);
                            lastNoticeTime = currentTime;
                        }
                    } catch (error) {
                        // Silent fail for batch processing
                    }
                }
                new Notice(`Completed: ${successCount}/${files.length}`);
            } catch (error) {
                new Notice('Failed to assign predefined tags to notes');
            }
        }
    });
}
