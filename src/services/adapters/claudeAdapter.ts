import { BaseAdapter } from './baseAdapter';
import { AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';
import { SYSTEM_PROMPT } from '../../utils/constants';

export class ClaudeAdapter extends BaseAdapter {
    private readonly anthropicVersion = '2023-06-01';

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.claude,
            modelName: config.modelName || 'claude-sonnet-4-5-20250929'
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

    /**
     * Formats a request for Claude's Messages API
     * Claude requires 'system' as a separate parameter, not in messages array
     */
    public formatRequest(prompt: string, language?: string): any {
        return {
            model: this.config.modelName,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: prompt }
            ]
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
}
