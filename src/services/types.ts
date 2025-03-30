export const SYSTEM_PROMPT = 
    'You are a professional document tag analysis assistant. ' +
    'Please return your response as a plain text string of comma-separated tags. ' +
    'For example: "hello, world, hello world, hello-world"';

export const MAX_CONCURRENT_REQUESTS = 3;

export interface LLMResponse {
    suggestedTags: string[];
    matchedExistingTags?: string[];
}

export interface LLMServiceConfig {
    endpoint: string;
    modelName: string;
    apiKey?: string;
    apiSecret?: string;
}

export interface ConnectionTestError {
    type: "auth" | "network" | "timeout" | "unknown";
    message: string;
}

export enum ConnectionTestResult {
    Success = "success",
    Failed = "failed"
}
