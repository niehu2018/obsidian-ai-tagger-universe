import { App, MarkdownView, Modal, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { 
    ConnectionTestError,
    ConnectionTestResult,
    LLMService, 
    LocalLLMService,
    CloudLLMService 
} from './services';
import { ConfirmationModal } from './ui/modals/ConfirmationModal';
import { TagUtils, TagOperationResult } from './utils/tagUtils';
import { TaggingMode } from './services/prompts/tagPrompts';
import { registerCommands } from './commands/index';
import { AITaggerSettings, DEFAULT_SETTINGS } from './core/settings';
import { AITaggerSettingTab } from './ui/settings/AITaggerSettingTab';
import { EventHandlers } from './utils/eventHandlers';
import { TagNetworkManager } from './utils/tagNetworkUtils';
import { TagNetworkView, TAG_NETWORK_VIEW_TYPE } from './ui/views/TagNetworkView';
import { TagOperations } from './utils/tagOperations';
import { BatchProcessResult } from './utils/batchProcessor';

export default class AITaggerPlugin extends Plugin {
    public settings = {...DEFAULT_SETTINGS};
    public llmService: LLMService;
    private eventHandlers: EventHandlers;
    private tagNetworkManager: TagNetworkManager;
    private tagOperations: TagOperations;

    constructor(app: App, manifest: any) {
        super(app, manifest);
        this.llmService = new LocalLLMService({
            endpoint: DEFAULT_SETTINGS.localEndpoint,
            modelName: DEFAULT_SETTINGS.localModel,
            language: DEFAULT_SETTINGS.language
        });
        this.eventHandlers = new EventHandlers(app);
        this.tagNetworkManager = new TagNetworkManager(app);
        this.tagOperations = new TagOperations(app);
    }

    public async loadSettings(): Promise<void> {
        const oldSettings = await this.loadData();
        
        if (oldSettings?.serviceType === 'ollama') {
            oldSettings.serviceType = 'local';
            oldSettings.localEndpoint = oldSettings.ollamaEndpoint;
            oldSettings.localModel = oldSettings.ollamaModel;
            delete oldSettings.ollamaEndpoint;
            delete oldSettings.ollamaModel;
        }

        this.settings = Object.assign({}, DEFAULT_SETTINGS, oldSettings);
    }

    public async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        await this.initializeLLMService();
    }

    private async initializeLLMService(): Promise<void> {
        await this.llmService?.dispose();

        this.llmService = this.settings.serviceType === 'local'
            ? new LocalLLMService({
                endpoint: this.settings.localEndpoint,
                modelName: this.settings.localModel,
                language: this.settings.language
            })
            : new CloudLLMService({
                endpoint: this.settings.cloudEndpoint,
                apiKey: this.settings.cloudApiKey,
                modelName: this.settings.cloudModel,
                type: this.settings.cloudServiceType,
                language: this.settings.language
            });
    }

    public async onload(): Promise<void> {
        await this.loadSettings();
        await this.initializeLLMService();
        
        // Register event handlers
        this.eventHandlers.registerEventHandlers();
        
        // Add settings tab
        this.addSettingTab(new AITaggerSettingTab(this.app, this));
        
        // Register commands
        registerCommands(this);

        // Register view type for tag network
        this.registerView(
            TAG_NETWORK_VIEW_TYPE,
            (leaf) => new TagNetworkView(leaf, this.tagNetworkManager.getNetworkData())
        );

        // Add ribbon icons with descriptive tooltips
        this.addRibbonIcon(
            'tags', 
            'Analyze and tag current note', 
            (evt: MouseEvent) => {
                this.analyzeCurrentNote();
            }
        );
        
        this.addRibbonIcon(
            'graph', 
            'View tag relationships network', 
            (evt: MouseEvent) => {
                this.showTagNetwork();
            }
        );
    }

    public async onunload(): Promise<void> {
        // Clean up resources
        await this.llmService?.dispose();
        this.eventHandlers.cleanup();
        
        // Unregister views
        this.app.workspace.detachLeavesOfType(TAG_NETWORK_VIEW_TYPE);
        
        // Trigger layout refresh
        this.app.workspace.trigger('layout-change');
    }
    
    public async showTagNetwork(): Promise<void> {
        try {
            const statusNotice = new Notice('Building tag network...', 0);
            
            await this.tagNetworkManager.buildTagNetwork();
            const networkData = this.tagNetworkManager.getNetworkData();
            
            statusNotice.hide();
            
            if (!networkData.nodes.length) {
                new Notice('No tags were found in your vault', 3000);
                return;
            }
            
            if (!networkData.edges.length) {
                new Notice('Tags were found, but there are no connections between them', 4000);
            }

            // Try to find existing network view
            let leaf = this.app.workspace.getLeavesOfType(TAG_NETWORK_VIEW_TYPE)[0];
            
            if (!leaf) {
                // Create new view in right sidebar
                const newLeaf = await this.app.workspace.getRightLeaf(false);
                if (!newLeaf) {
                    throw new Error('Failed to create new workspace leaf');
                }
                
                await newLeaf.setViewState({
                    type: TAG_NETWORK_VIEW_TYPE,
                    active: true
                });
                
                leaf = this.app.workspace.getLeavesOfType(TAG_NETWORK_VIEW_TYPE)[0];
                if (!leaf) {
                    throw new Error('Failed to initialize tag network view');
                }
            }
            
            this.app.workspace.revealLeaf(leaf);
        } catch (error) {
            console.error('Failed to show tag network:', error);
            new Notice('Failed to build tag network. Please check console for details.', 4000);
        }
    }

    public async testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }> {
        try {
            return await this.llmService.testConnection();
        } catch (error) {
            console.error('Connection test failed:', error);
            return {
                result: ConnectionTestResult.Failed,
                error: {
                    type: 'unknown',
                    message: error instanceof Error ? error.message : 'Unknown error occurred'
                }
            };
        }
    }

    public async showConfirmationDialog(message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ConfirmationModal(
                this.app,
                'Warning',
                message,
                () => resolve(true)
            );
            modal.onClose = () => resolve(false);
            modal.open();
        });
    }

    public async clearAllNotesTags(): Promise<void> {
        const files = this.app.vault.getMarkdownFiles();
        if (await this.showConfirmationDialog(
            `Remove all tags from ${files.length} notes? This action cannot be undone.`
        )) {
            try {
                await this.tagOperations.clearVaultTags();
                new Notice('Successfully cleared all tags from vault', 3000);
            } catch (error) {
                console.error('Failed to clear vault tags:', error);
                new Notice('Failed to clear tags from vault', 4000);
            }
        }
    }

    public async clearNoteTags(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('Please open a note before clearing tags', 3000);
            return;
        }

        const result = await this.tagOperations.clearNoteTags(activeFile);
        this.handleTagUpdateResult(result);
    }

    public async clearDirectoryTags(directory: TFile[]): Promise<BatchProcessResult> {
        return this.tagOperations.clearDirectoryTags(directory);
    }

    public handleTagUpdateResult(result: TagOperationResult | null | undefined, silent = false): void {
        if (!result) {
            !silent && new Notice('Failed to update tags: No result returned', 3000);
            return;
        }

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        
        if (result.success) {
            // Refresh editor view only if in source mode
            if (view?.getMode() === 'source') {
                view.editor.refresh();
            }
            
            // Trigger layout update for reading view
            this.app.workspace.trigger('layout-change');
            
            !silent && new Notice(result.message, 3000);
        } else {
            !silent && new Notice(`Failed to update tags: ${result.message || 'Unknown error'}`, 4000);
            console.error('Tag update failed:', result.message);
        }
    }

    public async analyzeAndTagFiles(files: TFile[]): Promise<void> {
        if (!files?.length) return;

        const statusNotice = new Notice(`Analyzing ${files.length} files...`, 0);
        
        try {
            await (this.settings.taggingMode === TaggingMode.PredefinedTags
                ? this.processPredefinedTagsMode(files)
                : this.processStandardTaggingMode(files));
        } catch (error) {
            console.error('Batch processing failed:', error);
            new Notice('Failed to complete batch processing', 4000);
        } finally {
            statusNotice.hide();
        }
    }

    private async processPredefinedTagsMode(files: TFile[]): Promise<void> {
        if (!this.settings.predefinedTagsPath) {
            throw new Error('Predefined tags mode requires a tags file');
        }

        const tagsContent = await this.app.vault.adapter.read(this.settings.predefinedTagsPath);
        const predefinedTags = tagsContent.split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        if (!predefinedTags.length) {
            throw new Error('No predefined tags found in tags file');
        }

        let processed = 0, successful = 0;
        let lastNotice = Date.now();

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
                    analysis.matchedExistingTags,
                    true
                );

                result.success && successful++;
                this.handleTagUpdateResult(result, true);
                processed++;

                if (Date.now() - lastNotice >= 15000) {
                    new Notice(`Progress: ${processed}/${files.length} files processed`, 3000);
                    lastNotice = Date.now();
                }
            } catch (error) {
                console.error(`Error processing ${file.path}:`, error);
                new Notice(`Error processing ${file.path}`, 4000);
            }
        }

        new Notice(`Successfully tagged ${successful} out of ${files.length} files`, 4000);
    }

    private async processStandardTaggingMode(files: TFile[]): Promise<void> {
        const existingTags = TagUtils.getAllTags(this.app);
        let processed = 0, successful = 0;
        let lastNotice = Date.now();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                if (!content.trim()) continue;

                const analysis = await this.analyzeContent(content, existingTags, this.calculateMaxTags());
                const result = await this.updateTags(file, analysis);

                result?.success && successful++;
                this.handleTagUpdateResult(result, true);
                processed++;

                if (Date.now() - lastNotice >= 15000) {
                    new Notice(`Progress: ${processed}/${files.length} files processed`, 3000);
                    lastNotice = Date.now();
                }
            } catch (error) {
                console.error(`Error processing ${file.path}:`, error);
                new Notice(`Error processing ${file.path}`, 4000);
            }
        }

        new Notice(`Successfully tagged ${successful} out of ${files.length} files`, 4000);
    }

    private calculateMaxTags(): number {
        switch (this.settings.taggingMode) {
            case TaggingMode.ExistingTags:
                return this.settings.tagRangeMatchMax;
            case TaggingMode.HybridGenerateExisting:
            case TaggingMode.HybridGeneratePredefined:
                return this.settings.tagRangeMatchMax + this.settings.tagRangeGenerateMax;
            default:
                return this.settings.tagRangeGenerateMax;
        }
    }

    private async analyzeContent(content: string, existingTags: string[], maxTags: number) {
        return await this.llmService.analyzeTags(
            content,
            existingTags,
            this.settings.taggingMode,
            maxTags,
            [TaggingMode.GenerateNew, TaggingMode.HybridGenerateExisting, TaggingMode.HybridGeneratePredefined]
                .includes(this.settings.taggingMode) ? this.settings.language : undefined
        );
    }

    private async updateTags(file: TFile, analysis: any) {
        if (!analysis) return null;

        const { matchedExistingTags = [], suggestedTags = [] } = analysis;

        switch (this.settings.taggingMode) {
            case TaggingMode.ExistingTags:
                return matchedExistingTags.length 
                    ? await TagUtils.updateNoteTags(this.app, file, [], matchedExistingTags, true)
                    : null;
                
            case TaggingMode.GenerateNew:
                return suggestedTags.length
                    ? await TagUtils.updateNoteTags(this.app, file, suggestedTags, [], true)
                    : null;
                
            case TaggingMode.HybridGenerateExisting:
            case TaggingMode.HybridGeneratePredefined:
                return (suggestedTags.length || matchedExistingTags.length)
                    ? await TagUtils.updateNoteTags(this.app, file, suggestedTags, matchedExistingTags, true)
                    : null;
            
            default:
                return null;
        }
    }

    public async analyzeCurrentNote(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('Please open a note before analyzing', 3000);
            return;
        }

        const content = await this.app.vault.read(activeFile);
        if (!content.trim()) {
            new Notice('Cannot analyze empty note', 3000);
            return;
        }

        try {
            await (this.settings.taggingMode === TaggingMode.PredefinedTags
                ? this.analyzeWithPredefinedTags(activeFile, content)
                : this.analyzeWithStandardMode(activeFile, content));
        } catch (error) {
            console.error('Failed to analyze note:', error);
            new Notice('Failed to analyze note. Please check console for details.', 4000);
        }
    }

    private async analyzeWithPredefinedTags(file: TFile, content: string): Promise<void> {
        if (!this.settings.predefinedTagsPath) {
            throw new Error('Predefined tags mode requires a tags file');
        }

        const tagsContent = await this.app.vault.adapter.read(this.settings.predefinedTagsPath);
        const predefinedTags = tagsContent.split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        if (!predefinedTags.length) {
            new Notice('No predefined tags found in tags file', 3000);
            return;
        }

        const analysis = await this.llmService.analyzeTags(
            content,
            predefinedTags,
            TaggingMode.PredefinedTags,
            this.settings.tagRangePredefinedMax
        );

        if (!analysis?.matchedExistingTags?.length) {
            new Notice('No matching tags found for this note', 3000);
            return;
        }

        const result = await TagUtils.updateNoteTags(
            this.app,
            file,
            [],
            analysis.matchedExistingTags,
            true
        );

        this.handleTagUpdateResult(result);
    }

    private async analyzeWithStandardMode(file: TFile, content: string): Promise<void> {
        const analysis = await this.analyzeContent(content, TagUtils.getAllTags(this.app), this.calculateMaxTags());
        const result = await this.updateTags(file, analysis);
        
        if (result) {
            this.handleTagUpdateResult(result);
        } else {
            new Notice('No relevant tags were generated or matched for this note', 3000);
        }
    }
}
