import { LanguageCode } from '../services/types';

/**
 * Utility class for language-related operations
 */
export class LanguageUtils {
    /**
     * Maps language codes to their proper display names
     */
    private static readonly LANGUAGE_NAMES: Record<string, string> = {
        'default': 'Default',
        'ar': 'Arabic',
        'cs': 'Czech',
        'da': 'Danish',
        'de': 'German',
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
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
     * Get the display name for a language code
     * @param code - Language code
     * @returns Language display name
     */
    public static getLanguageDisplayName(code: string): string {
        if (!code || code === 'default') {
            return 'Default';
        }
        return this.LANGUAGE_NAMES[code] || code;
    }
    
    /**
     * Get all supported language codes and their display names
     * @returns Map of language codes to display names
     */
    public static getLanguageOptions(): Record<string, string> {
        return { ...this.LANGUAGE_NAMES };
    }
} 