import { ButtonComponent, Editor, MarkdownFileInfo, MarkdownView, Menu, Notice, TFile } from 'obsidian';
import AITaggerPlugin from './main';
import { TagUtils } from './tagUtils';
import { TaggingMode } from './services/prompts/tagPrompts';

export function registerCommands(plugin: AITaggerPlugin) {
    // Command to generate tags for current note
    plugin.addCommand({
        id: 'generate-tags-for-current-note',
        name: 'Generate tags for current note',
        icon: 'tag',
        callback: () => {
            const file = plugin.app.workspace.getActiveFile();
            if (file) {
                plugin.analyzeCurrentNote();
            } else {
                new Notice('Open a note');
            }
        }
    });

    // Command to generate tags for selected text
    plugin.addCommand({
        id: 'generate-tags-for-selection',
        name: 'Generate tags on selected text',
        icon: 'tag',
        editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const view = ctx instanceof MarkdownView ? ctx : null;
            const selectedText = editor.getSelection();
            if (!selectedText) {
                new Notice('Select text');
                return;
            }

            if (!view?.file) {
                new Notice('No file open');
                return;
            }

            const existingTags = TagUtils.getAllTags(plugin.app);
            new Notice('Analyzing...');
            
            try {
                let maxTags = plugin.settings.tagRangeGenerateMax;
                if (plugin.settings.taggingMode === TaggingMode.PredefinedTags) {
                    maxTags = plugin.settings.tagRangePredefinedMax;
                } else if (plugin.settings.taggingMode === TaggingMode.ExistingTags) {
                    maxTags = plugin.settings.tagRangeMatchMax;
                } else if (plugin.settings.taggingMode === TaggingMode.HybridGenerateExisting ||
                           plugin.settings.taggingMode === TaggingMode.HybridGeneratePredefined) {
                    maxTags = plugin.settings.tagRangeMatchMax + plugin.settings.tagRangeGenerateMax;
                }
                // Only pass language parameter for GenerateNew mode or hybrid modes that include generation
                let analysis;
                if (plugin.settings.taggingMode === TaggingMode.GenerateNew || 
                    plugin.settings.taggingMode === TaggingMode.HybridGenerateExisting ||
                    plugin.settings.taggingMode === TaggingMode.HybridGeneratePredefined) {
                    analysis = await plugin.llmService.analyzeTags(selectedText, existingTags, plugin.settings.taggingMode, maxTags, plugin.settings.language);
                } else {
                    analysis = await plugin.llmService.analyzeTags(selectedText, existingTags, plugin.settings.taggingMode, maxTags);
                }
                const suggestedTags = analysis.suggestedTags;
                const matchedTags = analysis.matchedExistingTags;
                
                // Update frontmatter tags
                const result = await TagUtils.updateNoteTags(plugin.app, view?.file, suggestedTags, matchedTags);
                
                if (result.success) {
                    editor.replaceSelection(selectedText);
                    new Notice('Tags added');
                } else {
                    new Notice('Failed to update tags');
                }
            } catch (error) {
                console.error('Error generating tags:', error);
                new Notice('Failed to generate tags');
            }
        }
    });

    // Register file menu items for batch tagging
    plugin.registerEvent(
        // @ts-ignore - File menu event is not properly typed in Obsidian API
        plugin.app.workspace.on('file-menu', (menu: Menu, file: TFile, source: string, files?: TFile[]) => {
            if (files && files.length > 0) {
                // Multiple files selected
                const markdownFiles = files.filter(f => f.extension === 'md');
                if (markdownFiles.length > 0) {
                    menu.addItem((item) => {
                        item
                            .setTitle(`AI tag ${markdownFiles.length} selected notes`)
                            .setIcon('tag')
                            .onClick(async () => {
                                // Show confirmation dialog
                                const confirmed = await plugin.showConfirmationDialog(
                                    `This will generate tags for ${markdownFiles.length} selected notes. This may take some time.`
                                );
                                
                                if (!confirmed) {
                                    new Notice('Operation cancelled');
                                    return;
                                }
                                
                                await plugin.analyzeAndTagFiles(markdownFiles);
                            });
                    });
                }
            } else if (file.extension === 'md') {
                // Single file selected
                menu.addItem((item) => {
                    item
                        .setTitle('AI tag this note')
                        .setIcon('tag')
                        .onClick(() => plugin.analyzeAndTagFiles([file]));
                });
            }
        })
    );

    // Command to tag all notes in vault
    plugin.addCommand({
        id: 'tag-all-notes',
        name: 'Generate tags for all notes in vault',
        icon: 'tag',
        callback: async () => {
            const files = plugin.app.vault.getMarkdownFiles();
            if (files.length === 0) {
                new Notice('No md files');
                return;
            }
            
            // Show confirmation dialog
            const confirmed = await plugin.showConfirmationDialog(
                `This will generate tags for ${files.length} notes in your vault. This may take a long time.`
            );
            
            if (!confirmed) {
                new Notice('Operation cancelled');
                return;
            }
            
            await plugin.analyzeAndTagFiles(files);
        }
    });

    // Command to generate tags for all notes in current folder
    plugin.addCommand({
        id: 'tag-current-folder-notes',
        name: 'Generate tags for all notes in current folder',
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

            // Get all markdown files in the current folder
            const filesInFolder = parentFolder.children
                .filter((file): file is TFile => file instanceof TFile && file.extension === 'md');

            if (filesInFolder.length === 0) {
                new Notice('No md files');
                return;
            }

            // Show confirmation dialog
            const confirmed = await plugin.showConfirmationDialog(
                `This will generate tags for ${filesInFolder.length} notes in the current folder. This may take some time.`
            );
            
            if (!confirmed) {
                new Notice('Operation cancelled');
                return;
            }

            await plugin.analyzeAndTagFiles(filesInFolder);
        }
    });

    // Command to clear tags in current note
    plugin.addCommand({
        id: 'clear-all-tags',
        name: 'Clear all tags in current note',
        icon: 'eraser',
        editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const view = ctx instanceof MarkdownView ? ctx : null;
            if (view?.file) {
                plugin.clearNoteTags();
            } else {
                new Notice('Please open a note first');
            }
        }
    });

    // Command to clear tags in all notes
    plugin.addCommand({
        id: 'clear-all-notes-tags',
        name: 'Clear all tags in all vault',
        icon: 'eraser',
        callback: async () => {
            await plugin.clearAllNotesTags();
        }
    });

    // Command to clear tags in current directory
    plugin.addCommand({
        id: 'clear-current-directory-tags',
        name: 'Clear all tags in all notes in current directory',
        icon: 'eraser',
        callback: async () => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('Please open a note first');
                return;
            }

            const parentFolder = activeFile.parent;
            if (!parentFolder) {
                new Notice('Could not determine parent folder');
                return;
            }

            const filesInFolder = parentFolder.children
                .filter((file: any): file is TFile => file instanceof TFile && file.extension === 'md');

            if (filesInFolder.length === 0) {
                new Notice('No markdown files found in current folder');
                return;
            }

            // Show confirmation dialog
            const confirmed = await plugin.showConfirmationDialog(
                `This will remove all tags from ${filesInFolder.length} notes in the current folder. This action cannot be undone.`
            );
            
            if (!confirmed) {
                new Notice('Operation cancelled');
                return;
            }

            new Notice(`Clearing tags from ${filesInFolder.length} notes in the current folder...`);
            
            let count = 0;
            let processedCount = 0;
            const totalFiles = filesInFolder.length;
            let lastNoticeTime = Date.now();

            for (const file of filesInFolder) {
                try {
                    const result = await TagUtils.clearTags(plugin.app, file);
                    if (result.success) {
                        count++;
                        plugin.app.vault.trigger('modify', file);
                    }
                } catch (error) {
                    console.error(`Error clearing tags from ${file.path}:`, error);
                }
                
                processedCount++;
                const currentTime = Date.now();
                if (currentTime - lastNoticeTime >= 15000 || processedCount === totalFiles) {
                    new Notice(`Progress: ${processedCount}/${totalFiles} files processed`);
                    lastNoticeTime = currentTime;
                }
            }
            new Notice(`Cleared ${count} notes`);
        }
    });

    // Command to assign predefined tags
    plugin.addCommand({
        id: 'assign-predefined-tags',
        name: 'Assign pre-defined tags for current note',
        icon: 'tag',
        editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const view = ctx instanceof MarkdownView ? ctx : null;
            if (!view?.file) {
                new Notice('Open a note');
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
                const matchedTags = analysis.matchedExistingTags;
                
                if (matchedTags.length === 0) {
                    new Notice('No matching tags');
                    return;
                }

                const result = await TagUtils.updateNoteTags(plugin.app, view?.file, [], matchedTags);
                plugin.handleTagUpdateResult(result);
            } catch (error) {
                console.error('Error assigning predefined tags:', error);
                new Notice('Assign failed');
            }
        }
    });

    // Command to assign predefined tags to all notes
    plugin.addCommand({
        id: 'assign-predefined-tags-all-notes',
        name: 'Assign pre-defined tags for all notes in vault',
        icon: 'tag',
        callback: async () => {
            if (!plugin.settings.predefinedTagsPath) {
                new Notice('Set tags file');
                return;
            }

            const files = plugin.app.vault.getMarkdownFiles();
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
                
                // Show confirmation dialog
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
                        const matchedTags = analysis.matchedExistingTags;
                        
                        const result = await TagUtils.updateNoteTags(plugin.app, file, [], matchedTags);
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

    // Command to assign predefined tags to all notes in current folder
    plugin.addCommand({
        id: 'assign-predefined-tags-current-folder',
        name: 'Assign pre-defined tags for all notes in current folder',
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

            // Get all markdown files in the current folder
            const filesInFolder = parentFolder.children
                .filter((file): file is TFile => file instanceof TFile && file.extension === 'md');

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
                
                // Show confirmation dialog
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
                        const matchedTags = analysis.matchedExistingTags;
                        
                        const result = await TagUtils.updateNoteTags(plugin.app, file, [], matchedTags);
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

    // Command to collect all tags from vault
    plugin.addCommand({
        id: 'collect-all-tags',
        name: 'Collect all tags from all notes in vault',
        icon: 'tags',
        callback: async () => {
            await TagUtils.saveAllTags(plugin.app, plugin.settings.tagDir);
        }
    });
    
    // Command to show tag network visualization
    plugin.addCommand({
        id: 'show-tag-network',
        name: 'Show tag network visualization',
        icon: 'graph',
        callback: async () => {
            await plugin.showTagNetwork();
        }
    });
}
