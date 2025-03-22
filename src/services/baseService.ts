import { LLMServiceConfig, LLMResponse, ConnectionTestResult, ConnectionTestError } from './types';
import { buildTagPrompt, TaggingMode } from './prompts/tagPrompts';

import { LanguageCode } from './types';

/**
 * Base class for LLM service implementations
 * Provides common functionality for tag analysis and request handling
 */
export abstract class BaseLLMService {
    protected static readonly SYSTEM_PROMPT = 'You are a professional document tag analysis assistant.';
    protected endpoint: string;
    protected modelName: string;
    protected readonly TIMEOUT = 30000; // 30 seconds timeout
    private activeRequests = new Set<{ controller: AbortController; timeoutId?: NodeJS.Timeout }>();

    /**
     * Creates a new LLM service instance
     * @param config - Configuration for the LLM service
     */
    constructor(config: LLMServiceConfig) {
        this.endpoint = config.endpoint.trim();
        this.modelName = config.modelName.trim();
    }

    /**
     * Registers an active request for cleanup
     * @param controller - AbortController for the request
     * @param timeoutId - Optional timeout ID
     * @returns Cleanup function
     */
    protected registerRequest(controller: AbortController, timeoutId?: NodeJS.Timeout): () => void {
        const request = { controller, timeoutId };
        this.activeRequests.add(request);
        return () => {
            if (request.timeoutId) {
                clearTimeout(request.timeoutId);
            }
            this.activeRequests.delete(request);
        };
    }

