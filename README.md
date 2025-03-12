# AI Tagger Universe for Obsidian (v1.0.7)

An Obsidian plugin that intelligently analyzes your note content and automatically adds relevant tags to your note's frontmatter using advanced AI services. Choose from multiple local and cloud AI providers to power your tag generation.

![AI Tagger Universe](https://img.shields.io/badge/Obsidian-AI%20Tagger%20Universe-blue)

## Features

- **Multi-Provider AI Support**
  - **Local LLM Services:**
    - Ollama
    - LM Studio
    - LocalAI
    - Any OpenAI-compatible endpoint
  - **Cloud LLM Services:**
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

- **Smart Tag Analysis**
  - Matches 1–3 tags from your existing tag library
  - Generates 3–10 new tags based on note content
  - Automatically integrates tags into note frontmatter

- **Enhanced Tag Management**
  - Generate tags for the current note
  - Generate tags from selected text
  - Batch tagging for multiple notes via file menu
  - Collect all tags from your vault
  - Assign predefined tags (from a user-specified file) to one or all notes
  - Clear tags from a note or all notes while preserving frontmatter structure
  - Visualize tag relationships with interactive tag network graph

- **Tag Network Visualization**
  - Interactive network graph showing relationships between tags
  - Node size represents tag frequency in notes
  - Connections show tags that appear together
  - Search functionality to find specific tags
  - Hover tooltips with detailed tag information

- **User Friendly Interface**
  - Dedicated settings page for configuring AI providers and tag generation limits
  - Ribbon icons for quick access to common operations:
    - Generate tags for current note
    - Show tag network visualization
    - Access batch operations via file context menu

## Installation

1. **Install the plugin in Obsidian:**  
   Follow the standard community plugin installation process.

2. **Configure Plugin Settings:**
   - Open the plugin's settings panel
   - Choose your AI service type: **Local LLM** or **Cloud Service**
   - For **Local LLM**, enter:
     - **Endpoint URL:**  
       - Ollama: `http://localhost:11434/v1/chat/completions`
       - LM Studio: `http://localhost:1234/v1/chat/completions`
       - LocalAI: `http://localhost:8080/v1/chat/completions`
     - **Model Name:** (default: `llama2`)
   - For **Cloud LLM Services**, select your provider:
     - Available options include OpenAI, Google Gemini, DeepSeek, Aliyun Qwen, Anthropic Claude, Groq LLM, Google Vertex AI, OpenRouter, AWS Bedrock, Requesty, Cohere, Grok, Mistral AI, and OpenAI-compatible
     - The plugin will pre-fill the API endpoint and model based on the selected provider. Modify as needed.
     - Enter your API key

3. **Predefined Tags (Optional):**
   - Set the path to a file containing predefined tags (one tag per line)
   - Configure the maximum number of predefined tags to assign

## Usage

### Available Commands

1. **Tag Generation Commands**
   - `Generate tags for current note`: Generate tags for the active note
   - `Generate tags on selected text`: Generate tags based on selected content
   - `Generate tags for all notes in current folder`: Process all notes in current directory
   - `Generate tags for all notes in vault`: Process all markdown notes in vault

2. **Tag Management Commands**
   - `Assign pre-defined tags for current note`: Apply predefined tags to current note
   - `Assign pre-defined tags for all notes in vault`: Apply predefined tags to all notes
   - `Collect all tags from all notes in vault`: Aggregate all tags from vault

3. **Tag Cleanup Commands**
   - `Clear all tags in current note`: Remove tags from current note
   - `Clear all tags in all vault`: Remove tags from all notes in vault

4. **Tag Visualization Commands**
   - `Show tag network visualization`: Display interactive tag network graph

### Basic Usage

- **Generate Tags:**
  - **Current Note**: Click the ribbon icon or run "Generate tags for current note"
  - **Selected Text**: Select content and run "Generate tags on selected text"
  - **Folder**: Open a note, then run "Generate tags for all notes in current folder"
  - **All Notes**: Process all markdown notes in your vault

- **Batch Operations:**
  - **File Menu:** Right-click on one or more markdown files to:
    - Generate tags for selected notes
    - Assign predefined tags to selected notes

- **Clean Tags:**
  - **Clear All Tags in current Note:** Remove tags from the current note
  - **Clear All Tags in Vault:** Batch remove tags from every note in your vault

- **Visualize Tags:**
  - **Show Tag Network:** View an interactive visualization of tag relationships and frequencies

- **Collect Existing Tags:**
  - **Collect All Tags in Vault:** Aggregate tags from all notes in your vault for review or tag library updates

## Tag Generation Process

1. The plugin analyzes note content using your selected AI provider
2. It matches existing tags (1–3) and generates new suggestions (3–10)
3. The plugin automatically updates or creates the frontmatter with combined tags
4. Settings allow you to adjust tag limits and the output language

## Development

### Build Instructions

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build
```

### Project Structure

- **src/**: Main source code folder
  - **main.ts**: Core plugin implementation and UI integration
  - **tagUtils.ts**: Utilities for tag manipulation and frontmatter updates
  - **tagNetwork.ts**: Tag network visualization implementation
  - **services/**: AI service implementations
    - **baseService.ts**: Base class for service implementations
    - **localService.ts**: Implementation for local LLM services
    - **cloudService.ts**: Implementation for cloud LLM services
    - **adapters/**: Adapters for various AI providers
    - **types.ts**: Shared service interfaces and types
- **manifest.json**: Plugin manifest
- **styles.css**: UI styling
- **package.json**, **tsconfig.json**, **esbuild.config.mjs**: Configuration files

## Troubleshooting & Error Handling

- **Error Prevention and Recovery:**
  - Comprehensive API configuration validation
  - Type-safe error processing with detailed notifications
  - Automatic retries for transient API failures
  - Check developer console for detailed error logs
  - Use Obsidian's undo function to revert any changes

## Support & Contributions

If you find the plugin useful, please consider [buying me a coffee](https://buymeacoffee.com/niehu2015o) to support ongoing development.

## License

[MIT](LICENSE)
