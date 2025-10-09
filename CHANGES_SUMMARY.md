# Changes Summary for Upstream Contribution

## Bug Fix: Malformed Tag Prefixes

### Issue
When using Hybrid mode, tags were appearing with malformed prefixes:
- `matchedExistingTags-medical-research` instead of `medical-research`
- `suggestedTags-health-education` instead of `health-education`

### Root Cause
LLMs (especially Claude, GPT-4, and others) often wrap JSON responses in markdown code fences:
````markdown
```json
{
  "matchedExistingTags": ["tag1", "tag2"],
  "suggestedTags": ["tag3", "tag4"]
}
```
````

The code was attempting to parse this directly as JSON (which fails), then falling back to text processing that split the response by newlines, creating malformed tag strings.

### Solution
Added markdown code fence detection and extraction in `src/services/baseService.ts`:
- Detects markdown code blocks with regex: `/```(?:json)?\s*\n?([\s\S]*?)\n?```/`
- Extracts JSON content from within the fences
- Parses as proper JSON before processing tags
- Falls back to text parsing only if code fence extraction fails

### Files Modified
- `src/services/baseService.ts` - Added code fence extraction logic (lines 345-401)

## Enhancement: Improved Prompts

### Changes
Restructured all prompt templates to use Claude-optimized XML-style tags for better LLM comprehension.

### Benefits
- Clearer section boundaries (`<task>`, `<requirements>`, `<output_format>`)
- Explicit kebab-case formatting requirements
- Better examples showing correct vs. incorrect outputs
- Reduced likelihood of malformed responses

### Files Modified
- `src/utils/constants.ts` - Updated system prompt
- `src/services/prompts/tagPrompts.ts` - Restructured all mode prompts

## Enhancement: Tag Sanitization

Added defensive tag sanitization as a safety net to clean malformed tags if they still occur.

### Implementation
- New `sanitizeTag()` method removes common prefixes: `tag:`, `matchedExistingTags-`, `suggestedTags-`, etc.
- Applied during tag parsing in all modes
- Acts as a fallback if prompts or parsing improvements miss edge cases

### Files Modified
- `src/services/baseService.ts` - Added `sanitizeTag()` method (lines 388-420)

## Enhancement: Debug Mode

Added comprehensive debug logging to help troubleshoot tag generation issues.

### Features
- Toggle in plugin settings (LLM Settings section)
- Logs raw LLM responses, parsed JSON, sanitization steps, and final tag arrays
- Controlled by `debugMode` setting, no performance impact when disabled
- All logs prefixed with `[AI Tagger Debug]` for easy filtering

### Files Modified
- `src/core/settings.ts` - Added `debugMode: boolean` setting
- `src/services/types.ts` - Added `setDebugMode()` to LLMService interface
- `src/services/baseService.ts` - Added debug logging infrastructure
- `src/main.ts` - Pass debug mode to services
- `src/utils/tagUtils.ts` - Added global debug mode support
- `src/ui/settings/LLMSettingsSection.ts` - Added debug toggle UI

## Testing

All changes have been tested with:
- Multiple LLM providers (Claude, GPT-4, local models)
- All tagging modes (GenerateNew, PredefinedTags, Hybrid, Custom)
- Various content types and tag scenarios

## Backward Compatibility

All changes are fully backward compatible:
- Existing settings are preserved
- New `debugMode` setting defaults to `false`
- Prompt improvements don't break existing functionality
- Falls back gracefully if JSON extraction fails

## Recommended Merge Strategy

These changes can be merged independently or together:
1. **Critical Bug Fix**: Code fence extraction (required)
2. **Prompt Improvements**: Reduces future issues (recommended)
3. **Tag Sanitization**: Safety net (recommended)
4. **Debug Mode**: Helpful for users and troubleshooting (optional)

## Additional Notes

- Build tested successfully with TypeScript and esbuild
- No new dependencies added
- Code follows existing style and patterns
- Documentation added where appropriate
