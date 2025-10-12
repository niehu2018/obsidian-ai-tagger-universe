import { zhCN } from './zh-cn';
import { en } from './en';
import { Translations } from './types';

export type { Translations } from './types';

// 支持的语言类型
export type SupportedLanguage = 'zh-cn' | 'en';

// 语言映射
export const languageMap: Record<SupportedLanguage, string> = {
    'zh-cn': '中文（简体）',
    'en': 'English'
};

// 语言包映射
export const translations: Record<SupportedLanguage, Translations> = {
    'zh-cn': zhCN,
    'en': en
};

// 默认语言
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * 获取当前语言设置
 * @param languageCode 语言代码
 * @returns 对应的语言包
 */
export function getTranslations(languageCode: string = DEFAULT_LANGUAGE): Translations {
    return translations[languageCode as SupportedLanguage] || translations[DEFAULT_LANGUAGE];
}

/**
 * 获取所有支持的语言选项
 * @returns 语言选项映射
 */
export function getLanguageOptions(): Record<string, string> {
    return Object.entries(languageMap).reduce((acc, [code, name]) => {
        acc[code] = name;
        return acc;
    }, {} as Record<string, string>);
}

/**
 * 检查是否为支持的语言
 * @param languageCode 语言代码
 * @returns 是否支持
 */
export function isSupportedLanguage(languageCode: string): languageCode is SupportedLanguage {
    return languageCode in translations;
}