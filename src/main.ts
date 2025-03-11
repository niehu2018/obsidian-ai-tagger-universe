import { Plugin, Notice, PluginSettingTab, Setting, TFile, App, ButtonComponent, MarkdownView, Menu, TFolder, MenuItem } from 'obsidian';
import { LLMService, LocalLLMService, CloudLLMService, ConnectionTestResult, LLMServiceConfig } from './services';
import { TagUtils, TagOperationResult } from './tagUtils';
import { saveAllTags } from './saveTags';

interface AITaggerSettings {
    serviceType: 'local' | 'cloud';
    localEndpoint: string;
    localModel: string;
    cloudEndpoint: string;
    cloudApiKey: string;
    cloudModel: string;
    maxNewTags: number;
    maxMatchedTags: number;
    cloudServiceType: 'openai' | 'gemini' | 'deepseek' | 'aliyun' | 'claude' | 'groq' | 'vertex' | 'openrouter' | 'bedrock' | 'requesty' | 'cohere' | 'grok' | 'mistral' | 'openai-compatible';
    predefinedTagsPath: string;
    maxPredefinedTags: number;
    language: 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru';
    tagDir: string;
}

const DEFAULT_SETTINGS: AITaggerSettings = {
    serviceType: 'local',
    localEndpoint: 'http://localhost:11434/v1/chat/completions',
    localModel: 'llama2',
    cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
    cloudApiKey: '',
    cloudModel: 'gpt-3.5-turbo',
    maxNewTags: 5,
    maxMatchedTags: 2,
    cloudServiceType: 'openai',
    predefinedTagsPath: '',
    maxPredefinedTags: 3,
    language: 'en',
    tagDir: 'tags'
};

export default class AITaggerPlugin extends Plugin {
    settings: AITaggerSettings = DEFAULT_SETTINGS;
    private llmService: LLMService;
    private fileChangeTimeoutId: NodeJS.Timeout | null = null;

    constructor(app: App, manifest: Plugin["manifest"]) {
        super(app, manifest);
        this.llmService = new LocalLLMService({
            endpoint: DEFAULT_SETTINGS.localEndpoint,
            modelName: DEFAULT_SETTINGS.localModel,
            language: DEFAULT_SETTINGS.language
        });
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
        this.registerEventHandlers();
        this.addSettingTab(new AITaggerSettingTab(this.app, this));
        this.registerCommands();

        // Add ribbon icon for quick tagging
        this.addRibbonIcon('tags', 'Ai tag current note', () => {
            this.analyzeCurrentNote();
        });
    }

