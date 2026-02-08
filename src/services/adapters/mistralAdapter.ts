import { BaseAdapter } from './baseAdapter';
import { AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class MistralAdapter extends BaseAdapter {
    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.mistral,
            modelName: config.modelName || 'mistral-large-latest'
        });
        this.provider = {
            name: 'mistral',
            requestFormat: {
                body: {
                    model: this.config.modelName,
                    messages: [],
                    temperature: 0.7,
                    max_tokens: 1024
                }
            },
            responseFormat: {
                path: ['choices', '0', 'message', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Mistral AI');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
    }
}
