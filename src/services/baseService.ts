import { LLMServiceConfig, LLMResponse, ConnectionTestResult, ConnectionTestError } from './types';
import { buildTagPrompt, TaggingMode } from './prompts/tagPrompts';

export abstract class BaseLLMService {
    protected endpoint: string;
    protected modelName: string;
    protected readonly TIMEOUT = 30000; // 30 seconds timeout
    private activeRequests = new Set<{ controller: AbortController; timeoutId?: NodeJS.Timeout }>();

    constructor(config: LLMServiceConfig) {
        this.endpoint = config.endpoint.trim();
        this.modelName = config.modelName.trim();
    }

    protected registerRequest(controller: AbortController, timeoutId?: NodeJS.Timeout) {
        const request = { controller, timeoutId };
        this.activeRequests.add(request);
        return () => {
            if (request.timeoutId) {
                clearTimeout(request.timeoutId);
            }
            this.activeRequests.delete(request);
        };
    }

    protected createRequestController(timeoutMs: number): { controller: AbortController; cleanup: () => void } {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const cleanup = this.registerRequest(controller, timeoutId);
        return { controller, cleanup };
    }

    public async dispose(): Promise<void> {
        // Cancel all active requests
        this.activeRequests.forEach(request => {
            if (request.timeoutId) {
                clearTimeout(request.timeoutId);
            }
            request.controller.abort();
        });
        this.activeRequests.clear();
    }

    protected validateConfig(): string | null {
        if (!this.endpoint) {
            return "API endpoint is not configured";
        }
        if (!this.modelName) {
            return "Model name is not configured";
        }
        
        try {
            new URL(this.endpoint);
        } catch {
            return "Invalid API endpoint URL format";
        }

        return null;
    }

    protected validateTag(tag: string): boolean {
        // Must start with # and contain only letters, numbers, and hyphens
        const tagRegex = /^#[\p{L}\p{N}-]+$/u;
        return tagRegex.test(tag);
    }

    protected validateTags(tags: string[]): string[] {
        if (!Array.isArray(tags) || tags.length === 0) {
            throw new Error('No tags provided for validation');
        }

        const invalidTag = tags.find(tag => !this.validateTag(tag));
        if (invalidTag) {
            throw new Error(`Invalid tag format: ${invalidTag}`);
        }

        return [...tags];
    }

    protected extractJSONFromResponse(response: string, retryCount = 0): string {
        // Try to find JSON content within markdown code blocks
        const markdownJsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
        const markdownMatch = response.match(markdownJsonRegex);
        if (markdownMatch) {
            return markdownMatch[1];
        }

        // Try to find standalone JSON object
        const jsonRegex = /\{[\s\S]*\}/;
        const jsonMatch = response.match(jsonRegex);
        if (jsonMatch) {
            return jsonMatch[0];
        }
        
        // If we can't find JSON, try to manually construct it from the response
        if (retryCount === 0) {
            return this.extractJSONFromResponse(response.replace(/\n/g, ' '), 1);
        } else if (retryCount === 1) {
            // Try to extract tags directly if JSON parsing fails
            
            // Look for hashtags in the response
            const hashtagRegex = /#[\p{L}\p{N}-]+/gu;
            const hashtags = response.match(hashtagRegex);
            
            if (hashtags && hashtags.length > 0) {
                // Construct a JSON object with the extracted tags
                return JSON.stringify({
                    matchedTags: [],
                    newTags: hashtags
                });
            }
            
            // Look for any words that might be tags (without the # symbol)
            const potentialTagsRegex = /["']([a-zA-Z0-9-]+)["']/g;
            const potentialMatches = [];
            let match;
            
            while ((match = potentialTagsRegex.exec(response)) !== null) {
                potentialMatches.push(`#${match[1]}`);
            }
            
            if (potentialMatches.length > 0) {
                // Construct a JSON object with the extracted tags
                return JSON.stringify({
                    matchedTags: [],
                    newTags: potentialMatches
                });
            }
        }
        
        console.error('Failed to extract JSON from response:', response);
        throw new Error('No valid JSON found in response');
    }

    protected buildPrompt(
        content: string, 
        candidateTags: string[], 
        mode: TaggingMode,
        maxTags: number,
        language?: 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru'
    ): string {
        return buildTagPrompt(content, candidateTags, mode, maxTags, language);
    }

    protected parseResponse(response: string, mode: TaggingMode, maxTags: number): LLMResponse {
        try {
            // Extract JSON from response
            const jsonContent = this.extractJSONFromResponse(response);

            // Parse the JSON
            const parsed = JSON.parse(jsonContent);

            // Validate based on mode
            switch (mode) {
                case TaggingMode.PredefinedTags:
                case TaggingMode.ExistingTags:
                    if (!Array.isArray(parsed?.matchedTags)) {
                        console.error('Response missing matchedTags field or not an array:', parsed);
                        throw new Error('Response missing matchedTags field');
                    }
                    
                    // Apply tag limit
                    const limitedMatchedTags = parsed.matchedTags.length > maxTags 
                        ? parsed.matchedTags.slice(0, maxTags) 
                        : parsed.matchedTags;
                    
                    // Validate tags
                    const validatedMatchedTags = this.validateTags(limitedMatchedTags);
                    
                    return {
                        matchedExistingTags: validatedMatchedTags,
                        suggestedTags: []
                    };

                case TaggingMode.GenerateNew:
                    if (!Array.isArray(parsed?.newTags)) {
                        console.error('Response missing newTags field or not an array:', parsed);
                        throw new Error('Response missing newTags field');
                    }
                    
                    // Apply tag limit
                    const limitedNewTags = parsed.newTags.length > maxTags 
                        ? parsed.newTags.slice(0, maxTags) 
                        : parsed.newTags;
                    
                    // Validate tags
                    const validatedNewTags = this.validateTags(limitedNewTags);
                    
                    return {
                        matchedExistingTags: [],
                        suggestedTags: validatedNewTags
                    };

                case TaggingMode.Hybrid:
                    if (!Array.isArray(parsed?.matchedTags) || !Array.isArray(parsed?.newTags)) {
                        console.error('Response missing required fields for hybrid mode:', parsed);
                        throw new Error('Response missing required fields');
                    }
                    
                    const halfMaxTags = Math.floor(maxTags / 2);
                    const remainingTags = maxTags - halfMaxTags;

                    // Validate and slice tags
                    const hybridMatchedTags = this.validateTags(
                        parsed.matchedTags.slice(0, halfMaxTags)
                    );
                    const hybridNewTags = this.validateTags(
                        parsed.newTags.slice(0, remainingTags)
                    );

                    return {
                        matchedExistingTags: hybridMatchedTags,
                        suggestedTags: hybridNewTags
                    };

                default:
                    throw new Error(`Unsupported mode: ${mode}`);
            }
        } catch (error) {
            console.error('Error parsing LLM response:', error);
            
            if (error instanceof Error) {
                throw new Error(`Invalid response format: ${error.message}`);
            }
            throw new Error('Invalid response format');
        }
    }

    protected handleError(error: unknown, operation: string): never {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error(`Operation timed out: ${operation}`);
            }
            throw new Error(`${operation} failed: ${error.message}`);
        }
        throw error;
    }

    abstract analyzeTags(
        content: string, 
        candidateTags: string[], 
        mode?: TaggingMode,
        maxTags?: number
    ): Promise<LLMResponse>;
    
    abstract testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }>;
}
