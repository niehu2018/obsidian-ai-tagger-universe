import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class CohereAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        chat_history: [],
        stream: false
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.cohere
        });
        this.provider = {
            name: 'cohere',
            requestFormat: {
                url: '/v1/chat',
                headers: {},
                body: {
                    model: config.modelName,
                    message: '',
                    ...this.defaultConfig
                }
            },
            responseFormat: {
                path: ['text'],
                errorPath: ['message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
        return {
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional document tag analysis assistant.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            model: this.config.modelName,
            message: prompt,
            ...this.defaultConfig,
            connectors: []
        };
    }

    public parseResponse(response: any): BaseResponse {
        try {
            const content = response.text;
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
            throw new Error(`Failed to parse Cohere response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Cohere';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Cohere';
        }
        if (!this.config.modelName) {
            return 'Model name is required for Cohere';
        }
        return null;
    }

    public extractError(error: any): string {
        return error.message ||
            error.response?.data?.message ||
            'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Cohere');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Accept': 'application/json'
        };
    }
}
