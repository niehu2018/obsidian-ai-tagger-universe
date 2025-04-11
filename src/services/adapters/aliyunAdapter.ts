import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class AliyunAdapter extends BaseAdapter {
    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.aliyun,
            modelName: config.modelName || 'qwen-max'
        });
        this.provider = {
            name: 'aliyun',
            requestFormat: {
                body: {
                    model: this.config.modelName || 'qwen-max'
                }
            },
            responseFormat: {
                path: ['choices', '0', 'message', 'content'],
                errorPath: ['error', 'message']
            }
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
                //console.error('JSON extraction error:', jsonError);
                
                // Fallback: Try to parse the content directly if it might be JSON already
                try {
                    if (typeof content === 'string' && (content.trim().startsWith('{') && content.trim().endsWith('}'))) {
                        jsonContent = JSON.parse(content);
                    }
                } catch (directParseError) {
                    //console.error('Direct JSON parse error:', directParseError);
                }
                
                // If still no valid JSON, try to extract tags manually
                if (!jsonContent) {
                    // Extract hashtags from the content
                    const hashtagRegex = /#[\p{L}\p{N}-]+/gu;
                    const hashtags = content.match(hashtagRegex) || [];
                    
                    return {
                        text: content,
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
                        text: content,
                        matchedExistingTags: matchedTags,
                        suggestedTags: newTags
                    };
                }
                
                // If we have a tags array but not separated into matched/new
                if (Array.isArray(jsonContent?.tags)) {
                    return {
                        text: content,
                        matchedExistingTags: [],
                        suggestedTags: jsonContent.tags
                    };
                }
                
                throw new Error('Invalid response format: missing required arrays');
            }
            
            return {
                text: content,
                matchedExistingTags: jsonContent.matchedTags || [],
                suggestedTags: jsonContent.newTags || []
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Aliyun response: ${message}`);
        }
    }
    
    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Aliyun';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Aliyun';
        }
        return null;
    }

    public extractError(error: any): string {
        if (error.response?.data?.error?.message) {
            return error.response.data.error.message;
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
