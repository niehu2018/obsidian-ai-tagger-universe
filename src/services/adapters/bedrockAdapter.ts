import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class BedrockAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        max_tokens: 1024,
        temperature: 0.7
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.bedrock,
            modelName: config.modelName || 'anthropic.claude-3-haiku-20240307-v1:0'
        });
        this.provider = {
            name: 'bedrock',
            requestFormat: {
                url: '/model/invoke',
                headers: {},
                body: {
                    model: this.modelName
                }
            },
            responseFormat: {
                path: ['completion'],
                errorPath: ['errorMessage']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
        const modelName = this.config.modelName || '';
        const baseRequest = super.formatRequest(prompt);
        delete (baseRequest as any).temperature;
        const temperature = this.getTemperatureOverride() ?? this.defaultConfig.temperature;
        
        // Provide different request formats based on model type
        if (modelName.includes('claude')) {
            return {
                ...baseRequest,
                prompt: `\n\nHuman: ${prompt}\n\nAssistant: `,
                ...this.defaultConfig,
                temperature,
                anthropic_version: '2023-01-01'
            };
        } else if (modelName.includes('titan')) {
            return {
                ...baseRequest,
                inputText: prompt,
                textGenerationConfig: {
                    maxTokenCount: this.defaultConfig.max_tokens,
                    temperature,
                    stopSequences: []
                }
            };
        }
        
        return {
            ...baseRequest,
            prompt,
            ...this.defaultConfig,
            temperature
        };
    }

    public parseResponse(response: any): BaseResponse {
        try {
            let content: string = '';
            const modelName = this.config.modelName || '';
            
            if (modelName.includes('claude')) {
                content = response.completion || '';
            } else if (modelName.includes('titan')) {
                content = response.results?.[0]?.outputText || '';
            } else {
                content = response.generation || '';
            }

            if (!content) {
                throw new Error('Invalid response format: missing content');
            }

            const jsonContent = this.extractJsonFromContent(content);

            if (!Array.isArray(jsonContent?.matchedTags) || !Array.isArray(jsonContent?.newTags)) {
                throw new Error('Invalid response format: missing required arrays');
            }

            return {
                text: content,
                matchedExistingTags: jsonContent.matchedTags,
                suggestedTags: jsonContent.newTags
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Bedrock response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for AWS Bedrock';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for AWS Bedrock';
        }
        if (!this.config.modelName) {
            return 'Model name is required for AWS Bedrock';
        }
        return null;
    }

    public extractError(error: any): string {
        return error.errorMessage ||
            error.response?.data?.errorMessage ||
            error.message ||
            'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
    }
}