    /**
     * Creates an AbortController with timeout for a request
     * @param timeoutMs - Timeout in milliseconds
     * @returns Controller and cleanup function
     */
    protected createRequestController(timeoutMs: number): { controller: AbortController; cleanup: () => void } {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort(new Error('Request timeout'));
        }, timeoutMs);
        const cleanup = this.registerRequest(controller, timeoutId);
        return { controller, cleanup };
    }

    /**
     * Cleans up all active requests
     * Should be called when the service is no longer needed
     */
    public async dispose(): Promise<void> {
        // Cancel all active requests
        this.activeRequests.forEach(request => {
            if (request.timeoutId) {
                clearTimeout(request.timeoutId);
            }
            request.controller.abort(new Error('Service disposed'));
        });
        this.activeRequests.clear();
    }

    /**
     * Validates the service configuration
     * @returns Error message if invalid, null if valid
     */
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

    /**
     * Validates a single tag format
     * @param tag - Tag to validate
     * @returns True if valid, false otherwise
     */
    protected validateTag(tag: string): boolean {
        if (typeof tag !== 'string' || !tag) return false;
        // Must start with # and contain only letters, numbers, and hyphens
        const tagRegex = /^#[\p{Letter}\p{Number}-]+$/u;
        return tagRegex.test(tag) && !tag.endsWith('-');
    }

    /**
     * Validates an array of tags
     * @param tags - Array of tags to validate
     * @returns Validated tags array
     * @throws Error if any tags are invalid
     */
    protected validateTags(tags: string[]): string[] {
        if (!Array.isArray(tags) || tags.length === 0) {
            throw new Error('No tags provided for validation');
        }

        const invalidTag = tags.find(tag => !this.validateTag(tag));
        if (invalidTag) {
            throw new Error(`Invalid tag format: ${invalidTag} (must start with # and contain only letters, numbers, and hyphens)`);
        }

        return [...new Set(tags)]; // Remove duplicates
    }

    /**
     * Extracts JSON content from an LLM response
     * @param response - Raw response from LLM
     * @param retryCount - Number of retries attempted
     * @returns Extracted JSON string
     * @throws Error if no valid JSON found
     */
    protected extractJSONFromResponse(response: string, retryCount = 0): string {
        // Try to find JSON content within markdown code blocks
        const markdownJsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
        const markdownMatch = response.match(markdownJsonRegex);
        if (markdownMatch) {
            try {
                // Validate JSON is parseable
                JSON.parse(markdownMatch[1]);
                return markdownMatch[1];
            } catch {
                // Continue to next attempt if JSON is invalid
            }
        }

        // Try to find standalone JSON object
        const jsonRegex = /\{[\s\S]*\}/;
        const jsonMatch = response.match(jsonRegex);
        if (jsonMatch) {
            try {
                // Validate JSON is parseable
                JSON.parse(jsonMatch[0]);
                return jsonMatch[0];
            } catch {
                // Continue to next attempt if JSON is invalid
            }
        }
        
        // If we can't find JSON, try to manually construct it from the response
        if (retryCount === 0) {
            return this.extractJSONFromResponse(response.replace(/\n/g, ' '), 1);
        } else if (retryCount === 1) {
            // Try to extract tags directly if JSON parsing fails
            const tags = new Set<string>();
            
            // Look for hashtags in the response
            const hashtagRegex = /#[\p{Letter}\p{Number}-]+/gu;
            const hashtags = response.match(hashtagRegex);
            if (hashtags) {
                hashtags.forEach(tag => {
                    if (this.validateTag(tag)) {
                        tags.add(tag);
                    }
                });
            }
            
            // Look for any words that might be tags (without the # symbol)
            const potentialTagsRegex = /["']([a-zA-Z0-9-]+)["']/g;
            let match;
            while ((match = potentialTagsRegex.exec(response)) !== null) {
                const tag = `#${match[1]}`;
                if (this.validateTag(tag)) {
                    tags.add(tag);
                }
            }
            
            if (tags.size > 0) {
                // Construct a JSON object with the extracted tags
                return JSON.stringify({
                    matchedTags: [],
                    newTags: Array.from(tags)
                });
            }
        }
        
        console.error('Failed to extract JSON from response:', response);
        throw new Error('No valid JSON or tags found in response');
    }

    /**
     * Builds a prompt for tag analysis
     * @param content - Content to analyze
     * @param candidateTags - Array of candidate tags
     * @param mode - Tagging mode
     * @param maxTags - Maximum number of tags to return
     * @param language - Language for tag analysis
     * @returns Formatted prompt string
     */
    protected buildPrompt(
        content: string, 
        candidateTags: string[], 
        mode: TaggingMode,
        maxTags: number,
        language?: LanguageCode
    ): string {
        // For hybrid modes, we'll handle this in the service implementation
        // by making separate calls for each component mode
        if (mode === TaggingMode.HybridGenerateExisting || mode === TaggingMode.HybridGeneratePredefined) {
            return '';
        }
        
        return buildTagPrompt(content, candidateTags, mode, maxTags, language);
    }

    /**
     * Parses and validates LLM response
     * @param response - Raw response from LLM
     * @param mode - Tagging mode
     * @param maxTags - Maximum number of tags to return
     * @returns Parsed and validated response
     * @throws Error if response is invalid
     */
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
                        throw new Error('Response missing matchedTags field or not an array');
                    }
                    
                    // Apply tag limit and validate
                    const validatedMatchedTags = this.validateTags(
                        parsed.matchedTags.slice(0, maxTags)
                    );
                    
                    return {
                        matchedExistingTags: validatedMatchedTags,
                        suggestedTags: []
                    };

                case TaggingMode.GenerateNew:
                    if (!Array.isArray(parsed?.newTags)) {
                        throw new Error('Response missing newTags field or not an array');
                    }
                    
                    // Apply tag limit and validate
                    const validatedNewTags = this.validateTags(
                        parsed.newTags.slice(0, maxTags)
                    );
                    
                    return {
                        matchedExistingTags: [],
                        suggestedTags: validatedNewTags
                    };

                case TaggingMode.HybridGenerateExisting:
                case TaggingMode.HybridGeneratePredefined:
                    // All hybrid modes expect both matchedTags and newTags
                    if (!Array.isArray(parsed?.matchedTags) || !Array.isArray(parsed?.newTags)) {
                        throw new Error('Response missing required fields for hybrid mode');
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
            throw new Error(`Invalid response format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handles errors consistently across the service
     * @param error - Error to handle
     * @param operation - Operation that failed
     * @throws Error with consistent format
     */
    protected handleError(error: unknown, operation: string): never {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error(`Operation timed out: ${operation}`);
            }
            throw new Error(`${operation} failed: ${error.message}`);
        }
        throw new Error(`${operation} failed with unknown error`);
    }

    /**
     * Analyzes content and generates tags
     * Must be implemented by derived classes
     * @param content - Content to analyze
     * @param candidateTags - Array of candidate tags
     * @param mode - Tagging mode
     * @param maxTags - Maximum number of tags to return
     * @returns Promise resolving to tag analysis result
     */
    abstract analyzeTags(
        content: string, 
        candidateTags: string[], 
        mode?: TaggingMode,
        maxTags?: number
    ): Promise<LLMResponse>;
    
    /**
     * Tests connection to the LLM service
     * Must be implemented by derived classes
     * @returns Promise resolving to connection test result
     */
    abstract testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }>;
}
