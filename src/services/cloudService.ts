import { LLMResponse, LLMServiceConfig, ConnectionTestResult, ConnectionTestError } from './types';
import { BaseLLMService } from './baseService';
import { AdapterType, createAdapter, BaseAdapter } from './adapters';
import { TaggingMode } from './prompts/types';
import { LanguageCode } from './types';
import { App } from 'obsidian';

export class CloudLLMService extends BaseLLMService {
    private adapter: BaseAdapter;
    private readonly MAX_CONTENT_LENGTH = 4000; // Reasonable limit for most APIs
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second

    constructor(config: Omit<LLMServiceConfig, 'type'> & { type: AdapterType }, app: App) {
        super(config, app);
        this.adapter = createAdapter(config.type, {
            endpoint: config.endpoint,
            apiKey: config.apiKey || '',
            modelName: config.modelName,
            language: config.language
        });
    }

    private validateCloudConfig(): string | null {
        const baseError = this.validateConfig();
        if (baseError) return baseError;

        const adapterError = this.adapter.validateConfig();
        if (adapterError) return adapterError;

        return null;
    }

    private async makeRequest(prompt: string, timeoutMs: number): Promise<Response> {
        try {
            const validationError = this.validateCloudConfig();
            if (validationError) {
                throw new Error(validationError);
            }

            const { controller, cleanup } = this.createRequestController(timeoutMs);
            try {
                const response = await fetch(this.adapter.getEndpoint(), {
                    method: 'POST',
                    headers: this.adapter.getHeaders(),
                    body: JSON.stringify(this.adapter.formatRequest(prompt)),
                    signal: controller.signal
                });
                return response;
            } finally { cleanup(); }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            throw error;
        }
    }

    private async makeRequestWithRetry(prompt: string, timeoutMs: number): Promise<Response> {
        let lastError: Error | null = null;
        
        for (let i = 0; i < this.MAX_RETRIES; i++) {
            try {
                const response = await this.makeRequest(prompt, timeoutMs);
                if (response.ok || response.status === 401) { // Don't retry auth errors
                    return response;
                }
                lastError = new Error(`HTTP error ${response.status}`);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (error instanceof Error && error.message.includes('Invalid API key')) {
                    throw error; // Don't retry auth errors
                }
            }
            
            if (i < this.MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
            }
        }
        
        throw lastError || new Error('Max retries exceeded');
    }

    async testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }> {
        try {
            const response = await this.makeRequestWithRetry('Connection test', 10000);
            
            const responseText = await response.text();

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication failed: Invalid API key');
                } else if (response.status === 404) {
                    throw new Error('API endpoint not found: Please verify the URL');
                }

                try {
                    const errorJson = JSON.parse(responseText);
                    throw new Error(errorJson.error?.message || errorJson.message || `HTTP error ${response.status}`);
                } catch {
                    throw new Error(`HTTP error ${response.status}: ${responseText}`);
                }
            }

            // Verify response format
            const data = JSON.parse(responseText);
            if (!data.choices || !Array.isArray(data.choices)) {
                throw new Error('Invalid API response format: missing choices array');
            }

            return { result: ConnectionTestResult.Success };
        } catch (error) {
            let testError: ConnectionTestError = {
                type: "unknown",
                message: "Unknown error occurred during connection test"
            };

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    testError = {
                        type: "timeout",
                        message: "Connection timeout: Please check your network status"
                    };
                } else if (error.message.includes('Failed to fetch')) {
                    testError = {
                        type: "network",
                        message: "Network error: Unable to reach the API endpoint"
                    };
                } else if (error.message.includes('Authentication failed')) {
                    testError = {
                        type: "auth",
                        message: "Authentication failed: Please verify your API key"
                    };
                } else if (error.message.includes('API endpoint not found')) {
                    testError = {
                        type: "network",
                        message: "API endpoint not found: Please verify the URL"
                    };
                } else {
                    testError = {
                        type: "unknown",
                        message: `Error: ${error.message}`
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
        const response = await this.makeRequestWithRetry(prompt, this.TIMEOUT);

        if (!response.ok) {
            const responseText = await response.text();
            try {
                const errorJson = JSON.parse(responseText);
                throw new Error(errorJson.error?.message || errorJson.message || `API error: ${response.status}`);
            } catch {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
        }

        const responseText = await response.text();
        try {
            const data = JSON.parse(responseText);
            // Try to get the completion content based on adapter or standard format
            const content = this.adapter.parseResponseContent(data);
            if (!content) {
                throw new Error('No content found in response');
            }
            return content;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Failed to parse response: ${responseText.substring(0, 100)}...`);
        }
    }

    /**
     * Gets the maximum content length for this service
     * @returns Maximum content length
     */
    protected getMaxContentLength(): number {
        return this.MAX_CONTENT_LENGTH;
    }
}
