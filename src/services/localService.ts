import { LLMResponse, LLMServiceConfig, ConnectionTestResult, ConnectionTestError } from './types';
import { SYSTEM_PROMPT } from '../utils/constants';
import { BaseLLMService } from './baseService';
import { TaggingMode } from './prompts/types';
import { LanguageCode } from './types';
import { App } from 'obsidian';

export class LocalLLMService extends BaseLLMService {
    private readonly MAX_CONTENT_LENGTH = 4000;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second
    
    constructor(config: LLMServiceConfig, app: App) {
        super(config, app);
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

    /**
     * Analyzes content and returns tag suggestions
     * @param content - Content to analyze
     * @param existingTags - Array of existing tags to consider
     * @param mode - Tagging mode
     * @param maxTags - Maximum number of tags to return
     * @param language - Language for generated tags
     * @returns Promise resolving to tag analysis result
     */
    async analyzeTags(content: string, existingTags: string[], mode: TaggingMode, maxTags: number, language?: LanguageCode): Promise<LLMResponse> {
        // Use the base class implementation
        return super.analyzeTags(content, existingTags, mode, maxTags, language);
    }

    /**
     * Sends a request to the LLM service and returns the response
     * @param prompt - The prompt to send
     * @returns Promise resolving to the response
     */
    protected async sendRequest(prompt: string): Promise<string> {
        const response = await this.makeRequestWithRetry({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.modelName,
                messages: [
                    {
                        role: 'system',
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3
            })
        }, this.TIMEOUT);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error ${response.status}: ${errorText || response.statusText}`);
        }

        const data = await response.json();
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            throw new Error('Invalid response format from service');
        }

        return data.choices[0]?.message?.content || '';
    }

    /**
     * Gets the maximum content length for this service
     * @returns Maximum content length
     */
    protected getMaxContentLength(): number {
        return this.MAX_CONTENT_LENGTH;
    }
}
