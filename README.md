# An easy to use tool for tag your notes using ai-tagger-universe

An Obsidian plugin that automatically analyzes note content and adds relevant tags to the note's frontmatter using AI.

## Features

- Multiple AI Service Support:
  - Local LLM Support:
    - Ollama
    - LM Studio
    - LocalAI
    - Any OpenAI-compatible API endpoint
  - Cloud LLM Services:
    - OpenAI
    - Google Gemini
    - DeepSeek
    - Aliyun Qwen
    - Anthropic Claude
    - Groq LLM
    - Google Vertex AI
    - OpenRouter
    - AWS Bedrock
    - Requesty
    - Cohere
    - Grok
    - Mistral AI
    - OpenAI-compatible services
- Smart Tag Analysis:
  - Matches 1-3 tags from existing tag library
  - Generates 3-10 new relevant tags
- Automatic frontmatter integration
- Comprehensive settings interface
- Tag Management:
  - AI-powered tag generation
  - Quick tag clearing
- Keyboard shortcut support (Mod+Shift+T)

## Installation

1. Install the plugin in Obsidian
2. Configure plugin settings:
   
   Choose between Local LLM or Cloud Service:

   ### Local LLM Service:
   - Endpoint URL (varies by service):
     - Ollama: `http://localhost:11434/v1/chat/completions`
     - LM Studio: `http://localhost:1234/v1/chat/completions`
     - LocalAI: `http://localhost:8080/v1/chat/completions`
   - Model name (default: llama2)

   ### Cloud LLM Services:
   Choose from multiple providers with their respective endpoints and models:

   - OpenAI
     - Endpoint: https://api.openai.com/v1/chat/completions
     - Models: gpt-3.5-turbo, gpt-4, etc.

   - Google Gemini
     - Endpoint: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
     - Model: gemini-pro

   - DeepSeek
     - Endpoint: https://api.deepseek.com/v1/chat/completions
     - Model: deepseek-chat

   - Aliyun Qwen
     - Endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
     - Model: qwen-max

   - Anthropic Claude
     - Endpoint: https://api.anthropic.com/v1/complete
     - Model: claude-3-opus-20240229

   - Groq LLM
     - Endpoint: https://api.groq.com/openai/v1/chat/completions
     - Model: mixtral-8x7b-32768

   - Google Vertex AI
     - Endpoint: https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/{endpoint}:predict
     - Model: gemini-pro

   - OpenRouter
     - Endpoint: https://openrouter.ai/api/v1/chat/completions
     - Various models available

   - AWS Bedrock
     - Endpoint: https://bedrock-runtime.amazonaws.com
     - Model: anthropic.claude-v2

   - Requesty
     - Endpoint: https://api.requesty.ai/v1/chat/completions
     - Model: gpt-4

   - Cohere
     - Endpoint: https://api.cohere.ai/v1/generate
     - Model: command

   - Grok
     - Endpoint: https://api.grok.x.ai/v1/chat/completions
     - Model: grok-1

   - Mistral AI
     - Endpoint: https://api.mistral.ai/v1/generate
     - Model: mistral-medium

   - OpenAI-compatible
     - Custom endpoint supporting OpenAI API format
     - Compatible model names

3. Usage:
   - Open a note
   - Use keyboard shortcut Mod+Shift+T (Cmd+Shift+T on Mac)
   - Or open command palette (Ctrl/Cmd + P)
   - Search for "Analyze Current Note and Add Tags"
   - Tags will be automatically added to the note's frontmatter

   ### Keyboard Shortcuts:
   Default shortcuts and customizable commands:
   - "Analyze Current Note and Add Tags" - Default: Mod+Shift+T
   - "Clear All Tags" - Customizable in Obsidian's Hotkeys settings

## Local LLM Setup

### Ollama Setup

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

### LM Studio Setup

1. Download and install LM Studio from [LM Studio website](https://lmstudio.ai)
2. Load your preferred model
3. Start the local server
4. Use the default endpoint: `http://localhost:1234/v1/chat/completions`

### LocalAI Setup

Follow the installation instructions from [LocalAI GitHub](https://github.com/go-skynet/LocalAI)

## Cloud LLM Setup

To use a cloud LLM service:

1. Obtain API credentials from your chosen provider
2. Configure in plugin settings:
   - Select your cloud provider from the dropdown
   - Enter your API key
   - Verify the pre-filled API endpoint for your service
   - Confirm the default model or select a different one

The plugin will automatically set the appropriate endpoint and default model when you switch providers.

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

- **AI Tag Generation**: Use keyboard shortcut or command palette to analyze current note
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

- `src/`: Source code directory
  - `main.ts`: Core plugin logic and UI
  - `tagUtils.ts`: Tag manipulation utilities
  - `services/`: AI service implementations
    - `types.ts`: Service interfaces and types
    - `baseService.ts`: Abstract base service class
    - `localService.ts`: Local LLM service implementation
    - `cloudService.ts`: Cloud LLM service implementation
    - `adapters/`: LLM service adapters
      - Individual adapters for each supported service
      - Shared adapter utilities and types
    - `index.ts`: Service exports
- `manifest.json`: Plugin manifest
- `styles.css`: UI styles
- `package.json`: Project configuration
- `README.md`: Documentation
- `tsconfig.json`: TypeScript configuration
- `esbuild.config.mjs`: Build configuration

### Error Handling

- Robust error handling with:
  - API configuration validation
  - Type-safe error processing
  - Graceful failure handling
  - Clear error notifications
  - Resource cleanup on unload
  - Detailed error messages
  - Automatic retry for transient failures

# Support Developer

If you find this plugin helpful, consider buying me a coffee ☕️

如果您觉得这个插件对您的工作有帮助，欢迎请我喝杯咖啡 ☕️

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/niehu2015o)

## License

MIT
