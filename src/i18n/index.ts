import { zhCN } from './zh-cn';
import { en } from './en';
import { Translations } from './types';

export type { Translations } from './types';

// Supported language types
export type SupportedLanguage = 'zh-cn' | 'en';

// Language display names mapping
export const languageMap: Record<SupportedLanguage, string> = {
    'zh-cn': '中文（简体）',
    'en': 'English'
};

// Language pack mapping
export const translations: Record<SupportedLanguage, Translations> = {
    'zh-cn': zhCN,
    'en': en
};

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Get translations for the specified language
 * @param languageCode - Language code
 * @returns Corresponding language pack
 */
export function getTranslations(languageCode: string = DEFAULT_LANGUAGE): Translations {
    return translations[languageCode as SupportedLanguage] || translations[DEFAULT_LANGUAGE];
}

/**
 * Get all supported language options
 * @returns Language options mapping
 */
export function getLanguageOptions(): Record<string, string> {
    return Object.entries(languageMap).reduce((acc, [code, name]) => {
        acc[code] = name;
        return acc;
    }, {} as Record<string, string>);
}

/**
 * Check if language is supported
 * @param languageCode - Language code
 * @returns Whether language is supported
 */
export function isSupportedLanguage(languageCode: string): languageCode is SupportedLanguage {
    return languageCode in translations;
}