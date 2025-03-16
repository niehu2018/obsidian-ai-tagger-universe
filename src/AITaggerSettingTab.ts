import { App, PluginSettingTab, Setting, ButtonComponent, Notice } from 'obsidian';
import AITaggerPlugin from './main';
import { ConnectionTestResult } from './services';
import { TaggingMode } from './services/prompts/tagPrompts';

export class AITaggerSettingTab extends PluginSettingTab {
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
        this.containerEl.createEl('h1', { text: 'LLM settings' });
        this.createServiceTypeDropdown();
        this.plugin.settings.serviceType === 'local' ? 
            this.displayLocalSettings() : 
            this.displayCloudSettings();
    }

    private createServiceTypeDropdown(): void {
        if (!this.plugin.settings.serviceType) {
            this.plugin.settings.serviceType = 'cloud';
        }
        new Setting(this.containerEl)
            .setName('Service type')
            .setDesc('Choose the AI service provider to use')
            .addDropdown(dropdown => 
                dropdown
                    .addOptions({
                        'local': 'Local LLM',
                        'cloud': 'Cloud service'
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
                .setName('Cloud provider')
                .setDesc('Select the cloud service provider')
                .addDropdown(dropdown => 
                    dropdown
                        .addOptions({
                            'openai': 'OpenAI',
                            'gemini': 'Google Gemini',
                            'deepseek': 'DeepSeek',
                            'aliyun': 'Aliyun',
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
                                        this.plugin.settings.cloudModel = 'gemini-2.0-flash';
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
                                        this.plugin.settings.cloudModel = 'gemini-2.0-flash';
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
                                new Notice('Failed to load cloud endpoints');
                            }
                        })
                );
        }
    }

    private displayLocalSettings(): void {
        const { containerEl } = this;
        const info = containerEl.createDiv();
        info.createSpan({
            text: 'Base URL Address of your Local LLM Service using OpenAI-compatible /v1/chat/completions endpoint',
            cls: 'setting-item-description'
        });

        const list = info.createEl('ul', { cls: 'setting-item-description' });
        list.createEl('li').createEl('code', { text: 'Ollama: http://localhost:11434/v1/chat/completions' });
        list.createEl('li').createEl('code', { text: 'LM Studio: http://localhost:1234/v1/chat/completions' });
        list.createEl('li').createEl('code', { text: 'LocalAI: http://localhost:8080/v1/chat/completions' });

        new Setting(containerEl)
            .setName('Local llm endpoint')
            .setDesc('Enter the base URL for your local service')
            .addText(text => text
                .setPlaceholder('http://localhost:11434/v1/chat/completions')
                .setValue(this.plugin.settings.localEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.localEndpoint = value;
                    await this.plugin.saveSettings();
                }));

        const modelSetting = new Setting(containerEl)
            .setName('Model name')
            .setDesc('Name of the model to use with your local service');
            
        const modelInputContainer = modelSetting.controlEl.createDiv('model-input-container');
        const modelInput = modelInputContainer.createEl('input', {
            type: 'text',
            cls: 'model-input',
            attr: {
                placeholder: 'llama2',
                value: this.plugin.settings.localModel
            }
        });
        
        const dropdownContainer = modelInputContainer.createDiv('model-dropdown-container');
        dropdownContainer.style.display = 'none';
        
        modelInput.addEventListener('focus', async () => {
            try {
                dropdownContainer.empty();
                dropdownContainer.createEl('div', {
                    text: 'Loading models...',
                    cls: 'model-dropdown-loading'
                });
                dropdownContainer.style.display = 'block';
                
                const { fetchLocalModels } = await import('./services/localModelFetcher');
                const models = await fetchLocalModels(this.plugin.settings.localEndpoint);
                
                dropdownContainer.empty();
                
                if (models.length === 0) {
                    dropdownContainer.createEl('div', {
                        text: 'No models found',
                        cls: 'model-dropdown-empty'
                    });
                    return;
                }
                
                models.forEach(model => {
                    const modelItem = dropdownContainer.createEl('div', {
                        text: model,
                        cls: 'model-dropdown-item'
                    });
                    
                    modelItem.addEventListener('click', async () => {
                        modelInput.value = model;
                        this.plugin.settings.localModel = model;
                        await this.plugin.saveSettings();
                        dropdownContainer.style.display = 'none';
                    });
                });
            } catch (error) {
                dropdownContainer.empty();
                dropdownContainer.createEl('div', {
                    text: 'Failed to load models',
                    cls: 'model-dropdown-error'
                });
            }
        });
        
        modelInput.addEventListener('input', async () => {
            this.plugin.settings.localModel = modelInput.value;
            await this.plugin.saveSettings();
        });
        
        document.addEventListener('click', (event) => {
            if (!modelInputContainer.contains(event.target as Node)) {
                dropdownContainer.style.display = 'none';
            }
        });

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
                this.statusEl.setText(message || 'Connected');
                break;
            case 'error':
                this.statusEl.setText(message || 'Error');
                break;
        }
    }

    private displayCloudSettings(): void {
        const { containerEl } = this;

        new Setting(containerEl)
            .setName('API endpoint')
            .setDesc('Enter the complete chat completions API endpoint URL')
            .addText(text => {
                const placeholder = this.plugin.settings.cloudEndpoint || 
                    (this.plugin.settings.cloudServiceType === 'openai-compatible' ? 'http://your-api-endpoint/v1/chat/completions' : '');
                
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

        containerEl.createEl('h1', { text: 'Tagging settings' });

        new Setting(containerEl)
            .setName('Tagging mode')
            .setDesc('Choose how tags should be generated')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    [TaggingMode.PredefinedTags]: 'Use predefined tags only',
                    [TaggingMode.ExistingTags]: 'Use existing tags only',
                    [TaggingMode.GenerateNew]: 'Generate new tags',
                    [TaggingMode.HybridGenerateExisting]: 'Generate new + match existing tags',
                    [TaggingMode.HybridGeneratePredefined]: 'Generate new + match predefined tags'
                })
                .setValue(this.plugin.settings.taggingMode)
                .onChange(async (value) => {
                    this.plugin.settings.taggingMode = value as TaggingMode;
                    await this.plugin.saveSettings();
                }));

        const excludedSetting = new Setting(containerEl)
            .setName('Excluded paths')
            .setDesc('Add file or folder paths to exclude from tagging (ignored during batch operations)');
        
        const excludedInputContainer = excludedSetting.settingEl.createDiv('path-input-container');
        const pathInput = excludedInputContainer.createEl('input', { 
            type: 'text', 
            placeholder: 'Enter path',
            cls: 'path-input'
        });
        
        const dropdownContainer = excludedInputContainer.createDiv('path-dropdown-container');
        dropdownContainer.style.display = 'none';
        
        const updateDropdown = async (searchTerm: string) => {
            try {
                const items: {path: string, isFolder: boolean}[] = [];
                
                this.app.vault.getAllLoadedFiles().forEach(file => {
                    if (file.path.toLowerCase().contains(searchTerm.toLowerCase())) {
                        items.push({
                            path: file.path,
                            isFolder: 'children' in file
                        });
                    }
                });
                
                items.sort((a, b) => {
                    if (a.isFolder && !b.isFolder) return -1;
                    if (!a.isFolder && b.isFolder) return 1;
                    return a.path.localeCompare(b.path);
                });
                
                const limitedItems = items.slice(0, 50);
                dropdownContainer.empty();
                
                if (limitedItems.length === 0) {
                    dropdownContainer.createEl('div', {
                        text: 'No matching paths',
                        cls: 'path-dropdown-empty'
                    });
                    return;
                }
                
                limitedItems.forEach(item => {
                    const pathItem = dropdownContainer.createEl('div', {
                        cls: 'path-dropdown-item'
                    });
                    
                    pathItem.createSpan({
                        cls: `path-item-icon ${item.isFolder ? 'folder-icon' : 'file-icon'}`
                    });
                    
                    pathItem.createSpan({
                        text: item.path,
                        cls: 'path-item-text'
                    });
                    
                    pathItem.addEventListener('click', () => {
                        pathInput.value = item.path;
                        dropdownContainer.style.display = 'none';
                    });
                });
            } catch (error) {
                dropdownContainer.empty();
                dropdownContainer.createEl('div', {
                    text: 'Error loading paths',
                    cls: 'path-dropdown-error'
                });
            }
        };
        
        pathInput.addEventListener('focus', () => {
            dropdownContainer.style.display = 'block';
            updateDropdown(pathInput.value);
        });
        
        pathInput.addEventListener('input', () => {
            if (dropdownContainer.style.display === 'block') {
                updateDropdown(pathInput.value);
            }
        });
        
        document.addEventListener('click', (event) => {
            if (!excludedInputContainer.contains(event.target as Node)) {
                dropdownContainer.style.display = 'none';
            }
        });
        
        const addButton = new ButtonComponent(excludedInputContainer)
            .setButtonText('Add')
            .onClick(async () => {
                const newPath = pathInput.value.trim();
                if (!newPath) {
                    new Notice('Please enter a path');
                    return;
                }
                if (this.plugin.settings.excludedFolders.includes(newPath)) {
                    new Notice('Path already added');
                    return;
                }
                const exists = await this.app.vault.adapter.exists(newPath);
                if (exists) {
                    this.plugin.settings.excludedFolders.push(newPath);
                    await this.plugin.saveSettings();
                    new Notice('Path added successfully');
                    renderExcludedPaths();
                    pathInput.value = '';
                    dropdownContainer.style.display = 'none';
                } else {
                    new Notice('Path does not exist');
                }
            });
        // Create the list container below the setting
        const excludedListContainer = containerEl.createDiv({ cls: 'excluded-list' });
        const renderExcludedPaths = () => {
            excludedListContainer.empty();
            this.plugin.settings.excludedFolders.forEach((p, index) => {
                const row = excludedListContainer.createDiv({ cls: 'excluded-path-row' });
                row.createEl('span', { text: p, cls: 'excluded-path-text' });
                new ButtonComponent(row)
                    .setButtonText('Delete')
                    .onClick(async () => {
                        this.plugin.settings.excludedFolders.splice(index, 1);
                        await this.plugin.saveSettings();
                        renderExcludedPaths();
                    });
            });
        };
        renderExcludedPaths();

        // Tag Range Settings
        containerEl.createEl('h3', { text: 'Tag range settings' });

        new Setting(containerEl)
            .setName('Maximum predefined tags')
            .setDesc('Maximum number of predefined tags to use (0-10)')
            .addSlider(slider => slider
                .setLimits(0, 10, 1)
                .setValue(this.plugin.settings.tagRangePredefinedMax)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.tagRangePredefinedMax = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Maximum existing tags')
            .setDesc('Maximum number of existing tags to match (0-10)')
            .addSlider(slider => slider
                .setLimits(0, 10, 1)
                .setValue(this.plugin.settings.tagRangeMatchMax)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.tagRangeMatchMax = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Maximum generated tags')
            .setDesc('Maximum number of new tags to generate (0-10)')
            .addSlider(slider => slider
                .setLimits(0, 10, 1)
                .setValue(this.plugin.settings.tagRangeGenerateMax)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.tagRangeGenerateMax = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Output language')
            .setDesc('Language for generating tags')
            .addDropdown(dropdown => 
                dropdown
                    .addOptions({
                        'default': 'AI model default',
                        'ar': 'العربية',
                        'cs': 'Čeština',
                        'da': 'Dansk',
                        'de': 'Deutsch',
                        'en': 'English',
                        'es': 'Español',
                        'fr': 'Français',
                        'id': 'Bahasa Indonesia',
                        'it': 'Italiano',
                        'ja': '日本語',
                        'ko': '한국어',
                        'nl': 'Nederlands',
                        'no': 'Norsk',
                        'pl': 'Polski',
                        'pt': 'Português',
                        'pt-BR': 'Português do Brasil',
                        'ro': 'Română',
                        'ru': 'Русский',
                        'tr': 'Türkçe',
                        'uk': 'Українська',
                        'zh': '中文',
                        'zh-TW': '繁體中文'
                    })
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value as 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW';
                        await this.plugin.saveSettings();
                    }));

        containerEl.createEl('h1', { text: 'Predefined tags' });

        // Add note about Obsidian tag rules
        const tagRulesInfo = containerEl.createDiv({ cls: 'tag-rules-info' });
        tagRulesInfo.createEl('p', { 
            text: 'Note: Obsidian tags must follow these rules:', 
            cls: 'setting-item-description' 
        });
        const rulesList = tagRulesInfo.createEl('ul', { cls: 'setting-item-description' });
        rulesList.createEl('li', { text: 'Must start with # symbol (the plugin will add it automatically if missing)' });
        rulesList.createEl('li', { text: 'Can contain letters, numbers, hyphens, and underscores' });
        rulesList.createEl('li', { text: 'No spaces allowed (use hyphens or underscores instead)' });
        rulesList.createEl('li', { text: 'Supports international characters (e.g., #技术, #프로그래밍)' });
        rulesList.createEl('li', { text: 'Example format in predefined tags file: technology, artificial_intelligence, coding-tips (with or without #)' });

        const predefinedTagsSetting = new Setting(containerEl)
            .setName('Predefined tags file')
            .setDesc('Path to a file containing predefined tags (one tag per line)');
        
        const tagsFileInputContainer = predefinedTagsSetting.controlEl.createDiv('path-input-container');
        const tagsFileInput = tagsFileInputContainer.createEl('input', { 
            type: 'text', 
            placeholder: 'path/to/your/tags.txt',
            cls: 'path-input',
            value: this.plugin.settings.predefinedTagsPath || ''
        });
        
        const tagsDropdownContainer = tagsFileInputContainer.createDiv('path-dropdown-container');
        tagsDropdownContainer.style.display = 'none';
        
        const updateTagsDropdown = async (searchTerm: string) => {
            try {
                const items: {path: string, isFolder: boolean}[] = [];
                
                this.app.vault.getFiles().forEach(file => {
                    if (file.path.toLowerCase().contains(searchTerm.toLowerCase())) {
                        items.push({
                            path: file.path,
                            isFolder: false
                        });
                    }
                });
                
                items.sort((a, b) => a.path.localeCompare(b.path));
                const limitedItems = items.slice(0, 50);
                tagsDropdownContainer.empty();
                
                if (limitedItems.length === 0) {
                    tagsDropdownContainer.createEl('div', {
                        text: 'No matching files',
                        cls: 'path-dropdown-empty'
                    });
                    return;
                }
                
                limitedItems.forEach(item => {
                    const pathItem = tagsDropdownContainer.createEl('div', {
                        cls: 'path-dropdown-item'
                    });
                    
                    pathItem.createSpan({
                        cls: 'path-item-icon file-icon'
                    });
                    
                    pathItem.createSpan({
                        text: item.path,
                        cls: 'path-item-text'
                    });
                    
                    pathItem.addEventListener('click', async () => {
                        tagsFileInput.value = item.path;
                        this.plugin.settings.predefinedTagsPath = item.path;
                        await this.plugin.saveSettings();
                        tagsDropdownContainer.style.display = 'none';
                    });
                });
            } catch (error) {
                tagsDropdownContainer.empty();
                tagsDropdownContainer.createEl('div', {
                    text: 'Error loading files',
                    cls: 'path-dropdown-error'
                });
            }
        };
        
        tagsFileInput.addEventListener('focus', () => {
            tagsDropdownContainer.style.display = 'block';
            updateTagsDropdown(tagsFileInput.value);
        });
        
        tagsFileInput.addEventListener('input', async () => {
            this.plugin.settings.predefinedTagsPath = tagsFileInput.value;
            await this.plugin.saveSettings();
            
            if (tagsDropdownContainer.style.display === 'block') {
                updateTagsDropdown(tagsFileInput.value);
            }
        });
        
        document.addEventListener('click', (event) => {
            if (!tagsFileInputContainer.contains(event.target as Node)) {
                tagsDropdownContainer.style.display = 'none';
            }
        });
        
        // Add validate tags button
        predefinedTagsSetting.addButton(button => {
            button
                .setButtonText('Validate tags')
                .onClick(async () => {
                    if (!this.plugin.settings.predefinedTagsPath) {
                        new Notice('Please set a predefined tags file path first', 3000);
                        return;
                    }
                    
                    try {
                        const tagsContent = await this.app.vault.adapter.read(this.plugin.settings.predefinedTagsPath);
                        const tags = tagsContent.split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0);
                        
                        if (tags.length === 0) {
                            new Notice('No tags found in the file');
                            return;
                        }
                        
                        // Validate each tag
                        const invalidTags: string[] = [];
                        const validTags: string[] = [];
                        
                        for (const tag of tags) {
                            // Ensure tag starts with #
                            const tagWithHash = tag.startsWith('#') ? tag : `#${tag}`;
                            
                            // First check: if tag doesn't start with #, it must start with a letter
                            if (!tag.startsWith('#') && !/^[\p{L}]/u.test(tag)) {
                                invalidTags.push(tag);
                                continue;
                            }

                            // Second check: tag (with #) must only contain letters, numbers, hyphens, and underscores
                            const isValid = /^#[\p{L}\p{N}_-]+$/u.test(tagWithHash);
                            
                            if (isValid) {
                                validTags.push(tagWithHash);
                            } else {
                                invalidTags.push(tag);
                            }
                        }
                        
                        if (invalidTags.length > 0) {
                            new Notice(`Found ${invalidTags.length} invalid tags: ${invalidTags.join(', ')}`, 5000);
                        } else {
                            new Notice(`All ${validTags.length} tags are valid!`, 3000);
                        }
                    } catch (error) {
                        new Notice(`Error reading tags file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                });
        });

        containerEl.createEl('h1', { text: 'Support developer' });

        const supportEl = containerEl.createDiv({ cls: 'support-container' });
        supportEl.createSpan({text: 'If you find this plugin helpful, consider buying me a coffee ☕️'});
        
        const button = new ButtonComponent(supportEl)
            .setButtonText('Buy me a coffee')
            .setClass('support-button')
            .onClick(() => {
                window.open('https://buymeacoffee.com/niehu2015o', '_blank');
            });
    }
}
