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
            prompt += `<task>
Analyze the document content and select up to ${maxTags} most relevant tags from the available tag list.
</task>

<available_tags>
${candidateTags.join(', ')}
</available_tags>

<document_content>
${content}
</document_content>

<requirements>
- Select ONLY from the available tags listed above
- Do NOT modify existing tags or create new ones
- Do NOT include the # symbol
- Choose the most relevant and specific tags that match the content
- Return up to ${maxTags} tags maximum
</requirements>

<output_format>
Return the selected tags as a comma-separated list in kebab-case format.

Example: machine-learning, data-science, neural-networks

Do NOT include explanations, just the comma-separated tag list.
</output_format>`;
            break;

        case TaggingMode.Hybrid:
            prompt += `${langInstructions}<task>
Analyze the document content and provide relevant tags using a two-part approach:
1. Select existing tags from the available tag list that match the content (up to ${Math.ceil(maxTags/2)} tags)
2. Generate new tags for concepts not covered by existing tags (up to ${Math.ceil(maxTags/2)} tags)
</task>

<available_tags>
${candidateTags.join(', ')}
</available_tags>

<document_content>
${content}
</document_content>

<tag_requirements>
- Use kebab-case formatting (lowercase with hyphens): "machine-learning" not "Machine Learning"
- Keep tags concise (1-3 words maximum)
- Be specific and descriptive
- Match existing tags exactly when selecting from available tags
- Generate new tags only for important concepts not covered by existing tags
- Do NOT include the # symbol
- Do NOT prefix tags with field names or "tag:"
</tag_requirements>

<output_format>
Return ONLY a valid JSON object with this exact structure:
{
  "matchedExistingTags": ["existing-tag-1", "existing-tag-2"],
  "suggestedTags": ["new-tag-1", "new-tag-2"]
}

Example of CORRECT output:
{
  "matchedExistingTags": ["medical-research", "healthcare"],
  "suggestedTags": ["clinical-trials", "patient-outcomes"]
}

Example of WRONG output (DO NOT DO THIS):
{
  "matchedExistingTags": ["tag:matchedExistingTags-medical-research"],
  "suggestedTags": ["suggestedTags-healthcare"]
}
</output_format>`;
            break;

        case TaggingMode.GenerateNew:
            prompt += `${langInstructions}<task>
Analyze the document content and generate up to ${maxTags} relevant tags that best describe the key topics, themes, and concepts.
</task>

<document_content>
${content}
</document_content>

<tag_requirements>
- Use kebab-case formatting (lowercase with hyphens): "machine-learning" not "Machine Learning" or "machine_learning"
- Keep tags concise (1-3 words maximum)
- Be specific and descriptive
- Focus on main topics, key concepts, and important themes
- Avoid overly generic tags unless highly relevant
- Do NOT include the # symbol
- Do NOT prefix tags with "tag:" or any other prefix
</tag_requirements>

<output_format>
Return the tags as a comma-separated list.

Example: machine-learning, deep-learning, neural-networks, python, data-preprocessing

Do NOT include explanations or additional text, just the comma-separated tag list.
</output_format>`;
            break;

        case TaggingMode.Custom:
            if (!pluginSettings?.customPrompt) {
                throw new Error('Custom tagging mode requires a custom prompt to be configured in settings.');
            }

            prompt += `${langInstructions}<task>
Analyze the document content and generate up to ${maxTags} relevant tags based on the custom instructions provided below.
</task>

<existing_tags_reference>
${candidateTags && candidateTags.length > 0 ? candidateTags.join(', ') : 'No existing tags available'}
</existing_tags_reference>

<document_content>
${content}
</document_content>

<custom_instructions>
${pluginSettings.customPrompt}
</custom_instructions>

<tag_requirements>
- Use kebab-case formatting (lowercase with hyphens)
- Keep tags concise (1-3 words maximum)
- Follow the custom instructions above
- Do NOT include the # symbol
- Do NOT prefix tags with "tag:" or any other prefix
</tag_requirements>

<output_format>
Return the tags as a comma-separated list.

Example: custom-tag-1, custom-tag-2, specific-concept

Do NOT include explanations or additional text, just the comma-separated tag list.
</output_format>`;

            break;

        default:
            throw new Error(`Unsupported tagging mode: ${mode}`);
    }

    return prompt;
}