import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class VertexAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.vertex
        });
        this.provider = {
            name: 'vertex',
            requestFormat: {
                url: '/predict',
                headers: {},
                body: {
                    instances: [{
                        messages: []
                    }],
                    parameters: this.defaultConfig
                }
            },
            responseFormat: {
                path: ['predictions', '0', 'candidates', '0', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
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
        
        return {
            model: this.config.modelName || 'gemini-pro',
            messages,
            maxTokens: this.defaultConfig.maxOutputTokens,
            ...this.defaultConfig,
            _vertex: {
                instances: [{
                    messages: messages.map(m => ({
                        author: m.role,
                        content: m.content
                    }))
                }],
                parameters: this.defaultConfig
            }
        };
    }

    public parseResponse(response: any): BaseResponse {
        try {
            const content = response.predictions?.[0]?.candidates?.[0]?.content;
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
            throw new Error(`Failed to parse Vertex AI response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Vertex AI';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Vertex AI';
        }
        return null;
    }

    public extractError(error: any): string {
        const message = 
            error.error?.message ||
            error.response?.data?.error?.message ||
            error.message ||
            'Unknown error occurred';
        return message;
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Vertex AI');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'x-goog-user-project': this.extractProjectId(),
            'x-goog-api-key': this.config.apiKey
        };
    }

    private extractProjectId(): string {
        const match = this.config.endpoint?.match(/projects\/([^/]+)/);
        return match?.[1] || '';
    }
}
