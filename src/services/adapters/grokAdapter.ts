import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class GrokAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        max_tokens: 1024,
        stream: false
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.grok
        });
        this.provider = {
            name: 'grok',
            requestFormat: {
                url: '/v1/chat/completions',
                headers: {},
                body: {
                    model: config.modelName,
                    messages: [],
                    ...this.defaultConfig
                }
            },
            responseFormat: {
                path: ['choices', '0', 'message', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
        return {
            model: this.config.modelName,
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
            ...this.defaultConfig
        };
    }

    public parseResponse(response: any): BaseResponse {
        try {
            const content = response.choices?.[0]?.message?.content;
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
            throw new Error(`Failed to parse Grok response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Grok';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Grok';
        }
        if (!this.config.modelName) {
            return 'Model name is required for Grok';
        }
        return null;
    }

    public extractError(error: any): string {
        return error.error?.message ||
            error.response?.data?.error?.message ||
            error.message ||
            'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Grok');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
    }
}
