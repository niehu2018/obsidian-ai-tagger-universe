import { TaggingMode } from '../services/prompts/types';
import { LanguageCode } from '../services/types';
import { AdapterType } from '../services/adapters';
import { SupportedLanguage, DEFAULT_LANGUAGE } from '../i18n';

export interface AITaggerSettings {
    serviceType: 'local' | 'cloud';
    localEndpoint: string;
    localModel: string;
    localServiceType?: 'ollama' | 'lm_studio' | 'localai' | 'openai_compatible';
    cloudEndpoint: string;
    cloudApiKey: string;
    cloudModel: string;
    cloudServiceType: AdapterType;
    taggingMode: TaggingMode;
    customPrompt: string;
    excludedFolders: string[];
    language: LanguageCode;
    interfaceLanguage: SupportedLanguage;
    predefinedTagsPath: string;
    tagSourceType: 'file' | 'vault';
    replaceTags: boolean;
    tagDir: string;
    /** @deprecated Kept for backward compatibility only */
    tagRangeMatchMax: number;
    tagRangeGenerateMax: number;
    tagRangePredefinedMax: number;
    debugMode: boolean;
    // Nested Tags Settings
    enableNestedTags: boolean;           // Enable nested tag generation
    nestedTagsMaxDepth: number;          // Max hierarchy depth (1-3)
}

export const DEFAULT_SETTINGS: AITaggerSettings = {
    serviceType: 'cloud',
    localEndpoint: 'http://localhost:11434/v1/chat/completions',
    localModel: 'mistral',
    cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
    cloudApiKey: '',
    cloudModel: 'gpt-4',
    cloudServiceType: 'openai',
    taggingMode: TaggingMode.GenerateNew,
    customPrompt: "",
    excludedFolders: [],
    language: 'default',
    interfaceLanguage: DEFAULT_LANGUAGE,
    predefinedTagsPath: '',
    tagSourceType: 'vault',
    tagDir: '',
    tagRangeMatchMax: 5,
    tagRangeGenerateMax: 5,
    tagRangePredefinedMax: 5,
    replaceTags: true,
    debugMode: false,
    enableNestedTags: false,
    nestedTagsMaxDepth: 2,
};
