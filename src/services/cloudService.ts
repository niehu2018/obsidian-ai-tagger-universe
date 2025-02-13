import { LLMResponse, LLMServiceConfig, ConnectionTestResult, ConnectionTestError } from './types';
import { BaseLLMService } from './baseService';

export class CloudLLMService extends BaseLLMService {
    private apiKey: string;

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

    async testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }> {
        try {
            const validationError = this.validateCloudConfig();
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
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            console.log('Testing connection with endpoint:', this.endpoint);

            const response = await fetch(this.endpoint, {
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
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseText = await response.text();
            console.log('Cloud API test response:', responseText);

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

            console.error('Cloud API test error:', error);
            return {
                result: ConnectionTestResult.Failed,
                error: testError
            };
        }
    }

    async analyzeTags(content: string, existingTags: string[]): Promise<LLMResponse> {
        try {
            const validationError = this.validateCloudConfig();
            if (validationError) {
                throw new Error(validationError);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(this.endpoint, {
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
                            content: this.buildPrompt(content, existingTags)
                        }
                    ]
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseText = await response.text();
            console.log('Cloud API response:', responseText);

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