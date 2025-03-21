import { LLMResponse, LLMServiceConfig, ConnectionTestResult, ConnectionTestError } from './types';
import { BaseLLMService } from './baseService';
import { TaggingMode } from './prompts/tagPrompts';

export class LocalLLMService extends BaseLLMService {
    private readonly MAX_CONTENT_LENGTH = 8000; // Local models can handle more content
    private readonly MAX_RETRIES = 2; // Fewer retries for local service
    private readonly RETRY_DELAY = 500; // 0.5 second

    constructor(config: LLMServiceConfig) {
        super(config);
        // Ensure endpoint ends with standard chat completions path
        this.endpoint = this.normalizeEndpoint(config.endpoint);
        this.validateLocalConfig(); // Validate on construction
    }

    private normalizeEndpoint(endpoint: string): string {
        endpoint = endpoint.trim();
        // Remove trailing slash if present
        endpoint = endpoint.replace(/\/$/, '');
        // Convert Ollama format to standard format if needed
        if (endpoint.endsWith('/api/generate')) {
            endpoint = endpoint.replace('/api/generate', '/v1/chat/completions');
        }
        // Add standard path if not present
        if (!endpoint.endsWith('/v1/chat/completions')) {
            endpoint = `${endpoint}/v1/chat/completions`;
        }
        return endpoint;
    }

    private validateLocalConfig(): string | null {
        const baseError = this.validateConfig();
        if (baseError) return baseError;

        try {
            const url = new URL(this.endpoint);
            if (!url.pathname.endsWith('/v1/chat/completions')) {
                return "Invalid endpoint format. Should end with /v1/chat/completions";
            }
        } catch {
            return "Invalid endpoint URL format";
        }

        return null;
    }

