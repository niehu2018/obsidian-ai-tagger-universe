import { TAG_PREDEFINED_RANGE, TAG_MATCH_RANGE, TAG_GENERATE_RANGE } from '../../tagUtils';

export enum TaggingMode {
    PredefinedTags = 'predefined',
    GenerateNew = 'generate',
    ExistingTags = 'existing',
    HybridGenerateExisting = 'hybrid-generate-existing', // First GenerateNew, then ExistingTags
    HybridGeneratePredefined = 'hybrid-generate-predefined' // First GenerateNew, then PredefinedTags
}

export function buildTagPrompt(
    content: string, 
    candidateTags: string[], 
    mode: TaggingMode,
    maxTags: number = 5,
    language?: 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW'
): string {
    // Map language codes to their proper names
    const languageNames: Record<string, string> = {
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
    
    let prompt = '';
    
    switch (mode) {
        case TaggingMode.PredefinedTags:
            const predefinedLimit = TAG_PREDEFINED_RANGE.MAX;
            prompt = `Analyze the following content and select up to ${predefinedLimit} most relevant tags from the provided tag list.
Only use exact matches from the provided tags, do not modify or generate new tags.

Available tags:
${candidateTags.join(', ')}

Content:
${content}

Return only a JSON object in this exact format:
{
    "matchedTags": ["#tag1", "#tag2"]
}`;
            break;

        case TaggingMode.GenerateNew:
            const generateOnlyLimit = TAG_GENERATE_RANGE.MAX;
            // Use a standard example format for all languages
            const tagExamples = `- Example format: #topic, #concept, #subject`;
            
            // Only consider language parameter for GenerateNew mode
            let genLangInstructions = '';
            if (language && language !== 'default') {
                const languageName = languageNames[language] || language;
                genLangInstructions = `IMPORTANT: Generate all tags in ${languageName} language only.
Regardless of what language the content is in, all tags must be in ${languageName} only.
First understand the content, then if needed translate concepts to ${languageName}, then generate tags in ${languageName}.

`;
            }
            
            prompt = `${genLangInstructions}Analyze the following content and generate up to ${generateOnlyLimit} relevant tags.

Requirements for tags:
- Must start with # symbol
- Can contain letters, numbers, and hyphens
- No spaces allowed
${tagExamples}

Content:
${content}

Return only a JSON object in this exact format:
{
    "newTags": ["#tag1", "#tag2", "#tag3"]
}`;
            break;

        case TaggingMode.ExistingTags:
            const existingLimit = TAG_MATCH_RANGE.MAX;
            prompt = `Analyze the following content and select up to ${existingLimit} most relevant tags from the existing tags in the vault.
Only use exact matches from the provided tags, do not modify or generate new tags.

Existing tags in vault:
${candidateTags.join(', ')}

Content:
${content}

Return only a JSON object in this exact format:
{
    "matchedTags": ["#tag1", "#tag2"]
}`;
            break;
    }

    return prompt;
}
