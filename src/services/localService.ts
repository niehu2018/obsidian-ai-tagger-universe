import { LLMResponse, LLMServiceConfig, ConnectionTestResult, ConnectionTestError } from './types';
import { BaseLLMService } from './baseService';

export class LocalLLMService extends BaseLLMService {
    constructor(config: LLMServiceConfig) {
        super(config);
        // Ensure endpoint ends with standard chat completions path
        this.endpoint = this.normalizeEndpoint(config.endpoint);
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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            //console.log('Testing local LLM connection with endpoint:', this.endpoint);

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [{
                        role: 'user',
                        content: 'Test connection'
                    }],
                    max_tokens: 5
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseText = await response.text();
            //console.log('Local LLM test response:', responseText);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            try {
                const data = JSON.parse(responseText);
                if (!data.choices || !Array.isArray(data.choices)) {
                    throw new Error('Invalid response format');
                }
            } catch (parseError) {
                .error('Parse error:', parseError);
                throw new Error('Invalid response format');
            }

            return { result: ConnectionTestResult.Success };
        } catch (error) {
            console.error('Local LLM connection test error:', error);

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

    async analyzeTags(content: string, existingTags: string[]): Promise<LLMResponse> {
        try {
            // Validate configuration first
            const validationError = this.validateLocalConfig();
            if (validationError) {
                throw new Error(validationError);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a professional document tag analysis assistant. You need to analyze content and suggest relevant tags.'
                        },
                        {
                            role: 'user',
                            content: this.buildPrompt(content, existingTags)
                        }
                    ],
                    temperature: 0.3  // Lower temperature for more focused responses
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseText = await response.text();
            //console.log('Local LLM response:', responseText);

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            try {
                const data = JSON.parse(responseText);
                const textToAnalyze = data.choices?.[0]?.message?.content;
                if (!textToAnalyze) {
                    throw new Error('Missing response content');
                }
                return this.parseResponse(textToAnalyze);
            } catch (parseError) {
                console.error('Parse error:', parseError, 'Response:', responseText);
                throw new Error('Invalid response format from local service');
            }
        } catch (error) {
            return this.handleError(error, 'Tag analysis');
        }
    }
}
