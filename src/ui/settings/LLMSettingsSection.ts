import { Setting, ButtonComponent, Notice } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { ConnectionTestResult } from '../../services';
import { BaseSettingSection } from './BaseSettingSection';

export class LLMSettingsSection extends BaseSettingSection {
    private statusContainer: HTMLElement = null!;
    private statusEl: HTMLElement = null!;

    display(): void {
        this.containerEl.createEl('h1', { text: 'LLM settings' });
        this.createServiceTypeDropdown();
        this.plugin.settings.serviceType === 'local' ? 
            this.displayLocalSettings() : 
            this.displayCloudSettings();
            
        // Check local service status when loading settings if local service is selected
        if (this.plugin.settings.serviceType === 'local') {
            this.checkLocalService(this.plugin.settings.localEndpoint);
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

        new Setting(this.containerEl)
            .setName('Model name')
            .setDesc('Name of the model to use with your local service')
            .addText(text => text
                .setPlaceholder('Model name (e.g., mistral, llama2, gpt-3.5-turbo)')
                .setValue(this.plugin.settings.localModel)
                .onChange(async (value) => {
                    this.plugin.settings.localModel = value;
                    await this.plugin.saveSettings();
                }));

        // Add a tips section about common local LLM tools
        const tipsEl = this.containerEl.createEl('div', {
            cls: 'ai-tagger-tips-block'
        });
        
        tipsEl.createEl('h3', { text: 'Tips: Popular Local LLM Tools' });
        
        const tipsList = tipsEl.createEl('ul');
        tipsList.createEl('li', { text: 'Ollama: http://localhost:11434/v1/chat/completions' });
        tipsList.createEl('li', { text: 'LocalAI: http://localhost:8080/v1/chat/completions' });
        tipsList.createEl('li', { text: 'LM Studio: http://localhost:1234/v1/chat/completions' });
        tipsList.createEl('li', { text: 'Jan: http://localhost:1337/v1/chat/completions' });
        tipsList.createEl('li', { text: 'KoboldCPP: http://localhost:5001/v1/chat/completions' });
        
        // Style the tips block
        tipsEl.style.backgroundColor = 'rgba(100, 100, 100, 0.1)';
        tipsEl.style.padding = '8px 12px';
        tipsEl.style.borderRadius = '4px';
        tipsEl.style.marginBottom = '16px';
        tipsEl.style.fontSize = '0.9em';

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
                // Disable button during test
                button.setButtonText('Testing...');
                button.setDisabled(true);
                
                // Clear previous status
                if (this.statusContainer) {
                    this.statusContainer.style.display = 'block';
                    this.statusEl.textContent = '';
                    this.statusEl.className = '';
                }
                
                try {
                    const testResult = await this.plugin.llmService.testConnection();
                    
                    if (testResult.result === ConnectionTestResult.Success) {
                        this.setStatusMessage('Connection successful!', 'success');
                    } else {
                        this.setStatusMessage(`Connection failed: ${testResult.error?.message || 'Unknown error'}`, 'error');
                    }
                } catch (error) {
                    this.setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                } finally {
                    // Re-enable button
                    button.setButtonText('Test connection');
                    button.setDisabled(false);
                }
            });

        this.statusContainer = testContainer.createDiv('connection-test-status');
        this.statusEl = this.statusContainer.createSpan();
        
        // Hide status container initially
        if (this.statusContainer) {
            this.statusContainer.style.display = 'none';
        }
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

    private setStatusMessage(message: string, status: 'success' | 'error'): void {
        if (!this.statusContainer || !this.statusEl) return;

        this.statusContainer.style.display = 'block';
        this.statusContainer.className = 'connection-test-status ' + status;
        this.statusEl.textContent = message;
    }

    private async checkLocalService(endpoint: string): Promise<void> {
        const baseUrl = endpoint.trim().replace(/\/$/, '').replace(/\/v1\/chat\/completions$/, '');
        let checkUrl = `${baseUrl}/v1/models`;  // Default check URL for most services

        try {
            const response = await fetch(checkUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                new Notice(`Local LLM service does not appear to be running. Please check your endpoint URL.`, 10000);
            }
        } catch (error) {
            new Notice(`Local LLM service is not available. Please make sure it is installed and running on the correct port.`, 10000);
        }
    }
}
