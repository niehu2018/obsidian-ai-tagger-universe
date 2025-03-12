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
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse response: ${message}`);
    }
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
    const prompt = this.buildPrompt(content, existingTags, TaggingMode.Hybrid, 10, this.config.language);
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
