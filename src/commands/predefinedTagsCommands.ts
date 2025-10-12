import { Editor, MarkdownFileInfo, MarkdownView, Notice, TFile } from 'obsidian';
import AITaggerPlugin from '../main';
import { TagUtils } from '../utils/tagUtils';
import { TaggingMode } from '../services/prompts/tagPrompts';

export function registerPredefinedTagsCommands(plugin: AITaggerPlugin) {
    // Command to assign predefined tags for current note
    plugin.addCommand({
        id: 'assign-predefined-tags-for-current-note',
        name: plugin.t.commands.assignPredefinedTagsForCurrentNote,
        icon: 'tag',
        editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const view = ctx instanceof MarkdownView ? ctx : null;
            if (!view?.file) {
                new Notice(plugin.t.messages.noActiveFile);
                return;
            }

            if (!plugin.settings.predefinedTagsPath) {
                new Notice(plugin.t.messages.setTagsFile);
                return;
            }

            try {
                const tagsContent = await plugin.app.vault.adapter.read(plugin.settings.predefinedTagsPath);
                const predefinedTags = tagsContent.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                if (predefinedTags.length === 0) {
                    new Notice(plugin.t.messages.noTagsInFile);
                    return;
                }

                const content = await plugin.app.vault.read(view?.file);
                const analysis = await plugin.llmService.analyzeTags(content, predefinedTags, TaggingMode.PredefinedTags, plugin.settings.tagRangePredefinedMax);
                const matchedTags = analysis.matchedExistingTags || [];

                if (matchedTags.length === 0) {
                    new Notice(plugin.t.messages.noMatchingTags);
                    return;
                }

                const result = await TagUtils.updateNoteTags(plugin.app, view.file, [], matchedTags, false, true);
                plugin.handleTagUpdateResult(result);
            } catch (error) {
                // console.error('Error assigning predefined tags:', error);
                new Notice(plugin.t.messages.assignFailed);
            }
        }
    });

    // Command to assign predefined tags for current folder
    plugin.addCommand({
        id: 'assign-predefined-tags-for-current-folder',
        name: plugin.t.commands.assignPredefinedTagsForCurrentFolder,
        icon: 'tag',
        callback: async () => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice(plugin.t.messages.openNote);
                return;
            }

            const parentFolder = activeFile.parent;
            if (!parentFolder) {
                new Notice(plugin.t.messages.noParentFolder);
                return;
            }

            if (!plugin.settings.predefinedTagsPath) {
                new Notice(plugin.t.messages.setTagsFile);
                return;
            }

            const filesInFolder = plugin.getNonExcludedMarkdownFilesFromFolder(parentFolder);

            if (filesInFolder.length === 0) {
                new Notice(plugin.t.messages.noMdFiles);
                return;
            }

            try {
                const tagsContent = await plugin.app.vault.adapter.read(plugin.settings.predefinedTagsPath);
                const predefinedTags = tagsContent.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                if (predefinedTags.length === 0) {
                    new Notice(plugin.t.messages.noPredefinedTagsFound);
                    return;
                }

                const confirmed = await plugin.showConfirmationDialog(
                    `${plugin.t.messages.assignPredefinedTagsForFolderConfirm.replace('{count}', String(filesInFolder.length))}`
                );

                if (!confirmed) {
                    new Notice(plugin.t.messages.operationCancelled);
                    return;
                }

                new Notice(`${plugin.t.messages.assigningPredefinedTagsToFolder.replace('{count}', String(filesInFolder.length))}`);

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
                            new Notice(`${plugin.t.messages.progressPrefix.replace('{current}', String(processedCount)).replace('{total}', String(filesInFolder.length))}`);
                            lastNoticeTime = currentTime;
                        }
                    } catch (error) {
                        // Silent fail for batch processing
                    }
                }
                new Notice(`${plugin.t.messages.completedPrefix.replace('{success}', String(successCount)).replace('{total}', String(filesInFolder.length))}`);
            } catch (error) {
                new Notice(plugin.t.messages.failedToAssignPredefinedTagsFolder);
            }
        }
    });

    // Command to assign predefined tags for vault
    plugin.addCommand({
        id: 'assign-predefined-tags-for-vault',
        name: plugin.t.commands.assignPredefinedTagsForVault,
        icon: 'tag',
        callback: async () => {
            if (!plugin.settings.predefinedTagsPath) {
                new Notice(plugin.t.messages.setTagsFile);
                return;
            }

            const files = plugin.getNonExcludedMarkdownFiles();
            if (files.length === 0) {
                new Notice(plugin.t.messages.noMdFiles);
                return;
            }

            try {
                const tagsContent = await plugin.app.vault.adapter.read(plugin.settings.predefinedTagsPath);
                const predefinedTags = tagsContent.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                if (predefinedTags.length === 0) {
                    new Notice(plugin.t.messages.noPredefinedTagsFound);
                    return;
                }

                const confirmed = await plugin.showConfirmationDialog(
                    `${plugin.t.messages.assignPredefinedTagsForVaultConfirm.replace('{count}', String(files.length))}`
                );

                if (!confirmed) {
                    new Notice(plugin.t.messages.operationCancelled);
                    return;
                }

                new Notice(`${plugin.t.messages.assigningPredefinedTagsToVault.replace('{count}', String(files.length))}`);

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
                            new Notice(`${plugin.t.messages.progressPrefix.replace('{current}', String(processedCount)).replace('{total}', String(files.length))}`);
                            lastNoticeTime = currentTime;
                        }
                    } catch (error) {
                        // Silent fail for batch processing
                    }
                }
                new Notice(`${plugin.t.messages.completedPrefix.replace('{success}', String(successCount)).replace('{total}', String(files.length))}`);
            } catch (error) {
                new Notice(plugin.t.messages.failedToAssignPredefinedTags);
            }
        }
    });
}
