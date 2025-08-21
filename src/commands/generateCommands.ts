import { Editor, MarkdownFileInfo, MarkdownView, Menu, Notice, TFile } from 'obsidian';
import type AITaggerPlugin from '../main';
import { TagUtils } from '../utils/tagUtils';
import { TaggingMode } from '../services/prompts/types';

export function registerGenerateCommands(plugin: AITaggerPlugin) {
    // Command to generate tags for current note (with selection support)
    plugin.addCommand({
        id: 'generate-tags-for-current-note',
        name: 'Generate tags for current note',
        icon: 'tag',
        editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const view = ctx instanceof MarkdownView ? ctx : null;
            if (!view?.file) {
                new Notice('Open a note');
                return;
            }

            const selectedText = editor.getSelection();
            const content = selectedText || await plugin.app.vault.read(view.file);
            
            if (!content.trim()) {
                new Notice('No content to analyze');
                return;
            }

            const existingTags = TagUtils.getAllTags(plugin.app);
            new Notice('Analyzing...');
            
            try {
                let maxTags = plugin.settings.tagRangeGenerateMax;
                if (plugin.settings.taggingMode === TaggingMode.PredefinedTags) {
                    maxTags = plugin.settings.tagRangePredefinedMax;
                } else if (plugin.settings.taggingMode === TaggingMode.Hybrid) {
                    maxTags = plugin.settings.tagRangePredefinedMax + plugin.settings.tagRangeGenerateMax;
                }

                const analysis = await plugin.llmService.analyzeTags(
                    content, 
                    existingTags, 
                    plugin.settings.taggingMode, 
                    maxTags, 
                    plugin.settings.language
                );
                
                const suggestedTags = analysis.suggestedTags;
                const matchedTags = analysis.matchedExistingTags || [];
                
                const result = await TagUtils.updateNoteTags(plugin.app, view.file, suggestedTags, matchedTags, true, true);
                
                if (selectedText && result.success) {
                    editor.replaceSelection(selectedText);
                }
                plugin.handleTagUpdateResult(result);
            } catch (error) {
                // console.error('Error generating tags:', error);
                new Notice('Failed to generate tags');
            }
        }
    });

    // Command to generate tags for current folder
    plugin.addCommand({
        id: 'generate-tags-for-current-folder',
        name: 'Generate tags for current folder',
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

            const filesInFolder = plugin.getNonExcludedMarkdownFilesFromFolder(parentFolder);

            if (filesInFolder.length === 0) {
                new Notice('No md files');
                return;
            }

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

    // Command to generate tags for vault
    plugin.addCommand({
        id: 'generate-tags-for-vault',
        name: 'Generate tags for vault',
        icon: 'tag',
        callback: async () => {
            const files = plugin.getNonExcludedMarkdownFiles();
            if (files.length === 0) {
                new Notice('No md files');
                return;
            }
            
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
}