    private registerEventHandlers() {
        // Handle file deletions
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.app.workspace.trigger('file-open', file);
                }
            })
        );

        // Handle file modifications
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    // Debounce file refresh on changes
                    if (this.fileChangeTimeoutId) {
                        clearTimeout(this.fileChangeTimeoutId);
                    }
                    this.fileChangeTimeoutId = setTimeout(() => {
                        this.app.workspace.trigger('file-open', file);
                        this.fileChangeTimeoutId = null;
                    }, 2000);
                }
            })
        );

        // Handle layout changes
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                // Refresh any active editor views
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view?.getMode() === 'source') {
                    view.editor.refresh();
                }
            })
        );
    }

    private registerCommands() {
        // Register file menu items for batch tagging
        this.registerEvent(
            // @ts-ignore - File menu event is not properly typed in Obsidian API
            this.app.workspace.on('file-menu', (menu: Menu, file: TFile, source: string, files?: TFile[]) => {
                if (files && files.length > 0) {
                    // Multiple files selected
                    const markdownFiles = files.filter(f => f.extension === 'md');
                    if (markdownFiles.length > 0) {
                        menu.addItem((item) => {
                            item
                                .setTitle(`Ai tag ${markdownFiles.length} selected notes`)
                                .setIcon('tag')
                                .onClick(() => this.analyzeAndTagFiles(markdownFiles));
                        });
                    }
                } else if (file.extension === 'md') {
                    // Single file selected
                    menu.addItem((item) => {
                        item
                            .setTitle('Ai tag this note')
                            .setIcon('tag')
                            .onClick(() => this.analyzeAndTagFiles([file]));
                    });
                }
            })
        );

        // Command to generate tags for current note (alternate name)
        this.addCommand({
            id: 'generate-tags-for-current-note',
            name: 'Generate tags for current note',
            icon: 'tag',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    this.analyzeCurrentNote();
                } else {
                    new Notice('Please open a note first');
                }
            }
        });

        // Command to clear tags
        this.addCommand({
            id: 'clear-all-tags',
            name: 'Clear all tags in current note',
            icon: 'eraser',
            editorCallback: (editor, view) => {
                if (view.file) {
                    this.clearNoteTags();
                } else {
                    new Notice('Please open a note first');
                }
            }
        });

        // Command to clear tags in all notes
        this.addCommand({
            id: 'clear-all-notes-tags',
            name: 'Clear all tags in all vault',
            icon: 'eraser',
            callback: async () => {
                await this.clearAllNotesTags();
            }
        });

        // Command to tag all notes in vault
        this.addCommand({
            id: 'tag-all-notes',
            name: 'Generate tags for all notes in vault',
            icon: 'tag',
            callback: async () => {
                const files = this.app.vault.getMarkdownFiles();
                if (files.length > 0) {
                    await this.analyzeAndTagFiles(files);
                } else {
                    new Notice('No markdown files found in vault');
                }
            }
        });

        // Command to generate tags for all notes in current folder
        this.addCommand({
            id: 'tag-current-folder-notes',
            name: 'Generate tags for all notes in current folder',
            icon: 'tag',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('Please open a note first');
                    return;
                }

                const parentFolder = activeFile.parent;
                if (!parentFolder) {
                    new Notice('Could not determine parent folder');
                    return;
                }

                // Get all markdown files in the current folder
                const filesInFolder = parentFolder.children
                    .filter((file): file is TFile => file instanceof TFile && file.extension === 'md');

                if (filesInFolder.length === 0) {
                    new Notice('No markdown files found in current folder');
                    return;
                }

                await this.analyzeAndTagFiles(filesInFolder);
            }
        });

        // Command to collect all tags from vault
        this.addCommand({
            id: 'collect-all-tags',
            name: 'Collect all tags from all notes in vault',
            icon: 'tags',
            callback: async () => {
                await saveAllTags(this.app, this.settings.tagDir);
            }
        });

        // Command to assign predefined tags to all notes
        this.addCommand({
            id: 'assign-predefined-tags-all-notes',
            name: 'Assign pre-defined tags for all notes in vault',
            icon: 'tag',
            callback: async () => {
                if (!this.settings.predefinedTagsPath) {
                    new Notice('Please set the predefined tags file path in settings');
                    return;
                }

                const files = this.app.vault.getMarkdownFiles();
                if (files.length === 0) {
                    new Notice('No markdown files found in vault');
                    return;
                }

                try {
                    const tagsContent = await this.app.vault.adapter.read(this.settings.predefinedTagsPath);
                    const predefinedTags = tagsContent.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);

                    if (predefinedTags.length === 0) {
                        new Notice('No predefined tags found in the file');
                        return;
                    }

                    new Notice(`Starting to assign predefined tags to ${files.length} files...`);
                    let processedCount = 0;
                    let successCount = 0;

                    for (const file of files) {
                        try {
                            const content = await this.app.vault.read(file);
                            if (!content.trim()) continue;

                            const analysis = await this.llmService.analyzeTags(content, predefinedTags);
                            const matchedTags = analysis.matchedExistingTags.slice(0, this.settings.maxPredefinedTags);
                            
                            const result = await TagUtils.updateNoteTags(this.app, file, [], matchedTags);
                            if (result.success) {
                                successCount++;
                            }
                            
                            processedCount++;
                            if (processedCount % 5 === 0 || processedCount === files.length) {
                                new Notice(`Progress: ${processedCount}/${files.length} files processed`);
                            }
                        } catch (error) {
                            console.error(`Error processing ${file.path}:`, error);
                        }
                    }

                    new Notice(`Completed! Successfully tagged ${successCount} out of ${files.length} files`);
                } catch (error) {
                    console.error('Error assigning predefined tags:', error);
                    new Notice('Failed to assign predefined tags to notes');
                }
            }
        });

        // Command to assign predefined tags
        this.addCommand({
            id: 'assign-predefined-tags',
            name: 'Assign pre-defined tags for current note',
            icon: 'tag',
            editorCallback: async (editor, view) => {
                if (!view.file) {
                    new Notice('Please open a note first');
                    return;
                }

                if (!this.settings.predefinedTagsPath) {
                    new Notice('Please set the predefined tags file path in settings');
                    return;
                }

                try {
                    const tagsContent = await this.app.vault.adapter.read(this.settings.predefinedTagsPath);
                    const predefinedTags = tagsContent.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);

                    if (predefinedTags.length === 0) {
                        new Notice('No predefined tags found in the file');
                        return;
                    }

                    const content = await this.app.vault.read(view.file);
                    const analysis = await this.llmService.analyzeTags(content, predefinedTags);
                    const matchedTags = analysis.matchedExistingTags.slice(0, this.settings.maxPredefinedTags);
                    
                    if (matchedTags.length === 0) {
                        new Notice('No matching predefined tags found');
                        return;
                    }

                    const result = await TagUtils.updateNoteTags(this.app, view.file, [], matchedTags);
                    this.handleTagUpdateResult(result);
                } catch (error) {
                    console.error('Error assigning predefined tags:', error);
                    new Notice('Failed to assign predefined tags');
                }
            }
        });

        // Command to generate tags for selected text
        this.addCommand({
            id: 'generate-tags-for-selection',
            name: 'Generate tags on selected text',
            icon: 'tag',
            editorCallback: async (editor, view) => {
                const selectedText = editor.getSelection();
                if (!selectedText) {
                    new Notice('Please select some text first');
                    return;
                }

                if (!view.file) {
                    new Notice('Cannot update tags: No file is open');
                    return;
                }

                const existingTags = TagUtils.getAllTags(this.app);
                new Notice('Analyzing selected text...');
                
                try {
                    const analysis = await this.llmService.analyzeTags(selectedText, existingTags);
                    const suggestedTags = analysis.suggestedTags.slice(0, this.settings.maxNewTags);
                    const matchedTags = analysis.matchedExistingTags.slice(0, this.settings.maxMatchedTags);
                    
                    // Update frontmatter tags
                    const result = await TagUtils.updateNoteTags(this.app, view.file, suggestedTags, matchedTags);
                    
                    if (result.success) {
                        editor.replaceSelection(selectedText);
                        new Notice(`Added ${suggestedTags.length + matchedTags.length} tags to frontmatter`);
                    } else {
                        new Notice('Failed to update tags');
                    }
                } catch (error) {
                    console.error('Error generating tags:', error);
                    new Notice('Failed to generate tags');
                }
            }
        });
    }

    async onunload() {
        if (this.llmService) {
            await this.llmService.dispose();
        }
        
        if (this.fileChangeTimeoutId) {
            clearTimeout(this.fileChangeTimeoutId);
            this.fileChangeTimeoutId = null;
        }

        // Force refresh to ensure proper cleanup of UI elements
        this.app.workspace.trigger('layout-change');
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

        new Notice(`Successfully cleared tags from ${count} notes`);
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
            
            this.fileChangeTimeoutId = setTimeout(() => {
                this.app.workspace.trigger('file-open', activeFile);
                this.fileChangeTimeoutId = null;
            }, 150);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`Error clearing tags: ${message}`);
        }
    }

    private handleTagUpdateResult(result: TagOperationResult, silent: boolean = false): void {
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

                const analysis = await this.llmService.analyzeTags(content, existingTags);
                const result = await TagUtils.updateNoteTags(
                    this.app,
                    file,
                    analysis.suggestedTags.slice(0, this.settings.maxNewTags),
                    analysis.matchedExistingTags.slice(0, this.settings.maxMatchedTags)
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
        
        const analysis = await this.llmService.analyzeTags(content, existingTags);
        const result = await TagUtils.updateNoteTags(
            this.app,
            activeFile,
            analysis.suggestedTags.slice(0, this.settings.maxNewTags),
            analysis.matchedExistingTags.slice(0, this.settings.maxMatchedTags)
        );

        this.handleTagUpdateResult(result);
    }
}

