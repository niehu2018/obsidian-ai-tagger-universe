import { Plugin, Notice, TFile, App, MarkdownView, Modal } from 'obsidian';
import { LLMService, LocalLLMService, CloudLLMService, ConnectionTestResult, LLMServiceConfig } from './services';
import { TagUtils, TagOperationResult } from './tagUtils';
import { TaggingMode } from './services/prompts/tagPrompts';
import { registerCommands } from './commands';
import { AITaggerSettings, DEFAULT_SETTINGS } from './settings';
import { AITaggerSettingTab } from './AITaggerSettingTab';
import { EventHandlers } from './eventHandlers';
import { TagNetworkManager, TagNetworkView } from './tagNetwork';

export default class AITaggerPlugin extends Plugin {
    settings: AITaggerSettings = DEFAULT_SETTINGS;
    llmService: LLMService;
    private eventHandlers: EventHandlers;
    private tagNetworkManager: TagNetworkManager;

    constructor(app: App, manifest: Plugin["manifest"]) {
        super(app, manifest);
        this.llmService = new LocalLLMService({
            endpoint: DEFAULT_SETTINGS.localEndpoint,
            modelName: DEFAULT_SETTINGS.localModel,
            language: DEFAULT_SETTINGS.language
        });
        this.eventHandlers = new EventHandlers(app);
        this.tagNetworkManager = new TagNetworkManager(app);
    }

    async loadSettings() {
        const oldSettings = await this.loadData();
        
        if (oldSettings && oldSettings.serviceType === 'ollama') {
            oldSettings.serviceType = 'local';
            oldSettings.localEndpoint = oldSettings.ollamaEndpoint;
            oldSettings.localModel = oldSettings.ollamaModel;
            delete oldSettings.ollamaEndpoint;
            delete oldSettings.ollamaModel;
        }

        this.settings = Object.assign({}, DEFAULT_SETTINGS, oldSettings);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.initializeLLMService();
    }

    private initializeLLMService() {
        this.llmService?.dispose();

        if (this.settings.serviceType === 'local') {
            const localConfig: LLMServiceConfig = {
                endpoint: this.settings.localEndpoint,
                modelName: this.settings.localModel,
                language: this.settings.language
            };
            this.llmService = new LocalLLMService(localConfig);
        } else {
            const cloudConfig = {
                endpoint: this.settings.cloudEndpoint,
                apiKey: this.settings.cloudApiKey,
                modelName: this.settings.cloudModel,
                type: this.settings.cloudServiceType,
                language: this.settings.language
            };
            this.llmService = new CloudLLMService(cloudConfig);
        }
    }

    async onload() {
        await this.loadSettings();
        this.initializeLLMService();
        this.eventHandlers.registerEventHandlers();
        this.addSettingTab(new AITaggerSettingTab(this.app, this));
        registerCommands(this);

        this.addRibbonIcon('tags', 'AI Tagger Universe', () => this.analyzeCurrentNote());
        this.addRibbonIcon('graph', 'Show tag network', () => this.showTagNetwork());
    }

    async onunload() {
        if (this.llmService) {
            await this.llmService.dispose();
        }
        this.eventHandlers.cleanup();
        this.app.workspace.trigger('layout-change');
    }
    
    async showTagNetwork() {
        new Notice('Building tag network...');
        try {
            await this.tagNetworkManager.buildTagNetwork();
            const networkData = this.tagNetworkManager.getNetworkData();
            
            if (networkData.nodes.length === 0) {
                new Notice('No tags found in your vault. Add some tags first!', 5000);
                return;
            }
            
            if (networkData.edges.length === 0) {
                new Notice('Tags found, but no connections between them. Add more notes with multiple tags.', 5000);
            }
            
            new TagNetworkView(this.app, networkData).open();
        } catch (error) {
            new Notice('Error building tag network', 5000);
        }
    }

    async testConnection(): Promise<{ result: ConnectionTestResult; error?: any }> {
        return this.llmService.testConnection();
    }

