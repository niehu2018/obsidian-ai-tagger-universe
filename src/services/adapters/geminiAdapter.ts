import { BaseAdapter } from './baseAdapter';
import { AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class GeminiAdapter extends BaseAdapter {
    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.gemini,
            modelName: config.modelName || 'gemini-2.0-flash'
        });
        this.provider = {
            name: 'gemini',
            requestFormat: {
                url: '/chat/completions',
                body: {
                    model: this.config.modelName,
                    messages: [],
                    n: 1
                }
            },
            responseFormat: {
                path: ['choices', 0, 'message', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Gemini');
        }
        return {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

}
