import { TaggingMode } from '../services/prompts/types';
import { LanguageCode } from '../services/types';
import { AdapterType } from '../services/adapters';

export interface AITaggerSettings {
    serviceType: 'local' | 'cloud';
    localEndpoint: string;
    localModel: string;
    localServiceType: 'ollama' | 'lm_studio' | 'localai' | 'openai_compatible';
    cloudEndpoint: string;
    cloudApiKey: string;
    cloudModel: string;
    cloudServiceType: AdapterType;
    taggingMode: TaggingMode;
    excludedFolders: string[];
    language: LanguageCode;
    predefinedTagsPath: string;
    tagSourceType: 'file' | 'vault';
    replaceTags: boolean;
    tagDir: string;
    /** @deprecated Kept for backward compatibility only */
    tagRangeMatchMax: number;
    tagRangeGenerateMax: number;
    tagRangePredefinedMax: number;
}

export const DEFAULT_SETTINGS: AITaggerSettings = {
    serviceType: 'cloud',
    localEndpoint: 'http://localhost:11434/api/chat',
    localModel: 'llama',
    localServiceType: 'ollama',
    cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
    cloudApiKey: '',
    cloudModel: 'gpt-4',
    cloudServiceType: 'openai',
    taggingMode: TaggingMode.GenerateNew,
    excludedFolders: [],
    language: 'default',
    predefinedTagsPath: '',
    tagSourceType: 'vault',
    tagDir: '',
    tagRangeMatchMax: 5,
    tagRangeGenerateMax: 5,
    tagRangePredefinedMax: 5,
    replaceTags: false
};
