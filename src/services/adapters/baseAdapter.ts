import { BaseLLMService } from "../baseService";
import { AdapterConfig } from "./types";
import { TaggingMode } from "../prompts/tagPrompts";

export abstract class BaseAdapter extends BaseLLMService {
    protected config: AdapterConfig;
    protected provider: any;

    public formatRequest(prompt: string, language?: string): any {
        if (!this.provider?.requestFormat?.body) {
            throw new Error('Provider request format not configured');
        }

        const systemPrompt = language
            ? `You are a professional document tag analysis assistant. Please analyze and generate tags in ${language} language.`
            : 'You are a professional document tag analysis assistant.';

        return {
            ...this.provider.requestFormat.body,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ]
        };
    }

    public parseResponse(response: any): any {
        if (!this.provider?.responseFormat?.path) {
            throw new Error('Provider response format not configured');
        }

        try {
            if (response.error && this.provider.responseFormat.errorPath) {
                let errorMsg = response;
                for (const key of this.provider.responseFormat.errorPath) {
                    errorMsg = errorMsg[key];
                }
                throw new Error(errorMsg || 'Unknown error');
            }

            let result = response;
            for (const key of this.provider.responseFormat.path) {
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid response structure');
                }
                result = result[key];
            }

            // Extract JSON from content if needed
            if (typeof result === 'string') {
                try {
                    result = this.extractJsonFromContent(result);
                } catch (error) {
                    console.error('Failed to parse JSON from response:', error);
                    // If JSON parsing fails, try to extract tags directly
                    const tags = this.extractTagsFromText(result);
                    result = {
                        matchedTags: [],
                        newTags: tags
                    };
                }
            }

            // Ensure both matchedTags and newTags are arrays of strings
            if (result.matchedTags && !Array.isArray(result.matchedTags)) {
                result.matchedTags = [];
            }
            if (result.newTags && !Array.isArray(result.newTags)) {
                result.newTags = [];
            }

            result.matchedTags = (result.matchedTags || []).map((tag: any) => String(tag).trim());
            result.newTags = (result.newTags || []).map((tag: any) => String(tag).trim());

            return result;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse response: ${message}`);
        }
    }

    private extractTagsFromText(text: string): string[] {
        // Look for hashtags in the response
        const hashtagRegex = /#[\p{L}\p{N}-]+/gu;
        const hashtags = text.match(hashtagRegex) || [];
        
        if (hashtags.length > 0) {
            return hashtags;
        }
        
        // If no hashtags found, look for potential tags in quotes or lists
        const potentialTagsRegex = /["']([a-zA-Z0-9-]+)["']|\s+[-*]\s+([a-zA-Z0-9-]+)/g;
        const potentialTags: string[] = [];
        let match;
        
        while ((match = potentialTagsRegex.exec(text)) !== null) {
            const tag = match[1] || match[2];
            if (tag) {
                potentialTags.push(`#${tag}`);
            }
        }
        
        return potentialTags;
    }

    public validateConfig(): string | null {
        return super.validateConfig();
    }

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint ?? "",
            modelName: config.modelName ?? ""
        });
        this.config = config;
    }

    async analyzeTags(content: string, existingTags: string[]): Promise<any> {
        const prompt = this.buildPrompt(content, existingTags, TaggingMode.HybridGenerateExisting, 10, this.config.language);
        const response = await this.makeRequest(prompt);
        return this.parseResponse(response);
    }

    async testConnection(): Promise<{ result: any; error?: any }> {
        try {
            const response = await this.makeRequest('test');
            return { result: { success: true } };
        } catch (error) {
            return { result: { success: false }, error };
        }
    }

    protected async makeRequest(prompt: string): Promise<any> {
        const headers = this.getHeaders();
        const body = this.formatRequest(prompt, this.config.language);
        
        const response = await fetch(this.getEndpoint(), {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    getEndpoint(): string {
        return this.config.endpoint ?? "";
    }

    getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json'
        };
    }

    protected extractJsonFromContent(content: string): any {
        try {
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            const standaloneJson = content.match(/\{[\s\S]*\}/);
            if (standaloneJson) {
                return JSON.parse(standaloneJson[0]);
            }
            throw new Error('No JSON found in response');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse JSON: ${message}`);
        }
    }
}
