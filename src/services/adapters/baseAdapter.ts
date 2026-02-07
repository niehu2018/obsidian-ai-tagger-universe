import { BaseLLMService } from "../baseService";
import { AdapterConfig, LLMServiceProvider } from "./types";
import { SYSTEM_PROMPT } from "../../utils/constants";
import { TaggingMode } from "../prompts/types";

export abstract class BaseAdapter extends BaseLLMService {
    protected config: AdapterConfig;
    protected provider: LLMServiceProvider | null = null;

    protected getTemperatureOverride(): number | null {
        const value = this.config.llmTemperatureOverride;
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return null;
        }
        return value;
    }

    protected applyTemperatureOverride(body: Record<string, any>): void {
        const override = this.getTemperatureOverride();
        if (override === null) {
            return;
        }

        // Common OpenAI-compatible providers
        body.temperature = override;

        // Vertex AI style: { parameters: { temperature } } or { _vertex: { parameters: { temperature } } }
        if (body.parameters && typeof body.parameters === 'object') {
            body.parameters.temperature = override;
        }
        if (body._vertex?.parameters && typeof body._vertex.parameters === 'object') {
            body._vertex.parameters.temperature = override;
        }

        // AWS Bedrock Titan style: { textGenerationConfig: { temperature } }
        if (body.textGenerationConfig && typeof body.textGenerationConfig === 'object') {
            body.textGenerationConfig.temperature = override;
        }

        // Gemini style (non-OpenAI endpoints): { generationConfig: { temperature } }
        if (body.generationConfig && typeof body.generationConfig === 'object') {
            body.generationConfig.temperature = override;
        }
    }

    /**
     * Formats a request for the cloud service
     * Handles provider-specific request formats
     * @param prompt - The prompt to send to the LLM
     * @param language - Optional language code
     * @returns Formatted request body
     */
    public formatRequest(prompt: string, language?: string): any {
        let requestBody: any;
        if (this.provider?.requestFormat?.body) {
            // For providers that need specific request format
            requestBody = {
                ...this.provider.requestFormat.body,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ]
            };
        } else {
            // If no provider-specific format, use the parent class implementation
            requestBody = super.formatRequest(prompt, language);
        }

        if (requestBody && typeof requestBody === 'object') {
            this.applyTemperatureOverride(requestBody);
        }

        return requestBody;
    }

    public parseResponse(response: any): any {
        if (!this.provider?.responseFormat?.path) {
            throw new Error('Provider response format not configured');
        }

        try {
            if (response.error && this.provider.responseFormat.errorPath) {
                let errorMsg: unknown = response;
                for (const key of this.provider.responseFormat.errorPath) {
                    if (errorMsg === null || errorMsg === undefined || typeof errorMsg !== 'object') {
                        break;
                    }
                    errorMsg = (errorMsg as Record<string | number, unknown>)[key];
                }
                throw new Error(typeof errorMsg === 'string' ? errorMsg : 'Unknown error');
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
                    //console.error('Failed to parse JSON from response:', error);
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
        }, null);  // Adapters don't need the Obsidian app instance
        this.config = config;
    }

    async analyzeTags(content: string, existingTags: string[]): Promise<any> {
        const prompt = this.buildPrompt(content, existingTags, TaggingMode.Hybrid, 10, this.config.language);
        const response = await this.makeRequest(prompt);
        return this.parseResponse(response);
    }

    async testConnection(): Promise<{ result: any; error?: any }> {
        try {
            await this.makeRequest('test');
            return { result: { success: true } };
        } catch (error) {
            return { result: { success: false }, error };
        }
    }

    protected async makeRequest(prompt: string): Promise<any> {
        // This method should not be called directly.
        // HTTP requests should be made through CloudLLMService which uses Obsidian's requestUrl
        // to avoid CORS issues. Adapters are meant to format/parse requests, not make them.
        throw new Error('BaseAdapter.makeRequest should not be called directly. Use CloudLLMService instead.');
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

    /**
     * Extracts the main content from a cloud provider response
     * @param response The response object from the cloud provider
     * @returns The extracted content as a string
     */
    public parseResponseContent(response: any): string {
        try {
            if (!this.provider?.responseFormat?.contentPath) {
                // Default OpenAI-like format
                return response.choices?.[0]?.message?.content || '';
            }

            // Follow provider-specific content path
            let content = response;
            for (const key of this.provider.responseFormat.contentPath) {
                if (!content || typeof content !== 'object') {
                    throw new Error('Invalid response structure');
                }
                content = content[key];
            }
            
            return typeof content === 'string' ? content : JSON.stringify(content);
        } catch (error) {
            //console.error('Failed to parse response content:', error);
            return '';
        }
    }

    /**
     * Sends a request to the LLM service
     * Abstract method implementation required by BaseLLMService
     * @param prompt - The prompt to send
     * @returns Promise resolving to the response
     */
    protected async sendRequest(prompt: string): Promise<string> {
        const response = await this.makeRequest(prompt);
        return this.parseResponseContent(response);
    }
}
