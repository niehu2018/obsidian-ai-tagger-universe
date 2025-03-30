/**
 * Defines the available modes for AI tag generation.
 */
export enum TaggingMode {
    /**
     * Use only predefined tags from the user's input.
     * The AI will select the most relevant tags from the provided list.
     */
    PredefinedTags = 'predefined',
    
    /**
     * Generate completely new tags based on the content.
     * The AI will create tags without considering any predefined options.
     */
    GenerateNew = 'generate',
    
    /**
     * Combine predefined tags with newly generated ones.
     * The AI will both select from provided tags and suggest new ones.
     */
    Hybrid = 'hybrid'
} 