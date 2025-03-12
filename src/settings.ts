import { TaggingMode } from './services/prompts/tagPrompts';

export interface AITaggerSettings {
    serviceType: 'local' | 'cloud';
    localEndpoint: string;
    localModel: string;
    cloudEndpoint: string;
    cloudApiKey: string;
    cloudModel: string;
    taggingMode: TaggingMode;
    cloudServiceType: 'openai' | 'gemini' | 'deepseek' | 'aliyun' | 'claude' | 'groq' | 'vertex' | 'openrouter' | 'bedrock' | 'requesty' | 'cohere' | 'grok' | 'mistral' | 'openai-compatible';
    predefinedTagsPath: string;
    language: 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW';
    tagDir: string;
    tagRangeMatchMax: number;
    tagRangeGenerateMax: number;
    tagRangePredefinedMax: number;
}

export const DEFAULT_SETTINGS: AITaggerSettings = {
    serviceType: 'local',
    localEndpoint: 'http://localhost:11434/v1/chat/completions',
    localModel: 'llama2',
    cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
    cloudApiKey: '',
    cloudModel: 'gpt-3.5-turbo',
    taggingMode: TaggingMode.Hybrid,
    cloudServiceType: 'openai',
    predefinedTagsPath: '',
    language: 'en',
    tagDir: 'tags',
    tagRangeMatchMax: 5,
    tagRangeGenerateMax: 5,
    tagRangePredefinedMax: 5
};
