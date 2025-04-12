import { Setting, ButtonComponent, Notice } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { ConnectionTestResult } from '../../services';
import { BaseSettingSection } from './BaseSettingSection';

export class LLMSettingsSection extends BaseSettingSection {
    private statusContainer: HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;

    display(): void {
        this.containerEl.createEl('h1', { text: 'LLM settings' });
        this.createServiceTypeDropdown();
        this.plugin.settings.serviceType === 'local' ? 
            this.displayLocalSettings() : 
            this.displayCloudSettings();
            
        // Check local service status when loading settings if local service is selected
        if (this.plugin.settings.serviceType === 'local') {
            this.checkLocalService(this.plugin.settings.localServiceType, this.plugin.settings.localEndpoint);
        }
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
                        this.settingTab.display();
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
                                const endpoints = await import('../../services/adapters/cloudEndpoints.json');
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
                                this.settingTab.display();
                            } catch (error) {
                                new Notice('Failed to load cloud endpoints');
                            }
                        })
                );
        }
    }

    private displayLocalSettings(): void {
        new Setting(this.containerEl)
            .setName('Local Service Type')
            .setDesc('Select the local AI service provider')
            .addDropdown(dropdown => 
                dropdown
                    .addOptions({
                        'ollama': 'Ollama',
                        'lm_studio': 'LM Studio',
                        'localai': 'LocalAI'
                    })
                    .setValue((this.plugin.settings.localServiceType as 'ollama' | 'lm_studio' | 'localai') || 'ollama')
                    .onChange(async (value) => {
                        const previousType = this.plugin.settings.localServiceType;
                        this.plugin.settings.localServiceType = value as 'ollama' | 'lm_studio' | 'localai';
                        
                        // If switching to a different service, clear the current model
                        if (previousType !== value) {
                            this.plugin.settings.localModel = '';
                        }
                        
                        if (value === 'ollama') {
                            this.plugin.settings.localEndpoint = 'http://localhost:11434/v1/chat/completions';
                            this.checkLocalService('ollama', this.plugin.settings.localEndpoint);
                        } else if (value === 'lm_studio') {
                            this.plugin.settings.localEndpoint = 'http://localhost:1234/v1/chat/completions';
                            this.checkLocalService('lm_studio', this.plugin.settings.localEndpoint);
                        } else if (value === 'localai') {
                            this.plugin.settings.localEndpoint = 'http://localhost:8080/v1/chat/completions';
                            this.checkLocalService('localai', this.plugin.settings.localEndpoint);
                        }
                        await this.plugin.saveSettings();
                        this.settingTab.display();
                    })
            );

        new Setting(this.containerEl)
            .setName('Local llm endpoint')
            .setDesc('Enter the base URL for your local service')
            .addText(text => text
                .setPlaceholder('http://localhost:11434/v1/chat/completions')
                .setValue(this.plugin.settings.localEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.localEndpoint = value;
                    await this.plugin.saveSettings();
                    
                    // Refresh the settings to update the model dropdown
                    this.settingTab.display();
                }));

        const modelSetting = new Setting(this.containerEl)
            .setName('Model name')
            .setDesc('Name of the model to use with your local service')
            .addDropdown(async (dropdown) => {
                // Set initial loading state
                dropdown.addOption('loading', 'Loading models...');
                dropdown.setDisabled(true);
                
                try {
                    // Check if service is running before attempting to fetch models
                    const baseUrl = this.plugin.settings.localEndpoint.trim().replace(/\/$/, '').replace(/\/v1\/chat\/completions$/, '');
                    let checkUrl = '';
                    let serviceName = '';
                    
                    switch (this.plugin.settings.localServiceType) {
                        case 'ollama':
                            checkUrl = `${baseUrl}/api/tags`;
                            serviceName = 'Ollama';
                            break;
                        case 'lm_studio':
                            checkUrl = `${baseUrl}/v1/models`;
                            serviceName = 'LM Studio';
                            break;
                        case 'localai':
                            checkUrl = `${baseUrl}/v1/models`;
                            serviceName = 'LocalAI';
                            break;
                        default:
                            throw new Error('Unknown service type');
                    }
                    
                    // Try to check if service is running
                    let serviceRunning = false;
                    try {
                        const serviceCheck = await fetch(checkUrl, {
                            method: 'GET',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        serviceRunning = serviceCheck.ok;
                    } catch (error) {
                        serviceRunning = false;
                        new Notice(`${serviceName} service is not available. Please make sure it is installed and running.`, 10000);
                    }
                    
                    // Only fetch models if service is running
                    if (serviceRunning) {
                        // Import and call the model fetcher
                        const { fetchLocalModels } = await import('../../services/localModelFetcher');
                        const allModels = await fetchLocalModels(this.plugin.settings.localEndpoint);
                        
                        // Filter out models containing "rank" or "embed" (case insensitive)
                        const models = allModels.filter(model => {
                            const lowerName = model.toLowerCase();
                            return !lowerName.includes('rank') && !lowerName.includes('embed');
                        });
                        
                        // Re-enable and clear the dropdown
                        dropdown.setDisabled(false);
                        
                        // Create options object
                        const options: Record<string, string> = {};
                        
                        if (models.length === 0) {
                            // Show notice if no models found
                            let noticeMessage = `No models found for ${serviceName}. `;
                            
                            switch (this.plugin.settings.localServiceType) {
                                case 'ollama':
                                    noticeMessage += 'Please run "ollama pull mistral" or another model name in your terminal.';
                                    break;
                                case 'lm_studio':
                                    noticeMessage += 'Please download a model via the LM Studio application interface.';
                                    break;
                                case 'localai':
                                    noticeMessage += 'Please download a model following the LocalAI documentation.';
                                    break;
                                default:
                                    noticeMessage += 'Please download at least one model before using this service.';
                            }
                            
                            new Notice(noticeMessage, 15000);
                            
                            // If no models found, just add the current value or a placeholder
                            if (this.plugin.settings.localModel) {
                                options[this.plugin.settings.localModel] = `${this.plugin.settings.localModel}`;
                            } else {
                                options['custom'] = 'Enter a model name...';
                            }
                        } else {
                            // Sort and add all the models
                            models.sort((a, b) => a.localeCompare(b));
                            
                            models.forEach(model => {
                                options[model] = model;
                            });
                            
                            // If the current model isn't in the list, add it
                            if (this.plugin.settings.localModel && !models.includes(this.plugin.settings.localModel)) {
                                options[this.plugin.settings.localModel] = `${this.plugin.settings.localModel} (custom)`;
                            }
                        }
                        
                        // Clear loading option
                        dropdown.selectEl.empty();
                        
                        // Add all options
                        dropdown.addOptions(options);
                        
                        // Select the current model
                        if (this.plugin.settings.localModel && options[this.plugin.settings.localModel]) {
                            dropdown.setValue(this.plugin.settings.localModel);
                        } else if (models.length > 0) {
                            // Default to first model if nothing is selected
                            dropdown.setValue(models[0]);
                            this.plugin.settings.localModel = models[0];
                            await this.plugin.saveSettings();
                        }
                    } else {
                        // Service not running, clear dropdown and add a message
                        dropdown.setDisabled(false);
                        dropdown.selectEl.empty();
                        
                        // Add placeholder option
                        dropdown.addOption('service-not-running', `Start ${serviceName} service first`);
                        
                        // Only keep the current model if it's from the same service type
                        const modelServiceType = this.getModelServiceType(this.plugin.settings.localModel);
                        if (this.plugin.settings.localModel && modelServiceType === this.plugin.settings.localServiceType) {
                            dropdown.addOption(this.plugin.settings.localModel, `${this.plugin.settings.localModel} (current)`);
                            dropdown.setValue(this.plugin.settings.localModel);
                        } else {
                            dropdown.setValue('service-not-running');
                        }
                    }
                } catch (error) {
                    //console.error('Error loading models:', error);
                    
                    dropdown.setDisabled(false);
                    dropdown.selectEl.empty();
                    
                    // Add error option
                    dropdown.addOption('error', 'Error loading models');
                    
                    // Add current model if it exists and matches the current service type
                    const modelServiceType = this.getModelServiceType(this.plugin.settings.localModel);
                    if (this.plugin.settings.localModel && modelServiceType === this.plugin.settings.localServiceType) {
                        dropdown.addOption(this.plugin.settings.localModel, `${this.plugin.settings.localModel} (current)`);
                        dropdown.setValue(this.plugin.settings.localModel);
                    } else {
                        dropdown.setValue('error');
                    }
                }
                
                // Handle model selection change
                dropdown.onChange(async (value) => {
                    if (value !== 'loading' && value !== 'error') {
                        this.plugin.settings.localModel = value;
                        await this.plugin.saveSettings();
                    }
                });
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

    private displayCloudSettings(): void {
        new Setting(this.containerEl)
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

        new Setting(this.containerEl)
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

        new Setting(this.containerEl)
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

    private async checkLocalService(serviceType: string, endpoint: string): Promise<void> {
        const baseUrl = endpoint.trim().replace(/\/$/, '').replace(/\/v1\/chat\/completions$/, '');
        let checkUrl = '';
        let serviceName = '';
        
        switch (serviceType) {
            case 'ollama':
                checkUrl = `${baseUrl}/api/tags`;
                serviceName = 'Ollama';
                break;
            case 'lm_studio':
                checkUrl = `${baseUrl}/v1/models`;
                serviceName = 'LM Studio';
                break;
            case 'localai':
                checkUrl = `${baseUrl}/v1/models`;
                serviceName = 'LocalAI';
                break;
            default:
                return;
        }
        
        try {
            const response = await fetch(checkUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                new Notice(`${serviceName} service does not appear to be running. Please start the ${serviceName} service before using it.`, 10000);
            }
        } catch (error) {
            new Notice(`${serviceName} service is not available. Please make sure it is installed and running on the correct port.`, 10000);
        }
    }

    private async checkLocalAIService(): Promise<void> {
        // Keeping this for backward compatibility
        await this.checkLocalService('localai', 'http://localhost:8080/v1/chat/completions');
    }

    private getServiceName(serviceType: string): string {
        switch (serviceType) {
            case 'ollama':
                return 'Ollama';
            case 'lm_studio':
                return 'LM Studio';
            case 'localai':
                return 'LocalAI';
            default:
                return 'Local service';
        }
    }

    // Helper to determine which service a model likely belongs to
    private getModelServiceType(modelName: string): string | null {
        if (!modelName) return null;
        
        const lowerModelName = modelName.toLowerCase();
        
        // Common Ollama model prefixes/names
        if (lowerModelName.startsWith('llama') || 
            lowerModelName.startsWith('mistral') || 
            lowerModelName.startsWith('phi') ||
            lowerModelName.startsWith('gemma') ||
            lowerModelName.startsWith('mixtral') ||
            lowerModelName.startsWith('codellama') ||
            lowerModelName.startsWith('vicuna') ||
            lowerModelName.startsWith('dolphin') ||
            lowerModelName.startsWith('wizardlm') ||
            lowerModelName.startsWith('stable-') ||
            lowerModelName.includes('-gguf')) {
            return 'ollama';
        }
        
        // Models in format of openai format are likely from LM Studio or LocalAI
        // This is more of a guess, as both can use various model formats
        if (lowerModelName.includes('gpt-') || lowerModelName.includes('/')) {
            // More likely LocalAI format
            if (lowerModelName.includes('/')) {
                return 'localai';
            }
            // More likely LM Studio format
            return 'lm_studio';
        }
        
        return null; // We can't determine the service type
    }
}
