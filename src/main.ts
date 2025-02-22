import { Plugin, Notice, PluginSettingTab, Setting, TFile, App, ButtonComponent, MarkdownView } from 'obsidian';
import { LLMService, LocalLLMService, CloudLLMService, ConnectionTestResult, LLMServiceConfig } from './services';
import { TagUtils, TagOperationResult } from './tagUtils';

interface AITaggerSettings {
    serviceType: 'local' | 'cloud';
    localEndpoint: string;
    localModel: string;
    cloudEndpoint: string;
    cloudApiKey: string;
    cloudModel: string;
    maxNewTags: number;
    maxMatchedTags: number;
}

const DEFAULT_SETTINGS: AITaggerSettings = {
    serviceType: 'local',
    localEndpoint: 'http://localhost:11434',  // Base endpoint
    localModel: 'llama2',
    cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
    cloudApiKey: '',
    cloudModel: 'gpt-3.5-turbo',
    maxNewTags: 5,
    maxMatchedTags: 2
};

export default class AITaggerPlugin extends Plugin {
    settings: AITaggerSettings = DEFAULT_SETTINGS;
    private llmService: LLMService;

    constructor(app: App, manifest: any) {
        super(app, manifest);
        this.llmService = new LocalLLMService({
            endpoint: DEFAULT_SETTINGS.localEndpoint,
            modelName: DEFAULT_SETTINGS.localModel
        });
    }

