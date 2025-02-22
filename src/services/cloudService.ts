import { LLMResponse, LLMServiceConfig, ConnectionTestResult, ConnectionTestError } from './types';
import { BaseLLMService } from './baseService';

export class CloudLLMService extends BaseLLMService {
    private apiKey: string;
    private readonly MAX_CONTENT_LENGTH = 4000; // Reasonable limit for most APIs
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second

    constructor(config: LLMServiceConfig) {
        super(config);
        this.apiKey = config.apiKey?.trim() || '';
    }

    private validateCloudConfig(): string | null {
        const baseError = this.validateConfig();
        if (baseError) return baseError;

        if (!this.apiKey) {
            return "API key is not configured";
        }

        if (!this.endpoint.toLowerCase().includes('/chat/completions')) {
            return "Cloud API endpoint should include '/chat/completions'";
        }

        return null;
    }

    private async makeRequest(options: RequestInit, timeoutMs: number): Promise<Response> {
        try {
            const validationError = this.validateCloudConfig();
            if (validationError) {
                throw new Error(validationError);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(this.endpoint, {
                    ...options,
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            throw error;
        }
    }

    private async makeRequestWithRetry(options: RequestInit, timeoutMs: number): Promise<Response> {
        let lastError: Error | null = null;
        
        for (let i = 0; i < this.MAX_RETRIES; i++) {
            try {
                const response = await this.makeRequest(options, timeoutMs);
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
            const response = await this.makeRequestWithRetry({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [
                        {
                            role: 'system',
                            content: 'Connection test'
                        }
                    ],
                    max_tokens: 5
                })
            }, 10000);
            
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

    async analyzeTags(content: string, existingTags: string[]): Promise<LLMResponse> {
        try {
            // Truncate content if too long
            if (content.length > this.MAX_CONTENT_LENGTH) {
                content = content.slice(0, this.MAX_CONTENT_LENGTH) + '...';
            }

            const prompt = this.buildPrompt(content, existingTags);

            // Validate that we have content to analyze
            if (!content.trim()) {
                throw new Error('Empty content provided for analysis');
            }

            // Validate that the prompt was built successfully
            if (!prompt.trim()) {
                throw new Error('Failed to build analysis prompt');
            }
            const response = await this.makeRequestWithRetry({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a professional document tag analysis assistant. You need to analyze document content, match relevant tags from existing ones, and generate new relevant tags.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            }, 30000);
            const responseText = await response.text();

            if (!response.ok) {
                try {
                    const errorJson = JSON.parse(responseText);
                    throw new Error(errorJson.error?.message || errorJson.message || `API error: ${response.status}`);
                } catch {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
            }

            const data = JSON.parse(responseText);
            if (!data.choices || !data.choices[0]?.message?.content) {
                throw new Error('Invalid API response format: missing message content');
            }

            return this.parseResponse(data.choices[0].message.content);
        } catch (error) {
            return this.handleError(error, 'Tag analysis');
        }
    }
}