import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';
import { SYSTEM_PROMPT } from '../../utils/constants';

export class RequestyAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        max_tokens: 1024
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.requesty
        });
        this.provider = {
            name: 'requesty',
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
        const baseRequest = super.formatRequest(prompt);
        
        return {
            ...baseRequest,
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
                text: content,
                matchedExistingTags: jsonContent.matchedTags,
                suggestedTags: jsonContent.newTags
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Requesty response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Requesty AI';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Requesty AI';
        }
        if (!this.config.modelName) {
            return 'Model name is required for Requesty AI';
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
            throw new Error('API key is required for Requesty AI');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...(this.provider?.requestFormat.headers || {})
        };
    }
}
