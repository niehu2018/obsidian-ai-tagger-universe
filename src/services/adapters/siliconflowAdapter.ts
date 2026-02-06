import { BaseAdapter } from "./baseAdapter";
import { AdapterConfig, RequestBody } from "./types";

export class SiliconflowAdapter extends BaseAdapter {
  constructor(config: AdapterConfig) {
    super(config);
    this.provider = {
      name: 'siliconflow',
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
    if (!this.config.apiKey) {
      throw new Error('API key is required for Siliconflow');
    }
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  formatRequest(prompt: string): RequestBody {
    const requestBody: RequestBody = {
      model: this.config.modelName || 'siliconflow-chat',
      messages: [{
        role: 'user',
        content: prompt
      }]
    };

    const temperature = this.getTemperatureOverride();
    if (temperature !== null) {
      requestBody.temperature = temperature;
    }

    return requestBody;
  }

  public validateConfig(): string | null {
    const baseValidation = super.validateConfig();
    if (baseValidation) return baseValidation;
    
    if (!this.config.apiKey) {
      return 'API key is required for Siliconflow';
    }
    return null;
  }

  async testConnection(): Promise<{ result: any; error?: any }> {
    try {
      const response = await fetch(`${this.getEndpoint()}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.formatRequest('test'))
      });
      
      if (!response.ok) {
        const error = await response.json();
        return { result: null, error: error.error?.message || 'Connection test failed' };
      }
      
      return { result: { success: true } };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  parseResponse(response: any): any {
    try {
      let result = response;
      if (this.provider?.responseFormat?.path) {
        for (const key of this.provider.responseFormat.path) {
          result = result[key];
        }
      }
      return result;
    } catch (error) {
      throw new Error('Failed to parse Siliconflow response');
    }
  }
}