class AITaggerSettingTab extends PluginSettingTab {
    plugin: AITaggerPlugin;
    private statusEl: HTMLElement | null = null;
    private statusContainer: HTMLElement | null = null;

    constructor(app: App, plugin: AITaggerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        this.createLLMSettings();
        this.displayGeneralSettings();
    }

    private createLLMSettings(): void {
        this.containerEl.createEl('h1', { text: 'LLM Settings' });
        this.createServiceTypeDropdown();
        this.plugin.settings.serviceType === 'local' ? 
            this.displayLocalSettings() : 
            this.displayCloudSettings();
    }

    private createServiceTypeDropdown(): void {
        new Setting(this.containerEl)
            .setName('Service Type')
            .setDesc('Choose the AI service provider to use')
            .addDropdown(dropdown => 
                dropdown
                    .addOptions({
                        'local': 'Local LLM',
                        'cloud': 'Cloud Service'
                    })
                    .setValue(this.plugin.settings.serviceType)
                    .onChange(async (value) => {
                        this.plugin.settings.serviceType = value as 'local' | 'cloud';
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.serviceType === 'cloud') {
            new Setting(this.containerEl)
                .setName('Cloud Provider')
                .setDesc('Select the cloud service provider')
                .addDropdown(dropdown => 
                    dropdown
                        .addOptions({
                            'openai': 'OpenAI',
                            'gemini': 'Google Gemini',
                            'deepseek': 'DeepSeek',
                            'aliyun': 'Aliyun Qwen',
                            'claude': 'Anthropic Claude',
                            'groq': 'Groq LLM',
                            'vertex': 'Google Vertex AI',
                            'openrouter': 'OpenRouter',
                            'bedrock': 'AWS Bedrock',
                            'requesty': 'Requesty',
                            'cohere': 'Cohere',
                            'grok': 'Grok',
                            'mistral': 'Mistral AI',
                            'openai-compatible': 'OpenAI Compatible'
                        })
                        .setValue(this.plugin.settings.cloudServiceType)
                        .onChange(async (value) => {
                            const type = value as 'openai' | 'gemini' | 'deepseek' | 'aliyun' | 'claude' | 'groq' | 'vertex' | 'openrouter' | 'bedrock' | 'requesty' | 'cohere' | 'grok' | 'mistral' | 'openai-compatible';
                            this.plugin.settings.cloudServiceType = type;
                            
                            try {
                                const endpoints = await import('./services/adapters/cloudEndpoints.json');
                                switch (type) {
                                    case 'openai':
                                        this.plugin.settings.cloudEndpoint = endpoints.openai;
                                        this.plugin.settings.cloudModel = 'gpt-3.5-turbo';
                                        break;
                                    case 'gemini':
                                        this.plugin.settings.cloudEndpoint = endpoints.gemini;
                                        this.plugin.settings.cloudModel = 'gemini-pro';
                                        break;
                                    case 'deepseek':
                                        this.plugin.settings.cloudEndpoint = endpoints.deepseek;
                                        this.plugin.settings.cloudModel = 'deepseek-chat';
                                        break;
                                    case 'aliyun':
                                        this.plugin.settings.cloudEndpoint = endpoints.aliyun;
                                        this.plugin.settings.cloudModel = 'qwen-max';
                                        break;
                                    case 'claude':
                                        this.plugin.settings.cloudEndpoint = endpoints.claude;
                                        this.plugin.settings.cloudModel = 'claude-3-opus-20240229';
                                        break;
                                    case 'groq':
                                        this.plugin.settings.cloudEndpoint = endpoints.groq;
                                        this.plugin.settings.cloudModel = 'mixtral-8x7b-32768';
                                        break;
                                    case 'vertex':
                                        this.plugin.settings.cloudEndpoint = endpoints.vertex;
                                        this.plugin.settings.cloudModel = 'gemini-pro';
                                        break;
                                    case 'openrouter':
                                        this.plugin.settings.cloudEndpoint = endpoints.openrouter;
                                        this.plugin.settings.cloudModel = 'default';
                                        break;
                                    case 'bedrock':
                                        this.plugin.settings.cloudEndpoint = endpoints.bedrock;
                                        this.plugin.settings.cloudModel = 'anthropic.claude-v2';
                                        break;
                                    case 'requesty':
                                        this.plugin.settings.cloudEndpoint = endpoints.requesty;
                                        this.plugin.settings.cloudModel = 'gpt-4';
                                        break;
                                    case 'cohere':
                                        this.plugin.settings.cloudEndpoint = endpoints.cohere;
                                        this.plugin.settings.cloudModel = 'command';
                                        break;
                                    case 'grok':
                                        this.plugin.settings.cloudEndpoint = endpoints.grok;
                                        this.plugin.settings.cloudModel = 'grok-1';
                                        break;
                                    case 'mistral':
                                        this.plugin.settings.cloudEndpoint = endpoints.mistral;
                                        this.plugin.settings.cloudModel = 'mistral-medium';
                                        break;
                                    case 'openai-compatible':
                                        this.plugin.settings.cloudEndpoint = 'http://your-api-endpoint/v1/chat/completions';
                                        this.plugin.settings.cloudModel = 'your-model';
                                        break;
                                }
                                await this.plugin.saveSettings();
                                this.display();
                            } catch (error) {
                                console.error('Failed to load cloud endpoints:', error);
                            }
                        })
                );
        }
    }

    private displayLocalSettings(): void {
        const { containerEl } = this;
        const info = containerEl.createDiv();
        info.createSpan({
            text: 'Base URL address of your local LLM service using OpenAI-compatible /v1/chat/completions endpoint',
            cls: 'setting-item-description'
        });

        const list = info.createEl('ul', { cls: 'setting-item-description' });
        list.createEl('li').createEl('code', { text: 'Ollama: http://localhost:11434' });
        list.createEl('li').createEl('code', { text: 'LM Studio: http://localhost:1234/v1/chat/completions' });
        list.createEl('li').createEl('code', { text: 'LocalAI: http://localhost:8080/v1/chat/completions' });

        new Setting(containerEl)
            .setName('Local LLM endpoint')
            .setDesc('Enter the base URL for your local service')
            .addText(text => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.localEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.localEndpoint = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Model name')
            .setDesc('Name of the model to use with your local service')
            .addText(text => text
                .setPlaceholder('llama2')
                .setValue(this.plugin.settings.localModel)
                .onChange(async (value) => {
                    this.plugin.settings.localModel = value;
                    await this.plugin.saveSettings();
                }));

        this.createTestButton();
    }

    private createTestButton(): void {
        const testContainer = this.containerEl.createDiv('connection-test-container');

        const testSetting = new Setting(testContainer)
            .setName('Connection test')
            .setDesc('Test connection to AI service');

        const buttonContainer = testSetting.settingEl.createDiv('setting-item-control');
        const button = new ButtonComponent(buttonContainer)
            .setButtonText('Test connection')
            .onClick(async () => {
                button.setButtonText('Testing...').setDisabled(true);
                this.setTestStatus('testing');

                try {
                    const result = await this.plugin.testConnection();
                    if (result.result === ConnectionTestResult.Success) {
                        this.setTestStatus('success', 'Connection successful');
                    } else {
                        this.setTestStatus('error', result.error?.message || 'Connection failed');
                    }
                } catch (error) {
                    this.setTestStatus('error', 'Error during test');
                } finally {
                    button.setButtonText('Test connection').setDisabled(false);
                }
            });

        this.statusContainer = testContainer.createDiv('connection-test-status');
        this.statusEl = this.statusContainer.createSpan();
    }

    private setTestStatus(status: 'testing' | 'success' | 'error', message?: string): void {
        if (!this.statusContainer || !this.statusEl) return;

        this.statusContainer.removeClass('testing', 'success', 'error');
        this.statusContainer.addClass(status);
        
        switch (status) {
            case 'testing':
                this.statusEl.setText('Testing...');
                break;
            case 'success':
                this.statusEl.setText(message || 'Connection successful');
                break;
            case 'error':
                this.statusEl.setText(message || 'Connection failed');
                break;
        }
    }

    private displayCloudSettings(): void {
        const { containerEl } = this;


        new Setting(containerEl)
            .setName('API endpoint')
            .setDesc('Enter the complete chat completions API endpoint URL')
            .addText(text => {
                const placeholder = this.plugin.settings.cloudServiceType === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
                    this.plugin.settings.cloudServiceType === 'gemini' ? 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent' :
                    this.plugin.settings.cloudServiceType === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' :
                    this.plugin.settings.cloudServiceType === 'aliyun' ? 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation' :
                    this.plugin.settings.cloudServiceType === 'claude' ? 'https://api.anthropic.com' :
                    this.plugin.settings.cloudServiceType === 'groq' ? 'https://api.groq.com/v1/chat/completions' :
                    this.plugin.settings.cloudServiceType === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
                    this.plugin.settings.cloudServiceType === 'bedrock' ? 'https://bedrock-runtime.amazonaws.com' :
                    this.plugin.settings.cloudServiceType === 'requesty' ? 'https://api.requesty.ai/v1/chat/completions' :
                    this.plugin.settings.cloudServiceType === 'cohere' ? 'https://api.cohere.ai/v1/generate' :
                    this.plugin.settings.cloudServiceType === 'grok' ? 'https://api.grok.x.ai/v1/chat/completions' :
                    this.plugin.settings.cloudServiceType === 'mistral' ? 'https://api.mistral.ai/v1/generate' :
                    this.plugin.settings.cloudServiceType === 'openai-compatible' ? 'http://your-api-endpoint/v1/chat/completions' :
                    'https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1/publishers/google/models/gemini-pro';
                
                text.setPlaceholder(placeholder)
                    .setValue(this.plugin.settings.cloudEndpoint);
                
                text.onChange(async (value) => {
                    this.plugin.settings.cloudEndpoint = value;
                    await this.plugin.saveSettings();
                });
                
                return text;
            });

        new Setting(containerEl)
            .setName('API key')
            .setDesc('Cloud service API key')
            .addText(text => text
                .setPlaceholder(
                    this.plugin.settings.cloudServiceType === 'openai' ? 'sk-...' :
                    this.plugin.settings.cloudServiceType === 'gemini' ? 'AIza...' :
                    this.plugin.settings.cloudServiceType === 'deepseek' ? 'deepseek-...' :
                    this.plugin.settings.cloudServiceType === 'aliyun' ? 'sk-...' :
                    this.plugin.settings.cloudServiceType === 'claude' ? 'sk-ant-...' :
                    this.plugin.settings.cloudServiceType === 'groq' ? 'gsk_...' :
                    this.plugin.settings.cloudServiceType === 'openrouter' ? 'sk-or-...' :
                    this.plugin.settings.cloudServiceType === 'bedrock' ? 'aws-credentials' :
                    this.plugin.settings.cloudServiceType === 'requesty' ? 'rq-...' :
                    this.plugin.settings.cloudServiceType === 'cohere' ? 'co-...' :
                    this.plugin.settings.cloudServiceType === 'grok' ? 'grok-...' :
                    this.plugin.settings.cloudServiceType === 'mistral' ? 'mist-...' :
                    this.plugin.settings.cloudServiceType === 'openai-compatible' ? 'your-api-key' :
                    'Bearer oauth2-token'
                )
                .setValue(this.plugin.settings.cloudApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.cloudApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Model name')
            .setDesc('Name of model to use')
            .addText(text => text
                .setPlaceholder(
                    this.plugin.settings.cloudServiceType === 'openai' ? 'gpt-3.5-turbo' :
                    this.plugin.settings.cloudServiceType === 'gemini' ? 'gemini-pro' :
                    this.plugin.settings.cloudServiceType === 'deepseek' ? 'deepseek-chat' :
                    this.plugin.settings.cloudServiceType === 'aliyun' ? 'qwen-max' :
                    this.plugin.settings.cloudServiceType === 'claude' ? 'claude-3-opus-20240229' :
                    this.plugin.settings.cloudServiceType === 'groq' ? 'mixtral-8x7b-32768' :
                    this.plugin.settings.cloudServiceType === 'openrouter' ? 'default' :
                    this.plugin.settings.cloudServiceType === 'bedrock' ? 'anthropic.claude-v2' :
                    this.plugin.settings.cloudServiceType === 'requesty' ? 'gpt-4' :
                    this.plugin.settings.cloudServiceType === 'cohere' ? 'command' :
                    this.plugin.settings.cloudServiceType === 'grok' ? 'grok-1' :
                    this.plugin.settings.cloudServiceType === 'mistral' ? 'mistral-medium' :
                    this.plugin.settings.cloudServiceType === 'openai-compatible' ? 'your-model' :
                    'gemini-pro'
                )
                .setValue(this.plugin.settings.cloudModel)
                .onChange(async (value) => {
                    this.plugin.settings.cloudModel = value;
                    await this.plugin.saveSettings();
                }));

        this.createTestButton();
    }

    private displayGeneralSettings(): void {
        const { containerEl } = this;

        containerEl.createEl('h1', { text: 'Tagging Settings' });

        new Setting(containerEl)
            .setName('Maximum new tags')
            .setDesc('Maximum number of new tags to generate (3-10)')
            .addSlider(slider => slider
                .setLimits(3, 10, 1)
                .setValue(this.plugin.settings.maxNewTags)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxNewTags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Maximum matched tags')
            .setDesc('Maximum number of tags to match from existing ones (1-3)')
            .addSlider(slider => slider
                .setLimits(1, 3, 1)
                .setValue(this.plugin.settings.maxMatchedTags)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxMatchedTags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Output Language')
            .setDesc('Language for generating tags')
            .addDropdown(dropdown => 
                dropdown
                    .addOptions({
                        'en': 'English',
                        'zh': '中文',
                        'ja': '日本語',
                        'ko': '한국어',
                        'fr': 'Français',
                        'de': 'Deutsch',
                        'es': 'Español',
                        'pt': 'Português',
                        'ru': 'Русский'
                    })
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value as 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru';
                        await this.plugin.saveSettings();
                    }));

        containerEl.createEl('h1', { text: 'Predefined Tags' });

        new Setting(containerEl)
            .setName('Predefined tags file')
            .setDesc('Path to a file containing predefined tags (one tag per line)')
            .addText(text => text
                .setPlaceholder('path/to/your/tags.txt')
                .setValue(this.plugin.settings.predefinedTagsPath)
                .onChange(async (value) => {
                    this.plugin.settings.predefinedTagsPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Maximum predefined tags')
            .setDesc('Maximum number of predefined tags to assign (1-5)')
            .addSlider(slider => slider
                .setLimits(1, 5, 1)
                .setValue(this.plugin.settings.maxPredefinedTags)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxPredefinedTags = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h1', { text: 'Support Developer' });

        const supportEl = containerEl.createDiv('support-container');
        supportEl.createSpan({text: 'If you find this plugin helpful, consider buying me a coffee ☕️'});
        
        const button = new ButtonComponent(supportEl)
            .setButtonText('Buy Me a Coffee')
            .setClass('support-button')
            .onClick(() => {
                window.open('https://buymeacoffee.com/niehu2015o', '_blank');
            });
    }
}
