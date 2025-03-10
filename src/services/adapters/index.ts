export * from './types';
export * from './baseAdapter';
export * from './openaiAdapter';
export * from './geminiAdapter';
export * from './openaiCompatibleAdapter';
import * as cloudEndpoints from './cloudEndpoints.json';

import { AdapterConfig } from './types';
import { BaseAdapter } from './baseAdapter';
import { OpenAIAdapter } from './openaiAdapter';
import { GeminiAdapter } from './geminiAdapter';
import { DeepseekAdapter } from './deepseekAdapter';
import { AliyunAdapter } from './aliyunAdapter';
import { ClaudeAdapter } from './claudeAdapter';
import { GroqAdapter } from './groqAdapter';
import { VertexAdapter } from './vertexAdapter';
import { OpenRouterAdapter } from './openRouterAdapter';
import { BedrockAdapter } from './bedrockAdapter';
import { RequestyAdapter } from './requestyAdapter';
import { CohereAdapter } from './cohereAdapter';
import { GrokAdapter } from './grokAdapter';
import { MistralAdapter } from './mistralAdapter';
import { OpenAICompatibleAdapter } from './openaiCompatibleAdapter';

export type AdapterType = 'openai' | 'gemini' | 'deepseek' | 'aliyun' | 'claude' | 'groq' | 'vertex' | 
    'openrouter' | 'bedrock' | 'requesty' | 'cohere' | 'grok' | 'mistral' | 'openai-compatible';

export function createAdapter(type: AdapterType, config: AdapterConfig): BaseAdapter {
    switch (type.toLowerCase()) {
        case 'openai':
            return new OpenAIAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.openai
            });
        case 'gemini':
            return new GeminiAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.gemini
            });
        case 'deepseek':
            return new DeepseekAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.deepseek
            });
        case 'aliyun':
            return new AliyunAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.aliyun
            });
        case 'claude':
            return new ClaudeAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.claude
            });
        case 'groq':
            return new GroqAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.groq
            });
        case 'vertex':
            return new VertexAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.vertex
            });
        case 'openrouter':
            return new OpenRouterAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.openrouter
            });
        case 'bedrock':
            return new BedrockAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.bedrock
            });
        case 'requesty':
            return new RequestyAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.requesty
            });
        case 'cohere':
            return new CohereAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.cohere
            });
        case 'grok':
            return new GrokAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.grok
            });
        case 'mistral':
            return new MistralAdapter({
                ...config,
                endpoint: config.endpoint || cloudEndpoints.mistral
            });
        case 'openai-compatible':
            return new OpenAICompatibleAdapter(config);
        default:
            throw new Error(`Unsupported adapter type: ${type}`);
    }
}
