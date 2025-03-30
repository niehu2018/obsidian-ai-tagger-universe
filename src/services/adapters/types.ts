import { LanguageCode } from '../types';

export interface FetchOptions {
    method: string;
    headers: Record<string, string>;
    body?: string;
}

export interface AdapterConfig {
    endpoint: string;
    apiKey: string;
    apiSecret?: string;
    model?: string;
    modelName?: string;
    language?: LanguageCode;
}

export interface RequestBody {
    model?: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    max_tokens?: number;
    temperature?: number;
}

export interface AdapterRequestParams {
    messages: {
        role: string;
        content: string;
    }[];
    prompt?: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
}

export interface BaseResponse {
    text: string;
    error?: string;
    matchedExistingTags?: string[];
    suggestedTags?: string[];
    usage?: {
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
    };
}

export interface RequestConfig {
    endpoint: string;
    apiKey: string;
    apiSecret?: string;
    model?: string;
}

export type AdapterResponse = Promise<BaseResponse>;

export interface LLMServiceProvider {
    name: string;
    requestFormat: {
        url?: string;
        headers?: Record<string, string>;
        body?: any;
    };
    responseFormat: {
        path: (string | number)[];
        errorPath?: (string | number)[];
    };
}
