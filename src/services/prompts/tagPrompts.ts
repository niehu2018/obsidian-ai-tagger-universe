import { TAG_PREDEFINED_RANGE, TAG_GENERATE_RANGE } from '../../utils/constants';
import { LanguageCode } from '../types';
import { languageNames, getLanguageName } from '../languageUtils';
import { LanguageUtils } from '../../utils/languageUtils';
import { SYSTEM_PROMPT } from '../../utils/constants';
import { TaggingMode } from './types';

// Re-export TaggingMode for backward compatibility
export { TaggingMode };

/**
 * Builds a prompt for tag analysis based on the specified mode
 * @param content - Content to analyze
 * @param candidateTags - Array of candidate tags
 * @param mode - Tagging mode
 * @param maxTags - Maximum number of tags to return
 * @param language - Language for generated tags
 * @returns Formatted prompt string
 */
export function buildTagPrompt(
    content: string, 
    candidateTags: string[], 
    mode: TaggingMode,
    maxTags: number = 5,
    language?: LanguageCode | 'default'
): string {
    let prompt = '';    
    switch (mode) {
        case TaggingMode.PredefinedTags:
            prompt += `Analyze the following content and select up to ${maxTags} most relevant tags from the provided tag list.
Only use exact matches from the provided tags, do not modify or generate new tags.

Available tags:
${candidateTags.join(', ')}

Content:
${content}

Return only the selected tags as a comma-separated list without # symbol:
hello, world, hello-world`;
            break;

        case TaggingMode.GenerateNew:
            
            // Only consider language parameter for GenerateNew mode
            let genLangInstructions = '';
            if (language && language !== 'default') {
                const languageName = LanguageUtils.getLanguageDisplayName(language);
                genLangInstructions = `IMPORTANT: Generate all tags in ${languageName} language only.
Regardless of what language the content is in, all tags must be in ${languageName} only.
First understand the content, then if needed translate concepts to ${languageName}, then generate tags in ${languageName}.

`;
            }
            
            prompt += `${genLangInstructions}Analyze the following content and generate up to ${maxTags} relevant tags.
Return tags without the # symbol.

Content:
${content}

Return the tags as a comma-separated list:
hello, world, hello-world`;
            break;

        default:
            throw new Error(`Unsupported tagging mode: ${mode}`);
    }

    return prompt;
}