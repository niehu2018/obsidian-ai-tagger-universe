import { LLMServiceConfig, LLMResponse, ConnectionTestResult, ConnectionTestError } from './types';

export abstract class BaseLLMService {
    protected endpoint: string;
    protected modelName: string;

    constructor(config: LLMServiceConfig) {
        this.endpoint = config.endpoint.trim();
        this.modelName = config.modelName.trim();
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
        const tagRegex = /^#[a-zA-Z0-9-]+$/;
        return tagRegex.test(tag);
    }

    protected validateTags(tags: string[]): string[] {
        const validatedTags: string[] = [];
        const errors: string[] = [];

        for (const tag of tags) {
            if (!this.validateTag(tag)) {
                errors.push(`Invalid tag format: ${tag}`);
                continue;
            }
            validatedTags.push(tag);
        }

        if (errors.length > 0) {
            throw new Error(`Tag validation errors:\n${errors.join('\n')}`);
        }

        if (validatedTags.length === 0) {
            throw new Error('No valid tags found in response');
        }

        return validatedTags;
    }

    protected extractJSONFromResponse(response: string): string {
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
        throw new Error('No valid JSON found in response');
    }

    protected buildPrompt(content: string, existingTags: string[]): string {
        return `Analyze the following content and:
1. Match 1-3 most relevant tags from existing tags
2. Generate 3-10 new relevant tags

Requirements for tags:
- Must start with # symbol
- Can only contain letters, numbers, and hyphens
- No spaces allowed
- Example format: #technology, #artificial-intelligence, #coding

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
