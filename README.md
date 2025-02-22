# Obsidian AI Tagger

An Obsidian plugin that automatically analyzes note content and adds relevant tags to the note's frontmatter using AI.

## Features

- Multiple AI Service Support:
  - Local LLM via Ollama
  - Custom Cloud LLM Services
  - Configurable API endpoints
  - Custom model selection
- Smart Tag Analysis:
  - Matches 1-3 tags from existing tag library
  - Generates 3-10 new relevant tags
- Automatic frontmatter integration
- Comprehensive settings interface
- Tag Management:
  - AI-powered tag generation
  - Quick tag clearing with keyboard shortcut

## Installation

1. Install the plugin in Obsidian
2. Configure plugin settings:
   
   Choose between Local LLM or Cloud Service:

   ### Local LLM (Ollama):
   - Endpoint URL (default: http://localhost:11434)
   - Model name (default: llama2)

   ### Cloud LLM Service:
   - API Key
   - Base URL (e.g., https://api.openai.com/v1)
   - Model name (e.g., gpt-3.5-turbo)

3. Usage:
   - Open a note
   - Open command palette (Ctrl/Cmd + P)
   - Search for "Analyze Current Note and Add Tags"
   - Tags will be automatically added to the note's frontmatter

   ### Keyboard Shortcuts:
   - `Cmd + Shift + T` (macOS) / `Ctrl + Shift + T` (Windows/Linux): Clear all tags while keeping the tags field
   - Use command palette for other operations like analyzing note content

## Local LLM Setup (Ollama)

To use Ollama as your local LLM provider:

1. Install Ollama:
   - Visit [Ollama website](https://ollama.ai) to download and install
   - For macOS/Linux users, you can also install via terminal:
     ```bash
     curl https://ollama.ai/install.sh | sh
     ```

2. Download and run models:
   ```bash
   # Download default llama2 model
   ollama pull llama2
   
   # Or download other supported models
   ollama pull mistral
   ollama pull codellama
   ```

## Cloud LLM Setup

To use a cloud LLM service:

1. Obtain API credentials from your chosen provider
2. Configure in plugin settings:
   - Enter your API key
   - Set the base URL for your service
   - Specify the model name
   
Examples:
- OpenAI:
  - Base URL: https://api.openai.com/v1
  - Model: gpt-3.5-turbo
- Azure OpenAI:
  - Base URL: https://your-resource.openai.azure.com
  - Model: your-deployed-model
- Custom Service:
  - Use any compatible service that follows similar API format

## Tag Generation Process

The plugin performs the following steps:
1. Analyzes note content using selected AI provider
2. Matches 1-3 relevant tags from existing tag library
3. Generates 3-10 new tags based on content context
4. Automatically merges new tags with existing tags in frontmatter
5. Updates or creates frontmatter with combined tags

Settings allow you to adjust:
- Number of existing tags to match (1-3)
- Number of new tags to generate (3-10)

## Tag Management

- **AI Tag Generation**: Use command palette or configured hotkeys to analyze current note and add relevant tags
- **Clear All Tags**: Use command palette to quickly clear all tags while preserving the tags field in frontmatter
  - This operation only removes tag values, keeping the structure intact
  - Useful for starting fresh with tag organization
  - Can be undone with Obsidian's undo function

## Development

### Build Instructions

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build
```

### Project Structure

- `main.ts`: Core plugin logic
- `manifest.json`: Plugin manifest
- `styles.css`: UI styles
- `package.json`: Project configuration
- `README.md`: Documentation
- `.gitignore`: Git ignore rules
- `tsconfig.json`: TypeScript configuration
- `esbuild.config.mjs`: Build configuration

### Error Handling

- Validates API configuration
- Handles API failures gracefully
- Provides error notifications
- Logs detailed errors to console

## Support

如果你觉得这个插件对你有帮助，可以考虑给我买杯咖啡 ☕️

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/niehu2015o)

## License

MIT
