import { TAG_PREDEFINED_RANGE, TAG_MATCH_RANGE, TAG_GENERATE_RANGE } from '../../utils/tagUtils';

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
        case TaggingMode.ExistingTags:
            const tagLimit = mode === TaggingMode.PredefinedTags ? TAG_PREDEFINED_RANGE.MAX : TAG_MATCH_RANGE.MAX;
            const tagSource = mode === TaggingMode.PredefinedTags ? 'provided tag list' : 'existing tags in the vault';
            prompt = `Analyze the following content and select up to ${tagLimit} most relevant tags from the ${tagSource}.
Only use exact matches from the provided tags, do not modify or generate new tags.

Available tags:
${candidateTags.join(', ')}

Content:
${content}

Return only a JSON object in this exact format:
{
    "matchedTags": ["machine_learning", "deep-learning"]
}`;
            break;

        case TaggingMode.GenerateNew:
            const generateOnlyLimit = TAG_GENERATE_RANGE.MAX;
            // Use a standard example format for all languages
            const tagExamples = `Example formats:
- snake_case: machine_learning, data_science
- kebab-case: artificial-intelligence, deep-learning
- camelCase: computerVision, naturalLanguage
- PascalCase: MachineLearning, DeepLearning`;
            
            // Handle language parameter for GenerateNew mode
            let genLangInstructions = '';
            if (language && language !== 'default') {
                const languageName = languageNames[language] || language;
                genLangInstructions = `IMPORTANT: Follow these two steps:
1. Generate appropriate tags based on the content
2. Translate each tag to ${languageName}
- Ensure translated tags follow the same format rules (no spaces, only allowed characters)

`;
            }
            
            prompt = `${genLangInstructions}Analyze the following content and generate up to ${generateOnlyLimit} relevant tags.

Requirements for tags:
- Must contain at least one non-numeric character (e.g., 'y1984' is valid, '1984' is not)
- Use camelCase, PascalCase, snake_case, or kebab-case for multi-word tags
- Only letters, numbers, underscores (_), and hyphens (-) are allowed
- No spaces allowed
${tagExamples}

Content:
${content}

Return only a JSON object in this exact format:${
    language && language !== 'default' 
    ? `
{
    "newTags": ["data_analysis", "machine-learning", "computerVision"],         // Tags in English
    "translatedTags": ["translated_tag1", "translated-tag2", "translatedTag3"]  // Tags in ${languageNames[language]}
}`
    : `
{
    "newTags": ["data_analysis", "machine-learning", "computerVision","news","sports"]
}`
}`;
            break;

    }

    return prompt;
}
