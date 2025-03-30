import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, LLMServiceProvider, AdapterConfig } from './types';
import { SYSTEM_PROMPT } from '../types';

export class OpenAICompatibleAdapter extends BaseAdapter {
    constructor(config: AdapterConfig) {
        super(config);
        this.provider = {
            name: 'openai-compatible',
            requestFormat: {
                url: config.endpoint || '/v1/chat/completions',
                headers: {},
                body: {
                    model: this.config.modelName,
                    messages: []
                }
            },
            responseFormat: {
                path: ['choices', '0', 'message', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody & Record<string, any> {
        const body: RequestBody & Record<string, any> = {
            model: this.config.modelName,
            messages: [{
                role: 'system',
                content: SYSTEM_PROMPT
            }, {
                role: 'user',
                content: prompt
            }]
        };

        // Add any additional parameters from config
        for (const [key, value] of Object.entries(this.config)) {
            if (!['endpoint', 'apiKey', 'modelName'].includes(key)) {
                body[key] = value;
            }
        }

        return body;
    }

    public parseResponse(response: any): BaseResponse {
        try {
            let content: string;
            
            // Handle different response formats
            if (response.choices?.[0]?.message?.content) {
                content = response.choices[0].message.content;
            } else if (response.choices?.[0]?.text) {
                // Some OpenAI-compatible APIs might use 'text' instead of 'message.content'
                content = response.choices[0].text;
            } else {
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
            throw new Error(`Failed to parse response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required';
        }
        if (!this.config.modelName) {
            return 'Model name is required';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required';
        }
        return null;
    }

    public extractError(error: any): string {
        // Handle different error response formats
        if (error.response?.data?.error?.message) {
            return error.response.data.error.message;
        }
        if (error.response?.data?.message) {
            return error.response.data.message;
        }
        return error.message || 'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...(this.provider?.requestFormat.headers || {})
        };
    }
}
