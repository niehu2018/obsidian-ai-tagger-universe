/**
 * Default system prompt for AI tag analysis
 */
export const SYSTEM_PROMPT =
    'You are a professional document tag analysis assistant. ' +
    'Your task is to analyze document content and suggest relevant tags for organization and retrieval. ' +
    'Tags should be concise, descriptive, and formatted in kebab-case (lowercase with hyphens). ' +
    'Follow the specific output format requested in each task.';

/**
 * Maximum number of concurrent requests to external APIs
 */
export const MAX_CONCURRENT_REQUESTS = 3;

/**
 * Tag range constants for different tagging modes
 */
export const TAG_RANGE = {
    MIN: 0,
    MAX: 10
};

/**
 * Maximum number of tags to select from predefined tags
 */
export const TAG_PREDEFINED_RANGE = {
    MIN: TAG_RANGE.MIN,
    MAX: 5
};

/**
 * Maximum number of tags to generate for new tags
 * In hybrid mode, total tags are composed of up to TAG_PREDEFINED_RANGE.MAX tags from predefined source 
 * and up to TAG_GENERATE_RANGE.MAX new generated tags
 */
export const TAG_GENERATE_RANGE = {
    MIN: TAG_RANGE.MIN,
    MAX: 5
}; 