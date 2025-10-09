import { TaggingMode } from './prompts/types';

export const MAX_CONCURRENT_REQUESTS = 3;

export type LanguageCode = 
    | "default"
    | "en"
    | "ar"
    | "cs"
    | "da"
    | "de"
    | "es"
    | "fr"
    | "id"
    | "it"
    | "ja"
    | "ko"
    | "nl"
    | "no"
    | "pl"
    | "pt"
    | "pt-BR"
    | "ro"
    | "ru"
    | "tr"
    | "uk"
    | "zh"
    | "zh-TW";

export interface LLMResponse {
    suggestedTags: string[];
    matchedExistingTags?: string[];
}

export interface LLMServiceConfig {
    endpoint: string;
    modelName: string;
    apiKey?: string;
    apiSecret?: string;
    language?: LanguageCode;
}

export interface LLMService {
    analyzeTags(
        content: string,
        candidateTags: string[],
        mode: TaggingMode,
        maxTags: number,
        language?: LanguageCode
    ): Promise<LLMResponse>;

    testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }>;

    formatRequest(prompt: string, language?: string): any;

    dispose(): Promise<void>;

    setDebugMode(enabled: boolean): void;
}

export interface ConnectionTestError {
    type: "auth" | "network" | "timeout" | "unknown";
    message: string;
}

export enum ConnectionTestResult {
    Success = "success",
    Failed = "failed"
}