    // Confirmation modal for clearing all tags
    async showConfirmationDialog(message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.containerEl.addClass('ai-tagger-confirm-modal');
            
            // Create header with warning icon
            const headerEl = modal.contentEl.createEl('div', {
                cls: 'ai-tagger-modal-header'
            });
            
            const iconSpan = headerEl.createSpan({
                text: '⚠️ ',
                cls: 'ai-tagger-warning-icon'
            });
            
            headerEl.createSpan({
                text: 'Warning: Time-consuming Operation',
                cls: 'ai-tagger-title-text'
            });
            
            // Create message content
            const contentEl = modal.contentEl.createEl('div', {
                text: message,
                cls: 'ai-tagger-modal-content'
            });
            
            // Create button container
            const buttonContainer = modal.contentEl.createDiv({
                cls: 'ai-tagger-button-container'
            });
            
            // Create Cancel button
            const cancelButton = buttonContainer.createEl('button', { 
                text: 'Cancel',
                cls: 'ai-tagger-cancel-button'
            });
            
            cancelButton.addEventListener('click', () => {
                modal.close();
                resolve(false);
            });
            
            // Create Confirm button
            const confirmButton = buttonContainer.createEl('button', { 
                text: 'Confirm',
                cls: 'ai-tagger-confirm-button'
            });
            
            confirmButton.addEventListener('click', () => {
                modal.close();
                resolve(true);
            });
            
            modal.open();
        });
    }

    async clearAllNotesTags() {
        const markdownFiles = this.app.vault.getMarkdownFiles();
        const confirmed = await this.showConfirmationDialog(
            `This will remove all tags from ${markdownFiles.length} notes in your vault. This action cannot be undone.`
        );
        
        if (!confirmed) {
            new Notice('Operation cancelled');
            return;
        }

        new Notice('Starting to clear tags from all notes...');
        let count = 0;
        let processedCount = 0;
        const totalFiles = markdownFiles.length;
        let lastNoticeTime = Date.now();
        
        for (const file of markdownFiles) {
            try {
                const result = await TagUtils.clearTags(this.app, file);
                if (result.success) {
                    count++;
                    this.app.vault.trigger('modify', file);
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

        new Notice('Refreshing metadata cache...');
        try {
            this.app.workspace.trigger('layout-change');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            for (const file of markdownFiles) {
                this.app.metadataCache.trigger('changed', file);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            new Notice(`Successfully cleared tags from ${count} notes and refreshed metadata cache`);
        } catch (error) {
            new Notice(`Successfully cleared tags from ${count} notes, but metadata refresh failed`);
        }
    }

    async clearNoteTags() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('Please open a note first');
            return;
        }

        try {
            const result = await TagUtils.clearTags(this.app, activeFile);
            if (result.success) {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view?.getMode() === 'source') {
                    view.editor.refresh();
                }
                
                new Notice('Successfully cleared all tags');
                this.app.vault.trigger('modify', activeFile);
            } else {
                new Notice(result.message);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`Error clearing tags: ${message}`);
        }
    }

    handleTagUpdateResult(result: TagOperationResult, silent: boolean = false): void {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (result.success && view?.getMode() === 'source') {
            view.editor.refresh();
        }
        if (!silent) {
            new Notice(result.success ? result.message : 'Failed to update tags');
        }
    }

    async analyzeAndTagFiles(files: TFile[]): Promise<void> {
        if (files.length === 0) return;

        const totalFiles = files.length;
        new Notice(`Analyzing and modifying tags in ${totalFiles} file${totalFiles > 1 ? 's' : ''} in your vault...`);

        new Notice(`Starting to analyze ${totalFiles} file${totalFiles > 1 ? 's' : ''}...`);
        let processedCount = 0;
        let successCount = 0;
        let lastNoticeTime = Date.now();

        if (this.settings.taggingMode === TaggingMode.PredefinedTags) {
            if (!this.settings.predefinedTagsPath) {
                new Notice('Predefined tags mode requires a tags file. Please set the predefined tags file path in settings.', 5000);
                return;
            }
            
            try {
                const tagsContent = await this.app.vault.adapter.read(this.settings.predefinedTagsPath);
                const predefinedTags = tagsContent.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0);

                if (predefinedTags.length === 0) {
                    new Notice('No predefined tags found in the file. Please add tags to your predefined tags file.', 5000);
                    return;
                }
                
                for (const file of files) {
                    try {
                        const content = await this.app.vault.read(file);
                        if (!content.trim()) continue;
                        
                        const analysis = await this.llmService.analyzeTags(
                            content, 
                            predefinedTags, 
                            TaggingMode.PredefinedTags, 
                            this.settings.tagRangePredefinedMax
                        );
                        
                        if (!analysis?.matchedExistingTags?.length) continue;
                        
                        const result = await TagUtils.updateNoteTags(
                            this.app,
                            file,
                            [],
                            analysis.matchedExistingTags
                        );

                        if (result.success) {
                            successCount++;
                        }
                        
                        this.handleTagUpdateResult(result, true);
                        processedCount++;
                        
                        const currentTime = Date.now();
                        if (currentTime - lastNoticeTime >= 15000 || processedCount === totalFiles) {
                            new Notice(`Progress: ${processedCount}/${totalFiles} files processed`);
                            lastNoticeTime = currentTime;
                        }
                    } catch (error) {
                        new Notice(`Error processing ${file.path}`);
                    }
                }
                
                new Notice(`Completed! Successfully tagged ${successCount} out of ${totalFiles} files`);
                return;
            } catch (error) {
                new Notice(`Error reading predefined tags file: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
                return;
            }
        }
        
        const existingTags = TagUtils.getAllTags(this.app);

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                if (!content.trim()) continue;

                const maxTags = (() => {
                    switch (this.settings.taggingMode) {
                        case TaggingMode.ExistingTags:
                            return this.settings.tagRangeMatchMax;
                        case TaggingMode.HybridGenerateExisting:
                        case TaggingMode.HybridGeneratePredefined:
                            return this.settings.tagRangeMatchMax + this.settings.tagRangeGenerateMax;
                        case TaggingMode.GenerateNew:
                        default:
                            return this.settings.tagRangeGenerateMax;
                    }
                })();
                
                // Only pass language parameter for GenerateNew mode or hybrid modes that include generation
                let analysis;
                if (this.settings.taggingMode === TaggingMode.GenerateNew || 
                    this.settings.taggingMode === TaggingMode.HybridGenerateExisting ||
                    this.settings.taggingMode === TaggingMode.HybridGeneratePredefined) {
                    analysis = await this.llmService.analyzeTags(
                        content, 
                        existingTags, 
                        this.settings.taggingMode, 
                        maxTags, 
                        this.settings.language
                    );
                } else {
                    analysis = await this.llmService.analyzeTags(
                        content, 
                        existingTags, 
                        this.settings.taggingMode, 
                        maxTags
                    );
                }
                
                let result;
                
                switch (this.settings.taggingMode) {
                    case TaggingMode.ExistingTags:
                        if (!analysis?.matchedExistingTags?.length) continue;
                        
                        result = await TagUtils.updateNoteTags(
                            this.app,
                            file,
                            [],
                            analysis.matchedExistingTags
                        );
                        break;
                        
                    case TaggingMode.GenerateNew:
                        if (!analysis?.suggestedTags?.length) continue;
                        
                        result = await TagUtils.updateNoteTags(
                            this.app,
                            file,
                            analysis.suggestedTags,
                            []
                        );
                        break;
                        
                    case TaggingMode.HybridGenerateExisting:
                    case TaggingMode.HybridGeneratePredefined:
                        if (!analysis?.suggestedTags?.length && !analysis?.matchedExistingTags?.length) continue;
                        
                        result = await TagUtils.updateNoteTags(
                            this.app,
                            file,
                            analysis.suggestedTags ?? [],
                            analysis.matchedExistingTags ?? []
                        );
                        break;
                }

                if (result && result.success) {
                    successCount++;
                }
                
                this.handleTagUpdateResult(result, true);
                processedCount++;
                
                const currentTime = Date.now();
                if (currentTime - lastNoticeTime >= 15000 || processedCount === totalFiles) {
                    new Notice(`Progress: ${processedCount}/${totalFiles} files processed`);
                    lastNoticeTime = currentTime;
                }
            } catch (error) {
                new Notice(`Error processing ${file.path}`);
            }
        }

        new Notice(`Completed! Successfully tagged ${successCount} out of ${totalFiles} files`);
    }

    async analyzeCurrentNote() {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('Please open a note first');
                return;
            }

            const content = await this.app.vault.read(activeFile);
            if (!content.trim()) {
                new Notice('Note is empty');
                return;
            }

            if (this.settings.taggingMode === TaggingMode.PredefinedTags) {
                if (!this.settings.predefinedTagsPath) {
                    new Notice('Predefined tags mode requires a tags file. Please set the predefined tags file path in settings.', 5000);
                    return;
                }
                
                try {
                    const tagsContent = await this.app.vault.adapter.read(this.settings.predefinedTagsPath);
                    const predefinedTags = tagsContent.split('\n')
                        .map((line: string) => line.trim())
                        .filter((line: string) => line.length > 0);

                    if (predefinedTags.length === 0) {
                        new Notice('No predefined tags found in the file. Please add tags to your predefined tags file.', 5000);
                        return;
                    }
                    
                    new Notice('Analyzing note content with predefined tags...');
                    const analysis = await this.llmService.analyzeTags(
                        content, 
                        predefinedTags, 
                        TaggingMode.PredefinedTags, 
                        this.settings.tagRangePredefinedMax
                    );
                    
                    if (!analysis?.matchedExistingTags?.length) {
                        new Notice('No matching predefined tags found for this note.', 5000);
                        return;
                    }
                    
                    const result = await TagUtils.updateNoteTags(
                        this.app,
                        activeFile,
                        [],
                        analysis.matchedExistingTags
                    );

                    this.handleTagUpdateResult(result);
                    return;
                } catch (error) {
                    new Notice(`Error reading predefined tags file: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
                    return;
                }
            }
            
            const existingTags = TagUtils.getAllTags(this.app);
            new Notice('Analyzing note content...');
            
            const maxTags = (() => {
                switch (this.settings.taggingMode) {
                    case TaggingMode.ExistingTags:
                        return this.settings.tagRangeMatchMax;
                    case TaggingMode.HybridGenerateExisting:
                    case TaggingMode.HybridGeneratePredefined:
                        return this.settings.tagRangeMatchMax + this.settings.tagRangeGenerateMax;
                    case TaggingMode.GenerateNew:
                    default:
                        return this.settings.tagRangeGenerateMax;
                }
            })();
            
            try {
                // Only pass language parameter for GenerateNew mode or hybrid modes that include generation
                let analysis;
                if (this.settings.taggingMode === TaggingMode.GenerateNew || 
                    this.settings.taggingMode === TaggingMode.HybridGenerateExisting ||
                    this.settings.taggingMode === TaggingMode.HybridGeneratePredefined) {
                    analysis = await this.llmService.analyzeTags(
                        content, 
                        existingTags, 
                        this.settings.taggingMode, 
                        maxTags, 
                        this.settings.language
                    );
                } else {
                    analysis = await this.llmService.analyzeTags(
                        content, 
                        existingTags, 
                        this.settings.taggingMode, 
                        maxTags
                    );
                }
                
                switch (this.settings.taggingMode) {
                    case TaggingMode.ExistingTags:
                        if (!analysis?.matchedExistingTags?.length) {
                            new Notice('No matching existing tags found for this note.', 5000);
                            return;
                        }
                        
                        await TagUtils.updateNoteTags(
                            this.app,
                            activeFile,
                            [],
                            analysis.matchedExistingTags
                        );
                        break;
                        
                    case TaggingMode.GenerateNew:
                        if (!analysis?.suggestedTags?.length) {
                            new Notice('No new tags were generated for this note.', 5000);
                            return;
                        }
                        
                        await TagUtils.updateNoteTags(
                            this.app,
                            activeFile,
                            analysis.suggestedTags,
                            []
                        );
                        break;
                        
                    case TaggingMode.HybridGenerateExisting:
                    case TaggingMode.HybridGeneratePredefined:
                        if (!analysis?.suggestedTags?.length && !analysis?.matchedExistingTags?.length) {
                            new Notice('No tags were generated or matched for this note.', 5000);
                            return;
                        }
                        
                        const result = await TagUtils.updateNoteTags(
                            this.app,
                            activeFile,
                            analysis.suggestedTags ?? [],
                            analysis.matchedExistingTags ?? []
                        );
                        
                        this.handleTagUpdateResult(result);
                        break;
                }
            } catch (analysisError) {
                new Notice(`Error analyzing tags: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`, 5000);
            }
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
        }
    }
}
