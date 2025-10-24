import { LanguageCode } from './types';

/**
 * Maps language codes to their proper names
 */
export const languageNames: Record<LanguageCode, string> = {
    'default': 'Default',
    'ar': 'Arabic',
    'cs': 'Czech',
    'da': 'Danish',
    'de': 'German',
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'he': 'Hebrew',
    'id': 'Indonesian',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'nl': 'Dutch',
    'no': 'Norwegian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'pt-BR': 'Brazilian Portuguese',
    'ro': 'Romanian',
    'ru': 'Russian',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)'
};

/**
 * Get language name from language code
 * @param code - Language code
 * @returns Language name or the code if not found
 */
export function getLanguageName(code?: LanguageCode): string {
    if (!code || code === 'default') {
        return 'Default';
    }
    return languageNames[code] || code;
} 
