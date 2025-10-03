# AI Tagger Universe: Easy Tag Generation & Management for Obsidian

![AI Tagger Universe](https://img.shields.io/badge/Obsidian-AI%20Tagger%20Universe-blue)
![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22ai-tagger-universe%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![Obsidian Compatibility](https://img.shields.io/badge/Obsidian-v1.4.0+-blue)

Automatically generate intelligent tags for your Obsidian notes using AI. This plugin analyzes your content and adds relevant tags to your note's frontmatter, helping you organize and discover connections in your knowledge base.

## 🔌 Installation

This plugin can be installed directly from the Obsidian Community Plugins browser:

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Disable Safe Mode (if enabled)
4. Search for "AI Tagger Universe"
5. Click Install, then Enable

Alternatively, you can manually install the plugin:

1. Download the latest release from this repository
2. Extract the files to your Obsidian vault's `.obsidian/plugins/ai-tagger-universe` folder
3. Reload Obsidian and enable the plugin in the Community Plugins settings

## ✨ Key Features

### 🤖 Flexible AI Integration

- **Use your preferred AI service**:
  - **Local LLMs**: Ollama, LM Studio, LocalAI, or any OpenAI-compatible endpoint
  - **Cloud Services**: OpenAI, Claude, Gemini, Groq, Grok, Mistral, DeepSeek, Cohere, SiliconFlow, Aliyun, Bedrock, Vertex AI, OpenRouter, and more

### 🏷️ Smart Tagging System

- **Multiple tagging modes**:
  - Generate completely new tags based on content
  - Match against your existing vault tags
  - Use predefined tags from a custom list
  - Hybrid modes combining generation with existing/predefined tags
- **Batch operations** for tagging multiple notes at once
- **Multilingual support** for generating tags in your preferred language

### 📊 Tag Network Visualization

- Interactive graph showing relationships between tags
- Discover connections and patterns in your knowledge base
- Search functionality to find specific tags
- Node size indicates tag frequency

### 🛠️ Advanced Management

- Generate tags from selected text portions
- Batch tag entire folders or your whole vault
- Clear tags while preserving other frontmatter
- Collect and export all tags from your vault

## 🚀 Quick Start

1. **Install the plugin** from Obsidian Community Plugins
2. **Configure your AI provider**:
   - Choose between Local LLM or Cloud Service
   - Enter your endpoint URL and API key (if needed)
3. **Select your tagging mode** and adjust tag generation limits
4. **Generate tags** for your current note using the ribbon icon or command palette

## 🔧 Configuration Options

- **AI Provider**: Choose from 15+ local and cloud services
- **Tagging Mode**: Select how tags are generated or matched
- **Tag Limits**: Set maximum numbers for generated/matched tags (0-10)
- **Excluded Paths**: Skip specific folders during batch operations
- **Language**: Generate tags in your preferred language

## 📖 Usage Examples

- **Research Notes**: Automatically categorize research papers and findings
- **Project Management**: Tag project notes for better organization
- **Knowledge Base**: Discover connections between concepts
- **Content Creation**: Generate relevant tags for blog posts or articles
- **Personal Journal**: Track themes and topics in your journal entries

## 🌐 Language Support

Generate tags in multiple languages including English, Chinese, Japanese, German, French, Spanish, Russian, and many more.

## 🔄 Fork Improvements

This fork includes several enhancements over the original plugin:

### Bug Fixes

- **Fixed malformed tag prefixes**: Resolved issue where some LLMs would generate tags like `tag:matchedExistingTags-medical-research` instead of clean tags like `medical-research`
  - Added robust tag sanitization that strips malformed prefixes (`tag:`, `matchedExistingTags-`, `suggestedTags-`, etc.)
  - Enhanced prompts with explicit examples of correct vs. incorrect tag formats

### Prompt Engineering Improvements

- **Claude-optimized prompts**: Restructured all prompts using XML-style tags (`<task>`, `<requirements>`, `<output_format>`) for better LLM comprehension
- **Enforced kebab-case formatting**: All tagging modes now consistently generate tags in kebab-case format (e.g., `machine-learning`, `data-science`)
- **Improved tag quality guidelines**: Added explicit requirements for concise (1-3 words), specific, and descriptive tags
- **Real-world examples**: Replaced placeholder examples with actual domain-appropriate tag examples
- **Consistent structure**: Unified prompt structure across all tagging modes (GenerateNew, PredefinedTags, Hybrid, Custom)

### Code Quality

- **Enhanced error handling**: Better validation and sanitization of LLM responses
- **Comprehensive documentation**: Improved inline code comments and type definitions

### Testing

- Included test script (`test-sanitization.js`) for verifying tag generation with your actual LLM endpoint
- See `TEST_INSTRUCTIONS.md` for testing guidance

These improvements result in more reliable tag generation, better formatting consistency, and improved compatibility with various LLM providers including Claude, GPT-4, and local models.

