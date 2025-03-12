import { TAG_PREDEFINED_RANGE, TAG_MATCH_RANGE, TAG_GENERATE_RANGE } from '../../tagUtils';

export enum TaggingMode {
    PredefinedTags = 'predefined',
    GenerateNew = 'generate',
    ExistingTags = 'existing',
    Hybrid = 'hybrid'
}

export function buildTagPrompt(
    content: string, 
    candidateTags: string[], 
    mode: TaggingMode,
    maxTags: number = 5,
    language?: 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW'
): string {
    const langInstructions = language && language !== 'default' ? `Please translate all generated tags into ${language} language.` : '';
    
    let prompt = '';
    
    switch (mode) {
        case TaggingMode.PredefinedTags:
            const predefinedLimit = TAG_PREDEFINED_RANGE.MAX;
            prompt = `Analyze the following content and select up to ${predefinedLimit} most relevant tags from the provided tag list.
Only use exact matches from the provided tags, do not modify or generate new tags.
${langInstructions}

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
            prompt = `Analyze the following content and generate up to ${generateOnlyLimit} relevant tags.
${langInstructions}

Requirements for tags:
- Must start with # symbol
- Can contain letters, numbers, and hyphens
- No spaces allowed
- Example format: #technology, #artificial-intelligence, #coding
- Supports international characters: #技术, #인공지능, #프로그래밍

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
${langInstructions}

Existing tags in vault:
${candidateTags.join(', ')}

Content:
${content}

Return only a JSON object in this exact format:
{
    "matchedTags": ["#tag1", "#tag2"]
}`;
            break;

        case TaggingMode.Hybrid:
            const matchLimit = TAG_MATCH_RANGE.MAX;
            const generateLimit = TAG_GENERATE_RANGE.MAX;
            prompt = `Analyze the following content and:
1. Match up to ${matchLimit} most relevant tags from the existing tags (exact matches only)
2. Generate up to ${generateLimit} new relevant tags
${langInstructions}

Requirements for new tags:
- Must start with # symbol
- Can contain letters, numbers, and hyphens
- No spaces allowed
- Example format: #technology, #artificial-intelligence, #coding
- Supports international characters: #技术, #인공지능, #프로그래밍

Existing tags:
${candidateTags.join(', ')}

Content:
${content}

Return only a JSON object in this exact format:
{
    "matchedTags": ["#tag1", "#tag2"],
    "newTags": ["#tag1", "#tag2", "#tag3"]
}`;
            break;
    }

    return prompt;
}
