import { BaseAdapter } from './baseAdapter';
import { AdapterConfig, RequestBody } from './types';
import { BaseLLMService } from "../baseService";
import * as endpoints from './cloudEndpoints.json';

export class ClaudeAdapter extends BaseAdapter {
    private readonly anthropicVersion = '2023-06-01';

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.claude,
            modelName: config.modelName || 'claude-3-opus-20240229'
        });
        this.provider = {
            name: 'claude',
            requestFormat: {
                url: '/v1/messages',
                headers: {
                    'anthropic-version': this.anthropicVersion
                },
                body: {
                    model: this.config.modelName,
                    messages: [],
                    max_tokens: 1024
                }
            },
            responseFormat: {
                path: ['content', '0', 'text'],
                errorPath: ['error', 'message']
            }
        };
    }

    getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Claude');
        }
        return {
            'Content-Type': 'application/json',
            'anthropic-version': this.anthropicVersion,
            'x-api-key': this.config.apiKey
        };
    }
    
    formatRequest(prompt: string): RequestBody {
        return {
            model: this.config.modelName,
            messages: [
                {
                    role: 'system',
                    content: BaseLLMService.SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1024
        };
    }
    
    parseResponse(response: any): any {
        if (!response || !response.content || !Array.isArray(response.content)) {
            throw new Error('Invalid response structure from Claude API');
        }

        try {
            const content = response.content[0]?.text;
            if (!content) {
                throw new Error('No content found in Claude response');
            }

            // Let base class handle parsing and tag extraction
            return super.parseResponse({ content: [{ text: content }] });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Claude response: ${message}`);
        }
    }
}
