import { BaseAdapter } from "./baseAdapter";
import { AdapterConfig, RequestBody, BaseResponse } from "./types";
import * as endpoints from './cloudEndpoints.json';

export class DeepseekAdapter extends BaseAdapter {
  constructor(config: AdapterConfig) {
    super({
      ...config,
      endpoint: config.endpoint || endpoints.deepseek,
      modelName: config.modelName || 'deepseek-chat'
    });
    this.provider = {
      name: 'deepseek',
      requestFormat: {
        body: {
          model: this.modelName
        }
      },
      responseFormat: {
        path: ['choices', '0', 'message', 'content'],
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

  public validateConfig(): string | null {
    const baseValidation = super.validateConfig();
    if (baseValidation) return baseValidation;
    
    if (!this.config.apiKey) {
      return 'API key is required for Deepseek';
    }
    return null;
  }

  parseResponse(response: any): BaseResponse {
    try {
      let result = response;
      let content = '';
      
      // 先获取原始的响应内容
      if (response.choices?.[0]?.message?.content) {
        content = response.choices[0].message.content;
      }
      
      // 解析结构化数据
      for (const key of this.provider.responseFormat.path) {
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure');
        }
        result = result[key];
      }
      
      // 提取标签数据
      const jsonContent = this.extractJsonFromContent(content);
      
      return {
        text: content,
        matchedExistingTags: jsonContent.matchedTags || [],
        suggestedTags: jsonContent.newTags || []
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse Deepseek response: ${message}`);
    }
  }
}
