import { TAG_PREDEFINED_RANGE, TAG_GENERATE_RANGE } from '../../utils/constants';
import { LanguageCode } from '../types';
import { languageNames, getLanguageName } from '../languageUtils';
import { LanguageUtils } from '../../utils/languageUtils';
import { SYSTEM_PROMPT } from '../../utils/constants';
import { TaggingMode } from './types';

// Re-export TaggingMode for backward compatibility
export { TaggingMode };

import { AITaggerSettings } from '../../core/settings';

let pluginSettings: AITaggerSettings | undefined;

export function setSettings(settings: AITaggerSettings): void {
    pluginSettings = settings;
}

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
    let langInstructions = '';

    // Prepare language instructions if needed
    if (language && language !== 'default') {
        const languageName = LanguageUtils.getLanguageDisplayName(language);
        
        switch (mode) {
            case TaggingMode.Hybrid:
                langInstructions = `IMPORTANT: Generate all new tags in ${languageName} language only.
When generating new tags (not selecting from predefined ones), they must be in ${languageName} only.

`;
                break;
                
            case TaggingMode.GenerateNew:
                langInstructions = `IMPORTANT: Generate all tags in ${languageName} language only.
Regardless of what language the content is in, all tags must be in ${languageName} only.
First understand the content, then if needed translate concepts to ${languageName}, then generate tags in ${languageName}.

`;
                break;
                
            default:
                langInstructions = '';
        }
    }
    
    switch (mode) {
        case TaggingMode.PredefinedTags:
            prompt += `Analyze the following content and select up to ${maxTags} most relevant tags from the provided tag list.
Only use exact matches from the provided tags, do not modify or generate new tags.

Available tags:
${candidateTags.join(', ')}

Content:
${content}

Return only the selected tags as a comma-separated list without # symbol. Do not include any prefixes or labels within the tag values (e.g., not "matchedExistingTags-foo"): 
hello, world, ,hello-world`;
            break;

        case TaggingMode.Hybrid:
            prompt += `${langInstructions}Analyze the following content and:
1. Select relevant tags from the provided tag list (up to ${Math.ceil(maxTags/2)} tags)
2. Generate additional new tags not in the list (up to ${Math.ceil(maxTags/2)} tags)

Available tags to select from:
${candidateTags.join(', ')}

Content:
${content}

Return your response in this JSON format:
{
  "matchedExistingTags": ["tag1", "tag2"], 
  "suggestedTags": ["new-tag1", "new-tag2"]
}
STRICT RULES:
- Output MUST be valid JSON only, no extra text.
- Do NOT include the words "matchedExistingTags" or "suggestedTags" inside any tag values.
    For example, never produce values like "matchedExistingTags-supply-chain" or "suggestedTags-distribution".
- Use those words only as the JSON keys shown above, exactly once each.
If a tag concept would be "supply chain", the correct value is "supply-chain".

Do not include the # symbol in tags.`;
            break;

        case TaggingMode.GenerateNew:
            prompt += `${langInstructions}Analyze the following content and generate up to ${maxTags} relevant tags.
Return tags without the # symbol. Do not include any prefixes or labels within tag values (e.g., not "suggestedTags-foo").

Content:
${content}

Return the tags as a comma-separated list. Do not include any prefixes or labels within tag values:
hello, world, hello world,hello-world`;
            break;

        case TaggingMode.Custom:
            if (!pluginSettings?.customPrompt) {
                throw new Error('Custom tagging mode requires a custom prompt to be configured in settings.');
            }

            prompt += `${langInstructions}Analyze the following content and generate up to ${maxTags} relevant tags.
Consider the following existing tags if relevant:
${candidateTags && candidateTags.length > 0 ? candidateTags.join(', ') : 'N/A'}

Apply the following specific instructions if provided:
${pluginSettings.customPrompt ? pluginSettings.customPrompt : 'No specific additional instructions.'}

Return tags without the # symbol. Do not include any prefixes or labels within tag values.

Content:
${content}

Return the tags as a comma-separated list. Do not include any prefixes or labels within tag values:
hello, world, hello world,hello-world`;

            break;

        default:
            throw new Error(`Unsupported tagging mode: ${mode}`);
    }

    return prompt;
}