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
            endpoint: config.endpoint || endpoints.bedrock
        });
        this.provider = {
            name: 'bedrock',
            requestFormat: {
                url: '/model/invoke',
                headers: {},
                body: {
                    prompt: '',
                    ...this.defaultConfig,
                    anthropic_version: config.modelName.includes('claude') ? '2023-01-01' : undefined
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

        const messages = [
            {
                role: 'system',
                content: 'You are a professional document tag analysis assistant.'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        if (modelName.includes('claude')) {
            return {
                messages,
                prompt: `\n\nHuman: ${prompt}\n\nAssistant: `,
                ...this.defaultConfig,
                anthropic_version: '2023-01-01'
            };
        } else if (modelName.includes('titan')) {
            return {
                messages,
                inputText: prompt,
                textGenerationConfig: {
                    maxTokenCount: this.defaultConfig.max_tokens,
                    temperature: this.defaultConfig.temperature,
                    stopSequences: []
                }
            };
        }
        
        return {
            messages,
            prompt,
            ...this.defaultConfig
        };
    }

    public parseResponse(response: any): BaseResponse {
        try {
            let content: string;
            if (this.config.modelName.includes('claude')) {
                content = response.completion;
            } else if (this.config.modelName.includes('titan')) {
                content = response.results?.[0]?.outputText;
            } else {
                content = response.generation;
            }

            if (!content) {
                throw new Error('Invalid response format: missing content');
            }

            const jsonContent = this.extractJsonFromContent(content);

            if (!Array.isArray(jsonContent?.matchedTags) || !Array.isArray(jsonContent?.newTags)) {
                throw new Error('Invalid response format: missing required arrays');
            }

            return {
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
