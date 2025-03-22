import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';
import { BaseLLMService } from '../baseService';

export class OpenAIAdapter extends BaseAdapter {
    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.openai,
            modelName: config.modelName || 'gpt-4-turbo'
        });
        this.provider = {
            name: 'openai',
            requestFormat: {
                url: '/v1/chat/completions',
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

    public formatRequest(prompt: string): RequestBody {
        return {
            model: this.config.modelName || 'gpt-4-turbo',
            messages: [
                {
                    role: 'system',
                    content: BaseLLMService.SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };
    }

    public parseResponse(response: any): BaseResponse {
        try {
            const content = response.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('Invalid response format: missing content');
            }
            
            // Try to extract JSON from the content
            let jsonContent;
            try {
                jsonContent = this.extractJsonFromContent(content);
            } catch (jsonError) {
                console.error('JSON extraction error:', jsonError);
                
                // Fallback: Try to parse the content directly if it might be JSON already
                try {
                    if (typeof content === 'string' && (content.trim().startsWith('{') && content.trim().endsWith('}'))) {
                        jsonContent = JSON.parse(content);
                    }
                } catch (directParseError) {
                    console.error('Direct JSON parse error:', directParseError);
                }
                
                // If still no valid JSON, try to extract tags manually
                if (!jsonContent) {
                    // Extract hashtags from the content
                    const hashtagRegex = /#[\p{L}\p{N}-]+/gu;
                    const hashtags = content.match(hashtagRegex) || [];
                    
                    return {
                        matchedExistingTags: [],
                        suggestedTags: hashtags
                    };
                }
            }
            
            // Check if the expected arrays exist
            if (!Array.isArray(jsonContent?.matchedTags) && !Array.isArray(jsonContent?.newTags)) {
                // Try alternative field names that might be used
                const matchedTags = Array.isArray(jsonContent?.matchedExistingTags) ? 
                    jsonContent.matchedExistingTags : 
                    Array.isArray(jsonContent?.existingTags) ? 
                        jsonContent.existingTags : [];
                
                const newTags = Array.isArray(jsonContent?.suggestedTags) ? 
                    jsonContent.suggestedTags : 
                    Array.isArray(jsonContent?.generatedTags) ? 
                        jsonContent.generatedTags : [];
                
                if (matchedTags.length > 0 || newTags.length > 0) {
                    return {
                        matchedExistingTags: matchedTags,
                        suggestedTags: newTags
                    };
                }
                
                // If we have a tags array but not separated into matched/new
                if (Array.isArray(jsonContent?.tags)) {
                    return {
                        matchedExistingTags: [],
                        suggestedTags: jsonContent.tags
                    };
                }
            }
            
            return {
                matchedExistingTags: jsonContent.matchedTags || [],
                suggestedTags: jsonContent.newTags || []
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse OpenAI response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for OpenAI';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for OpenAI';
        }
        return null;
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for OpenAI');
        }
        return {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };
    }
}