    private async makeRequest(options: RequestInit, timeoutMs: number): Promise<Response> {
        try {
            const { controller, cleanup } = this.createRequestController(timeoutMs);
            try {
                const response = await fetch(this.endpoint, {
                    ...options,
                    signal: controller.signal
                });
                return response;
            } finally { cleanup(); }
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timed out. Please check if your local LLM service is running and responsive.');
                }
            }
            throw error;
        }
    }

    private async makeRequestWithRetry(options: RequestInit, timeoutMs: number): Promise<Response> {
        let lastError: Error | null = null;

        for (let i = 0; i < this.MAX_RETRIES; i++) {
            try {
                const response = await this.makeRequest(options, timeoutMs);
                
                // For local service, we might want to retry on any error
                // as it could be starting up or processing another request
                if (response.ok) {
                    return response;
                }

                // Read the error response
                const errorText = await response.text();
                lastError = new Error(
                    `HTTP error ${response.status}: ${
                        errorText || response.statusText
                    }`
                );
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
            }

            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
        }

        throw lastError || new Error('Max retries exceeded');
    }

    async testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }> {
        try {
            // Validate configuration first
            const validationError = this.validateLocalConfig();
            if (validationError) {
                return {
                    result: ConnectionTestResult.Failed,
                    error: {
                        type: "network",
                        message: validationError
                    }
                };
            }

            const response = await this.makeRequestWithRetry({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [{
                        role: 'system',
                        content: 'Simple connection test'
                    }, {
                        role: 'user',
                        content: 'Hello'
                    }],
                    max_tokens: 5
                })
            }, 10000);

            const responseText = await response.text();
            try {
                const data = JSON.parse(responseText);

                if (!data.choices || !Array.isArray(data.choices)) {
                    throw new Error('Invalid response format');
                }
            } catch (parseError) {
                throw new Error('Failed to parse response from local service');
            }

            return { result: ConnectionTestResult.Success };
        } catch (error) {

            let testError: ConnectionTestError = {
                type: "unknown",
                message: "Unknown error"
            };

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    testError = {
                        type: "timeout",
                        message: "Connection timeout, please check if the local LLM service is running"
                    };
                } else if (error.message.includes('Failed to fetch')) {
                    testError = {
                        type: "network",
                        message: "Network error, please check if the local service is accessible"
                    };
                } else if (error.message.includes('HTTP error')) {
                    testError = {
                        type: "network",
                        message: `Service error: ${error.message}`
                    };
                } else if (error.message.includes('Invalid response')) {
                    testError = {
                        type: "unknown",
                        message: "Invalid response format from local service"
                    };
                }
            }

            return {
                result: ConnectionTestResult.Failed,
                error: testError
            };
        }
    }

    async analyzeTags(content: string, existingTags: string[], mode: TaggingMode, maxTags: number, language?: 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru'): Promise<LLMResponse> {
        try {
            // Validate content
            if (!content.trim()) {
                throw new Error('Empty content provided for analysis');
            }

            // Truncate if too long
            if (content.length > this.MAX_CONTENT_LENGTH) {
                content = content.slice(0, this.MAX_CONTENT_LENGTH) + '...';
            }

            // Handle hybrid modes by making separate calls for each component mode
            if (mode === TaggingMode.HybridGenerateExisting) {
                // First generate new tags
                const generateResult = await this.analyzeTagsInternal(content, existingTags, TaggingMode.GenerateNew, maxTags / 2, language);
                
                // Then match existing tags
                const matchResult = await this.analyzeTagsInternal(content, existingTags, TaggingMode.ExistingTags, maxTags / 2, language);
                
                // Combine results and remove duplicates
                const suggestedTags = generateResult.suggestedTags;
                const matchedExistingTags = matchResult.matchedExistingTags;
                
                // Remove any tags from suggestedTags that also appear in matchedExistingTags
                const uniqueSuggestedTags = suggestedTags.filter(tag => !matchedExistingTags.includes(tag));
                
                return {
                    suggestedTags: uniqueSuggestedTags,
                    matchedExistingTags: matchedExistingTags
                };
            } else if (mode === TaggingMode.HybridGeneratePredefined) {
                // First generate new tags
                const generateResult = await this.analyzeTagsInternal(content, existingTags, TaggingMode.GenerateNew, maxTags / 2, language);
                
                // Then match predefined tags
                const matchResult = await this.analyzeTagsInternal(content, existingTags, TaggingMode.PredefinedTags, maxTags / 2, language);
                
                // Combine results and remove duplicates
                const suggestedTags = generateResult.suggestedTags;
                const matchedExistingTags = matchResult.matchedExistingTags;
                
                // Remove any tags from suggestedTags that also appear in matchedExistingTags
                const uniqueSuggestedTags = suggestedTags.filter(tag => !matchedExistingTags.includes(tag));
                
                return {
                    suggestedTags: uniqueSuggestedTags,
                    matchedExistingTags: matchedExistingTags
                };
            } else {
                // Handle non-hybrid modes directly
                return await this.analyzeTagsInternal(content, existingTags, mode, maxTags, language);
            }
        } catch (error) {
            return this.handleError(error, 'Tag analysis');
        }
    }

    private async analyzeTagsInternal(content: string, existingTags: string[], mode: TaggingMode, maxTags: number, language?: 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru'): Promise<LLMResponse> {
        const prompt = this.buildPrompt(content, existingTags, mode, maxTags, language);
        if (!prompt.trim()) {
            throw new Error('Failed to build analysis prompt');
        }

        const response = await this.makeRequestWithRetry({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.modelName,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional document tag analyst. Analyze content and suggest relevant tags.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3  // Lower temperature for more focused responses
            })
        }, 30000);

        const responseText = await response.text();
        try {
            const data = JSON.parse(responseText);
            const textToAnalyze = data.choices?.[0]?.message?.content;
            
            if (textToAnalyze) {
                return this.parseResponse(textToAnalyze, mode, maxTags);
            } else {
                throw new Error('Missing response content');
            }
        } catch {
            throw new Error('Invalid response format from local service');
        }
    }
}
