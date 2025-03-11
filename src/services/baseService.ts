import { LLMServiceConfig, LLMResponse, ConnectionTestResult, ConnectionTestError } from './types';

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
        // 取消所有活跃的请求
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
        
        // Retry with more flexible regex if initial attempt fails
        if (retryCount === 0) {
            return this.extractJSONFromResponse(response.replace(/\n/g, ' '), 1);
        }
        throw new Error('No valid JSON found in response');
    }

    protected buildPrompt(content: string, existingTags: string[], language?: 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru'): string {
        const langInstructions = language ? `Please generate tags in ${language} language.` : '';
        return `Analyze the following content and:
1. Match 1-3 most relevant tags from existing tags
2. Generate 3-10 new relevant tags
${langInstructions}

Requirements for tags:
- Must start with # symbol
- Can contain letters, numbers, and hyphens
- No spaces allowed
- Example format: #technology, #artificial-intelligence, #coding
- Supports international characters: #技术, #인공지능, #프로그래밍

Existing tags:
${existingTags.join(', ')}

Content:
${content}

Return only a JSON object in this exact format:
{
    "matchedTags": ["#tag1", "#tag2"],
    "newTags": ["#tag1", "#tag2", "#tag3"]
}`;
    }

    protected parseResponse(response: string): LLMResponse {
        try {
            // Extract JSON from response
            const jsonContent = this.extractJSONFromResponse(response);

            // Parse the JSON
            const parsed = JSON.parse(jsonContent);

            if (!Array.isArray(parsed?.matchedTags) || !Array.isArray(parsed?.newTags)) {
                throw new Error('Response missing required fields');
            }

            // Validate all tags
            const validatedMatchedTags = this.validateTags(parsed.matchedTags);
            const validatedNewTags = this.validateTags(parsed.newTags);

            // Ensure no duplicates
            const uniqueTags = new Set([...validatedMatchedTags, ...validatedNewTags]);

            return {
                matchedExistingTags: validatedMatchedTags,
                suggestedTags: Array.from(new Set(validatedNewTags))
            };
        } catch (error) {
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

    abstract analyzeTags(content: string, existingTags: string[]): Promise<LLMResponse>;
    abstract testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }>;
}
