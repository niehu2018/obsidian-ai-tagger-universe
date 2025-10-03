# Debug Mode Instructions

Debug mode has been added to help troubleshoot tag generation issues.

## Enabling Debug Mode

1. Open **Obsidian Settings**
2. Navigate to **AI Tagger Universe** plugin settings
3. Scroll to the bottom of **LLM settings** section
4. Toggle **"Debug mode"** ON
5. A notice will confirm debug mode is enabled

## What Debug Mode Does

When enabled, the plugin logs detailed information to the browser console:

### Tag Parsing
- Raw LLM response (first 500 characters)
- Parsed JSON structure
- Field names found in response (matchedExistingTags, suggestedTags, etc.)

### Tag Sanitization
- Shows EVERY tag before and after cleaning
- Identifies which malformed prefixes were removed
- Example: `"tag:matchedExistingTags-medical-research" -> "medical-research"`

### Tag Processing
- Shows tags at each stage of processing
- Displays final tag arrays sent to frontmatter

## Viewing Debug Logs

### In Obsidian Desktop:
1. Press **Cmd+Option+I** (Mac) or **Ctrl+Shift+I** (Windows/Linux)
2. Click the **Console** tab
3. Look for messages starting with `[AI Tagger Debug]`

### In Obsidian Mobile:
Debug mode is less useful on mobile as console access is limited.

## How to Use Debug Logs to Find Issues

### If you see malformed tags:

1. **Check the Raw Response** section:
   - Does the LLM itself return malformed tags?
   - Example: If you see `"matchedExistingTags": ["tag:matchedExistingTags-health"]`
   - The LLM is creating the problem

2. **Check the Sanitization** section:
   - Do you see `Tag sanitization: "tag:xyz" -> "xyz"`?
   - If YES: Sanitization is working
   - If NO: The tag passed through without cleaning (report this!)

3. **Check Final Arrays**:
   - `After sanitization - matchedExistingTags: ["health", "medical"]`
   - These should be clean tags

### If tags are missing:

1. Look for `Parsed JSON response` - are tags present in the LLM response?
2. Check for error messages in console
3. Verify the tagging mode matches what you expect

## Sharing Debug Logs

When reporting issues:

1. Enable debug mode
2. Reproduce the issue (generate tags for a note)
3. Copy relevant console logs (right-click in console → Save as...)
4. Include:
   - The raw LLM response
   - Sanitization logs
   - Final tag arrays
   - Your LLM provider and model name

## Performance Note

Debug mode adds console logging overhead. Disable it when not troubleshooting for better performance, especially during batch operations.

## Disabling Debug Mode

1. Go back to plugin settings
2. Toggle **"Debug mode"** OFF
3. Console logging will stop immediately
