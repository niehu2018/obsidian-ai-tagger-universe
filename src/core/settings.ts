import { TaggingMode } from '../services/prompts/tagPrompts';

export interface AITaggerSettings {
    serviceType: 'local' | 'cloud';
    localEndpoint: string;
    localModel: string;
    localServiceType: 'ollama' | 'lm_studio' | 'localai';
    cloudEndpoint: string;
    cloudApiKey: string;
    cloudModel: string;
    taggingMode: TaggingMode;
    excludedFolders: string[];
    cloudServiceType: 'openai' | 'gemini' | 'deepseek' | 'aliyun' | 'claude' | 'groq' | 'vertex' | 'openrouter' | 'bedrock' | 'requesty' | 'cohere' | 'grok' | 'mistral' | 'openai-compatible';
    predefinedTagsPath: string;
    language: 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW';
    tagDir: string;
    tagRangeMatchMax: number;
    tagRangeGenerateMax: number;
    tagRangePredefinedMax: number;
}

export const DEFAULT_SETTINGS: AITaggerSettings = {
    serviceType: 'cloud',
    localEndpoint: 'http://localhost:11434/v1/chat/completions',
    localModel: 'llama2',
    localServiceType: 'ollama',
    cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
    cloudApiKey: '',
    cloudModel: 'gpt-3.5-turbo',
    taggingMode: TaggingMode.GenerateNew,
    excludedFolders: [],
    cloudServiceType: 'openai-compatible',
    predefinedTagsPath: '',
    language: 'default',
    tagDir: 'tags',
    tagRangeMatchMax: 5,
    tagRangeGenerateMax: 5,
    tagRangePredefinedMax: 5
};
