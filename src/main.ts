import { App, MarkdownView, Modal, Notice, Plugin, TFile } from 'obsidian';
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
import { TagNetworkView } from './ui/views/TagNetworkView';
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
        
        this.eventHandlers.registerEventHandlers();
        this.addSettingTab(new AITaggerSettingTab(this.app, this));
        registerCommands(this);

        this.addRibbonIcon('tags', 'AI Tagger Universe', () => this.analyzeCurrentNote());
        this.addRibbonIcon('graph', 'Show tag network', () => this.showTagNetwork());
    }

    public async onunload(): Promise<void> {
        await this.llmService?.dispose();
        this.eventHandlers.cleanup();
        this.app.workspace.trigger('layout-change');
    }
    
    public async showTagNetwork(): Promise<void> {
        new Notice('Building tag network...');
        await this.tagNetworkManager.buildTagNetwork();
        const networkData = this.tagNetworkManager.getNetworkData();
        
        if (!networkData.nodes.length) {
            new Notice('No tags found in your vault');
            return;
        }
        
        !networkData.edges.length && new Notice('Tags found, but no connections between them');
        new TagNetworkView(this.app, networkData).open();
    }

    public async testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }> {
        try {
            return await this.llmService.testConnection();
        } catch (error) {
            return {
                result: ConnectionTestResult.Failed,
                error: {
                    type: 'unknown',
                    message: error instanceof Error ? error.message : 'Unknown error'
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
        (await this.showConfirmationDialog(
            `Remove all tags from ${files.length} notes? This cannot be undone.`
        )) && await this.tagOperations.clearVaultTags();
    }

    public async clearNoteTags(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('Please open a note first');
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
            !silent && new Notice('Failed to update tags');
            return;
        }

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        result.success && view?.getMode() === 'source' && view.editor.refresh();
        !silent && new Notice(result.success ? result.message : 'Failed to update tags');
    }

    public async analyzeAndTagFiles(files: TFile[]): Promise<void> {
        if (!files?.length) return;

        new Notice(`Analyzing ${files.length} files...`);
        
        try {
            await (this.settings.taggingMode === TaggingMode.PredefinedTags
                ? this.processPredefinedTagsMode(files)
                : this.processStandardTaggingMode(files));
        } catch {
            new Notice('Failed to complete batch processing');
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
            throw new Error('No predefined tags found');
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
                    new Notice(`Progress: ${processed}/${files.length}`);
                    lastNotice = Date.now();
                }
            } catch {
                new Notice(`Error processing ${file.path}`);
            }
        }

        new Notice(`Tagged ${successful}/${files.length} files`);
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
                    new Notice(`Progress: ${processed}/${files.length}`);
                    lastNotice = Date.now();
                }
            } catch {
                new Notice(`Error processing ${file.path}`);
            }
        }

        new Notice(`Tagged ${successful}/${files.length} files`);
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
        }
    }

    public async analyzeCurrentNote(): Promise<void> {
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

        await (this.settings.taggingMode === TaggingMode.PredefinedTags
            ? this.analyzeWithPredefinedTags(activeFile, content)
            : this.analyzeWithStandardMode(activeFile, content));
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
            new Notice('No predefined tags found');
            return;
        }

        const analysis = await this.llmService.analyzeTags(
            content,
            predefinedTags,
            TaggingMode.PredefinedTags,
            this.settings.tagRangePredefinedMax
        );

        if (!analysis?.matchedExistingTags?.length) {
            new Notice('No matching tags found');
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
        
        result ? this.handleTagUpdateResult(result) : new Notice('No tags generated or matched');
    }
}
