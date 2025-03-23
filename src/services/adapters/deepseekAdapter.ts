import { BaseAdapter } from "./baseAdapter";
import { AdapterConfig, RequestBody } from "./types";
import * as endpoints from './cloudEndpoints.json';
import { BaseLLMService } from "../baseService";

export class DeepseekAdapter extends BaseAdapter {
  constructor(config: AdapterConfig) {
    super({
      ...config,
      endpoint: config.endpoint || endpoints.deepseek
    });
    this.provider = {
      name: 'deepseek',
      requestFormat: {
        url: '/v1/chat/completions',
        headers: {},
        body: {
          model: this.config.modelName,
          messages: []
        }
      },
      responseFormat: {
        path: ['choices', 0, 'message', 'content'],
        errorPath: ['error', 'message']
      }
    };
  }

  getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  private readonly defaultConfig = {
    defaultModel: 'deepseek-chat'
  };

  formatRequest(prompt: string): RequestBody {
    return {
      model: this.config.modelName || this.defaultConfig.defaultModel,
      messages: [
        {
          role: 'system',
          content: BaseLLMService.SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    };
  }

  public validateConfig(): string | null {
    const baseValidation = super.validateConfig();
    if (baseValidation) return baseValidation;
    
    if (!this.config.apiKey) {
      return 'API key is required for Deepseek';
    }
    return null;
  }

  parseResponse(response: any): any {
    try {
      if (response.error && response.error.message) {
        throw new Error(response.error.message);
      }
      let result = response;
      for (const key of this.provider.responseFormat.path) {
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure');
        }
        result = result[key];
      }
      if (typeof result !== 'string') {
        result = JSON.stringify(result);
      }
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse Deepseek response: ${message}`);
    }
  }
}