    async onload() {
        await this.loadSettings();
        this.initializeLLMService();

        // Register file delete handler
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    TagUtils.resetCache();
                }
            })
        );

        // Add settings tab
        this.addSettingTab(new AITaggerSettingTab(this.app, this));

        // Add commands
        this.addCommand({
            id: 'analyze-note-and-add-tags',
            name: 'Analyze Current Note and Add Tags',
            callback: () => this.analyzeCurrentNote()
        });

        this.addCommand({
            id: 'clear-all-tags',
            name: 'Clear All Tags (Keep Tags Field)',
            callback: () => this.clearNoteTags()
        });

        // Load CSS
        this.loadStyles();
    }

    private loadStyles() {
        const css = document.createElement('style');
        css.id = 'ai-tagger-styles';
        css.textContent = `
        .connection-test-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .connection-test-status {
            margin-left: 10px;
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }

        .connection-test-status.success {
            color: var(--color-green);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .connection-test-status.error {
            color: var(--color-red);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .connection-test-status.testing {
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .connection-test-status.success::before {
            content: "✓";
            font-weight: bold;
        }

        .connection-test-status.error::before {
            content: "✗";
            font-weight: bold;
        }

        .connection-test-status.testing::after {
            content: "";
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid var(--text-muted);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        .support-container {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 8px;
            background: var(--background-primary-alt);
            text-align: center;
        }

        .support-button {
            margin-top: 1rem;
            background-color: #FF813F !important;
            color: white !important;
        }

        .support-button:hover {
            background-color: #FF9B66 !important;
        }`;
        document.head.appendChild(css);
    }

    private initializeLLMService() {
        const config: LLMServiceConfig = {
            endpoint: this.settings.serviceType === 'local' 
                ? this.settings.localEndpoint 
                : this.settings.cloudEndpoint,
            apiKey: this.settings.cloudApiKey,
            modelName: this.settings.serviceType === 'local'
                ? this.settings.localModel
                : this.settings.cloudModel
        };

        this.llmService = this.settings.serviceType === 'local'
            ? new LocalLLMService(config)
            : new CloudLLMService(config);
    }

    async loadSettings() {
        const oldSettings = await this.loadData();
        
        // Handle migration from old settings
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

    async testConnection(): Promise<{ result: ConnectionTestResult; error?: any }> {
        return this.llmService.testConnection();
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
                
                this.app.vault.trigger('modify', activeFile);
                new Notice('Successfully cleared all tags');
            } else {
                new Notice(result.message);
            }
            
            // Ensure view is updated
            setTimeout(() => {
                this.app.workspace.trigger('file-open', activeFile);
            }, 150);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`Error clearing tags: ${message}`);
        }
    }

    async analyzeCurrentNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('Please open a note first');
            return;
        }

        try {
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

            if (result.success) {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view?.getMode() === 'source') {
                    view.editor.refresh();
                }
                new Notice(result.message);
            } else {
                new Notice('Failed to update tags');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`Error analyzing note: ${message}`);
        }
    }

    onunload() {
        const style = document.getElementById('ai-tagger-styles');
        if (style) {
            style.remove();
            TagUtils.resetCache();
        }
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

        new Setting(containerEl)
            .setName('AI Service Type')
            .setDesc('Choose the AI service provider to use')
            .addDropdown(dropdown => 
                dropdown
                    .addOptions({
                        'local': 'Local LLM Service',
                        'cloud': 'Cloud Service'
                    })
                    .setValue(this.plugin.settings.serviceType)
                    .onChange(async (value) => {
                        this.plugin.settings.serviceType = value as 'local' | 'cloud';
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.serviceType === 'local') {
            this.displayLocalSettings(containerEl);
        } else {
            this.displayCloudSettings(containerEl);
        }

        this.displayGeneralSettings(containerEl);
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

    private createTestButton(containerEl: HTMLElement): void {
        const testContainer = containerEl.createDiv('connection-test-container');

        const testSetting = new Setting(testContainer)
            .setName('Connection Test')
            .setDesc('Test connection to AI service');

        const buttonContainer = testSetting.settingEl.createDiv('setting-item-control');
        const button = new ButtonComponent(buttonContainer)
            .setButtonText('Test Connection')
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
                    button.setButtonText('Test Connection').setDisabled(false);
                }
            });

        this.statusContainer = testContainer.createDiv('connection-test-status');
        this.statusEl = this.statusContainer.createSpan();
    }

    private displayLocalSettings(containerEl: HTMLElement): void {
        const info = containerEl.createDiv();
        info.createSpan({
            text: 'Base URL address of your local LLM service.',
            cls: 'setting-item-description'
        });
        
        info.createEl('br');
        info.createEl('br');

        info.createSpan({
            text: 'All services will use the OpenAI-compatible /v1/chat/completions endpoint:',
            cls: 'setting-item-description'
        });

        const list = info.createEl('ul', { cls: 'setting-item-description' });

        // Ollama example
        const ollamaItem = list.createEl('li');
        ollamaItem.createSpan({ text: 'Ollama - Enter base URL: ' });
        ollamaItem.createEl('code', { text: 'http://localhost:11434' });
        ollamaItem.createEl('br');
        ollamaItem.createSpan({
            text: '(Will be converted to /v1/chat/completions format)',
            cls: 'setting-item-description'
        });

        // LM Studio example
        const lmStudioItem = list.createEl('li');
        lmStudioItem.createSpan({ text: 'LM Studio: ' });
        lmStudioItem.createEl('code', { text: 'http://localhost:1234/v1/chat/completions' });

        // LocalAI example
        const localAIItem = list.createEl('li');
        localAIItem.createSpan({ text: 'LocalAI: ' });
        localAIItem.createEl('code', { text: 'http://localhost:8080/v1/chat/completions' });

        new Setting(containerEl)
            .setName('Local LLM Endpoint')
            .setDesc('Enter the base URL for your local service')
            .addText(text => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.localEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.localEndpoint = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Model Name')
            .setDesc('Name of the model to use with your local service')
            .addText(text => text
                .setPlaceholder('llama2')
                .setValue(this.plugin.settings.localModel)
                .onChange(async (value) => {
                    this.plugin.settings.localModel = value;
                    await this.plugin.saveSettings();
                }));

        this.createTestButton(containerEl);
    }

    private displayCloudSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('API Endpoint')
            .setDesc('Enter the complete chat completions API endpoint URL')
            .addText(text => text
                .setPlaceholder('https://api.openai.com/v1/chat/completions')
                .setValue(this.plugin.settings.cloudEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.cloudEndpoint = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Cloud service API key')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.cloudApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.cloudApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Model Name')
            .setDesc('Name of model to use')
            .addText(text => text
                .setPlaceholder('gpt-3.5-turbo')
                .setValue(this.plugin.settings.cloudModel)
                .onChange(async (value) => {
                    this.plugin.settings.cloudModel = value;
                    await this.plugin.saveSettings();
                }));

        this.createTestButton(containerEl);
    }

    private displayGeneralSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Maximum New Tags')
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
            .setName('Maximum Matched Tags')
            .setDesc('Maximum number of tags to match from existing ones (1-3)')
            .addSlider(slider => slider
                .setLimits(1, 3, 1)
                .setValue(this.plugin.settings.maxMatchedTags)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxMatchedTags = value;
                    await this.plugin.saveSettings();
                }));
        containerEl.createEl('h2', {text: 'Support Developer'});
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
