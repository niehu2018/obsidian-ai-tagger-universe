# Testing Tag Sanitization Fix

## Setup

1. **Copy your settings file** from your Obsidian vault:
   ```bash
   cp ~/.../your-vault/.obsidian/plugins/ai-tagger-universe/data.json .
   ```

   Or manually copy the file to this directory and name it `data.json`

2. **Run the test script**:
   ```bash
   node test-sanitization.js
   ```

## What the test does

1. Loads your actual LLM settings (endpoint, API key, model)
2. Sends a test document about medical research to your configured LLM
3. Uses the **Hybrid mode** prompt (most likely to trigger the bug)
4. Shows you the raw LLM response
5. Displays tags before and after sanitization
6. Marks malformed tags with ❌ and clean tags with ✓

## Expected Results

### If the bug exists (before fix):
You'll see tags like:
- ❌ `tag:matchedExistingTags-medical-research`
- ❌ `suggestedTags-health-science-education`

After sanitization, they become:
- ✓ `medical-research`
- ✓ `health-science-education`

### If the LLM behaves well (after prompt improvements):
All tags will be clean from the start:
- ✓ `medical-research`
- ✓ `health`
- ✓ `education`

## Testing in Obsidian

After verifying the fix works:

1. **Build the plugin**:
   ```bash
   npm run build
   ```

2. **Copy to your vault**:
   ```bash
   cp main.js "path/to/your/vault/.obsidian/plugins/ai-tagger-universe/"
   ```

3. **Reload Obsidian** (or disable/enable the plugin)

4. **Test on a real note** with the tag generation command

## Notes

- The test script includes both the improved prompt AND the sanitization logic
- It tests against your actual LLM endpoint, so you'll see real-world behavior
- The script is safe - it only reads your settings and makes a single test API call
