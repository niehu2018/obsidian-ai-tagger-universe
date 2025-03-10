export interface BaseResponse {
    suggestedTags: string[];
    matchedExistingTags: string[];
}

export interface AdapterConfig {
    endpoint?: string;
    apiKey?: string;
    modelName: string;
    [key: string]: any;
}

export interface RequestBody {
    messages: Array<{
        role: string;
        content: string;
    }>;
    [key: string]: any;
}

export interface LLMServiceProvider {
    name: string;
    requestFormat: {
        url: string;
        headers: Record<string, string>;
        body: any;
    };
    responseFormat: {
        path: string[];
        errorPath?: string[];
    };
}
