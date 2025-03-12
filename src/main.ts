import { Plugin, Notice, TFile, App, MarkdownView } from 'obsidian';
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

        // Add ribbon icons
        this.addRibbonIcon('tags', 'AI tag current note', () => {
            this.analyzeCurrentNote();
        });
        
        this.addRibbonIcon('graph', 'Show tag network', () => {
            this.showTagNetwork();
        });
    }

    async onunload() {
        if (this.llmService) {
            await this.llmService.dispose();
        }
        
        this.eventHandlers.cleanup();
        // Force refresh to ensure proper cleanup of UI elements
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
            console.error('Error showing tag network:', error);
            new Notice('Error building tag network. Check console for details.', 5000);
        }
    }

    async testConnection(): Promise<{ result: ConnectionTestResult; error?: any }> {
        return this.llmService.testConnection();
    }

    async clearAllNotesTags() {
        new Notice('Starting to clear tags from all notes...');
        let count = 0;
        
        // Get all markdown files from the vault
        const markdownFiles = this.app.vault.getMarkdownFiles();
        
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
        }

        // Force refresh metadata cache
        new Notice('Refreshing metadata cache...');
        try {
            // Trigger a layout change to force metadata refresh
            this.app.workspace.trigger('layout-change');
            
            // Wait a moment for the cache to update
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Force refresh of all files
            for (const file of markdownFiles) {
                this.app.metadataCache.trigger('changed', file);
            }
            
            // Wait again for the cache to fully update
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            new Notice(`Successfully cleared tags from ${count} notes and refreshed metadata cache`);
        } catch (error) {
            console.error('Error refreshing metadata cache:', error);
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
        new Notice(`Starting to analyze ${totalFiles} file${totalFiles > 1 ? 's' : ''}...`);
        let processedCount = 0;
        let successCount = 0;

        const existingTags = TagUtils.getAllTags(this.app);

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                if (!content.trim()) continue;

                const maxTags = (() => {
                    switch (this.settings.taggingMode) {
                        case TaggingMode.PredefinedTags:
                            return this.settings.tagRangePredefinedMax;
                        case TaggingMode.ExistingTags:
                            return this.settings.tagRangeMatchMax;
                        case TaggingMode.Hybrid:
                        case TaggingMode.GenerateNew:
                        default:
                            return this.settings.tagRangeGenerateMax;
                    }
                })();
                const analysis = await this.llmService.analyzeTags(content, existingTags, this.settings.taggingMode, maxTags, this.settings.language);
                const result = await TagUtils.updateNoteTags(
                    this.app,
                    file,
                    analysis.suggestedTags,
                    analysis.matchedExistingTags
                );

                if (result.success) {
                    successCount++;
                }
                
                this.handleTagUpdateResult(result, true);
                processedCount++;
                
                if (processedCount % 5 === 0 || processedCount === totalFiles) {
                    new Notice(`Progress: ${processedCount}/${totalFiles} files processed`);
                }
            } catch (error) {
                console.error(`Error processing ${file.path}:`, error);
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

            const existingTags = TagUtils.getAllTags(this.app);
            new Notice('Analyzing note content...');
            
            const maxTags = (() => {
                switch (this.settings.taggingMode) {
                    case TaggingMode.PredefinedTags:
                        return this.settings.tagRangePredefinedMax;
                    case TaggingMode.ExistingTags:
                        return this.settings.tagRangeMatchMax;
                    case TaggingMode.Hybrid:
                    case TaggingMode.GenerateNew:
                    default:
                        return this.settings.tagRangeGenerateMax;
                }
            })();
            
            try {
                const analysis = await this.llmService.analyzeTags(content, existingTags, this.settings.taggingMode, maxTags, this.settings.language);
                if (!analysis.suggestedTags.length && !analysis.matchedExistingTags.length) {
                    new Notice('No tags were generated or matched. The LLM service may not have returned any tags or all generated tags were invalid.', 5000);
                    return;
                }
                
                const result = await TagUtils.updateNoteTags(
                    this.app,
                    activeFile,
                    analysis.suggestedTags,
                    analysis.matchedExistingTags
                );

                this.handleTagUpdateResult(result);
            } catch (analysisError) {
                console.error('Error during tag analysis:', analysisError);
                new Notice(`Error analyzing tags: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`, 5000);
            }
        } catch (error) {
            console.error('Error in analyzeCurrentNote:', error);
            new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 5000);
        }
    }
}
