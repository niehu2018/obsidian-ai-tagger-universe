# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Skills

### obsidian-plugin-dev
**Use for Obsidian API and plugin development.** Contains:
- Plugin API reference and TypeScript definitions
- UI components (Modal, Setting, ItemView, etc.)
- CSS variables for theming
- Best practices for plugin development

### frontend-design
**Use for UI/UX design and styling.** Creates distinctive, production-grade interfaces with high design quality. Use when building modals, views, or improving visual components.

## Language Requirements

**All code comments and commit messages MUST be in English.**

- Write all code comments in English only
- Write all git commit messages in English only
- Variable names, function names, and documentation should be in English
- The only exception is i18n translation strings (which contain Chinese translations)

## Build Commands

```bash
# Development build with watch mode and inline sourcemaps
npm run dev

# Production build (type-checks, then bundles)
npm run build

# Version bump (updates manifest.json and versions.json)
npm run version
```

The build process uses esbuild to bundle `src/main.ts` into `main.js`. Production builds disable sourcemaps; dev builds enable inline sourcemaps.

## Architecture Overview

### Core Plugin Structure

**Entry Point**: `src/main.ts` (`AITaggerPlugin` class)
- Main plugin class extending Obsidian's `Plugin`
- Manages lifecycle: settings loading, LLM service initialization, command registration
- Handles tag operations: `analyzeAndTagNote()`, `showTagNetwork()`, batch processing
- Central coordinator between services, UI, and Obsidian API

### Service Layer Architecture

**LLM Services** (`src/services/`)
- **Base abstractions**: `LLMService` interface defines contract for all providers
- **Two service types**:
  - `LocalLLMService`: Ollama, LM Studio, LocalAI, OpenAI-compatible endpoints
  - `CloudLLMService`: Cloud providers (OpenAI, Claude, Gemini, Groq, etc.)
- **Adapter pattern** (`src/services/adapters/`): Each cloud provider has its own adapter (e.g., `claudeAdapter.ts`, `geminiAdapter.ts`) handling API-specific formatting
- **Prompt engineering** (`src/services/prompts/tagPrompts.ts`): XML-structured prompts optimized for Claude/GPT with clear task/requirements/output sections

**Key service flow**:
1. Plugin calls `llmService.analyzeTags(content, candidateTags, mode, maxTags, language)`
2. Service builds prompt via `buildTagPrompt()` with mode-specific instructions
3. For cloud: Adapter formats request → calls API → parses response
4. Returns `LLMResponse` with `suggestedTags` and `matchedExistingTags`

### Tagging Modes

Four distinct modes in `TaggingMode` enum:
- **GenerateNew**: AI creates entirely new tags from content
- **PredefinedTags**: AI selects only from existing vault/file tags
- **Hybrid**: Combines both (generates new + matches existing)
- **Custom**: User-defined prompt with custom instructions

Mode selection affects prompt structure and tag merging logic in `analyzeAndTagNote()`.

### Settings & Configuration

**Settings schema** (`src/core/settings.ts`):
- `AITaggerSettings` interface with 20+ configuration options
- Key settings: `serviceType`, `taggingMode`, `cloudServiceType`, `interfaceLanguage`
- Settings UI split into modular sections (`src/ui/settings/`):
  - `LLMSettingsSection`: Service provider configuration
  - `TaggingSettingsSection`: Mode selection, tag limits, exclusions
  - `InterfaceSettingsSection`: Language selection (zh-cn/en)

**Settings persistence**: Loaded in `loadSettings()`, saved via `saveSettings()`, triggers service reinitialization.

### Internationalization (i18n)

**Translation system** (`src/i18n/`):
- Supported languages: English (`en.ts`) and Simplified Chinese (`zh-cn.ts`)
- Type-safe translations via `Translations` interface
- Access translations: `this.t.settings.someKey` or `plugin.t.messages.someMessage`
- Language switch requires Obsidian restart to update all UI elements

**Adding new i18n strings**:
1. Add to `Translations` interface in `types.ts`
2. Implement in both `en.ts` and `zh-cn.ts`
3. Reference via `t.section.key` in code

### Tag Utilities & Operations

**Core utilities** (`src/utils/tagUtils.ts`):
- `TagUtils.formatTags()`: Sanitizes tags (removes prefixes, enforces kebab-case)
- `TagUtils.updateNoteTags()`: Modifies frontmatter YAML, handles merge vs replace
- `TagUtils.getAllTags()`: Extracts all tags from vault frontmatter
- `TagUtils.getTagsFromFile()`: Reads predefined tags from markdown file

**Tag formatting rules**:
- Remove `#` prefix and malformed prefixes (`tag:`, `matchedExistingTags-`, etc.)
- Convert to kebab-case (spaces/special chars → hyphens)
- Preserve `/` for nested tags (e.g., `science/biology`)

**Tag operations** (`src/utils/tagOperations.ts`):
- Batch processing with progress notifications
- Handles file reading, content analysis, frontmatter updates

### Tag Network Visualization

**Implementation** (`src/ui/views/TagNetworkView.ts`):
- Custom Obsidian `ItemView` for graph visualization
- Dynamically loads D3.js v7 from CDN
- Network data built by `TagNetworkManager` (`src/utils/tagNetworkUtils.ts`)
- Interactive features: search filtering, hover tooltips, node dragging

**Network structure**:
- Nodes: Tags with frequency and size
- Edges: Co-occurrence relationships between tags
- Color coding by frequency (low/medium/high)

## Command Registration

Commands registered in `src/commands/`:
- `generateCommands.ts`: Tag generation for notes/folders/vault
- `clearCommands.ts`: Clear tags from notes/folders/vault
- `predefinedTagsCommands.ts`: Assign predefined tags
- `utilityCommands.ts`: Collect tags, show network visualization

All commands use `plugin.addCommand()` with i18n names and icon support.

## Important Implementation Patterns

### Prompt Engineering Standards

All prompts use XML-style structure:
```
<task>What to do</task>
<requirements>Constraints and rules</requirements>
<output_format>Expected format with examples</output_format>
```

This format optimized for Claude/GPT-4 comprehension. Include language instructions for non-English tag generation.

### Tag Sanitization Pipeline

Always sanitize LLM outputs:
1. Extract tags from response (handle JSON, markdown, plain text)
2. Apply `formatTags()` to strip malformed prefixes
3. Normalize to kebab-case
4. Remove duplicates and empty strings

### Frontmatter Handling

Use Obsidian's `metadataCache` for reading, `vault.modify()` for writing:
- Parse YAML with `js-yaml` library
- Preserve non-tag frontmatter fields
- Handle edge cases: no frontmatter, malformed YAML, empty tags

### Error Handling

- Use `TagOperationResult` interface for operation outcomes
- Show user-friendly notices via `Notice` class
- Debug mode (`settings.debugMode`) enables console logging
- Graceful degradation: failed operations return `{success: false, message: ...}`

## Testing Approach

No formal test suite exists. Testing process:
1. Build plugin: `npm run build`
2. Copy `main.js`, `manifest.json`, `styles.css` to Obsidian test vault's `.obsidian/plugins/ai-tagger-universe/`
3. Reload Obsidian (Ctrl/Cmd+R or restart)
4. Test with various LLM providers and tagging modes
5. Check console logs if `debugMode` is enabled

Manual testing script available: `test-sanitization.js` (see `TEST_INSTRUCTIONS.md`).

## Code Organization Principles

### Modular Settings UI
Each settings section is a separate class extending `BaseSettingSection`. Add new sections by creating a class in `src/ui/settings/` and instantiating in `AITaggerSettingTab.ts`.

### Service Adapters
New cloud providers require:
1. Create adapter in `src/services/adapters/[provider]Adapter.ts`
2. Implement `CloudServiceAdapter` interface
3. Add to `AdapterType` type and `adapters` map in `index.ts`
4. Update settings UI dropdown

### Command Pattern
Commands are isolated in `src/commands/` by category. New commands follow pattern:
```typescript
plugin.addCommand({
    id: 'unique-command-id',
    name: plugin.t.commands.commandName,
    icon: 'lucide-icon-name',
    callback: async () => { /* implementation */ }
});
```

## Critical Files for Modifications

- **Adding features**: Start with `src/main.ts` to understand plugin flow
- **Prompt changes**: Edit `src/services/prompts/tagPrompts.ts`
- **UI modifications**: `src/ui/settings/AITaggerSettingTab.ts` and section files
- **New LLM providers**: `src/services/adapters/` and update `cloudService.ts`
- **Tag processing logic**: `src/utils/tagUtils.ts`
- **Translations**: `src/i18n/en.ts` and `src/i18n/zh-cn.ts`

## Version Management

Version is stored in three places (must stay in sync):
- `package.json` → `version`
- `manifest.json` → `version`
- `versions.json` → add new entry

Use `npm run version` to bump all three automatically via `version-bump.mjs`.

## Releasing a New Version

Obsidian plugin releases require uploading binary files to the GitHub release:

1. **Update version** in `package.json`, `manifest.json`, and `versions.json`
2. **Build the plugin**: `npm run build`
3. **Create git tag** matching the version exactly (e.g., `1.0.16`, NOT `v1.0.16`)
4. **Create GitHub release** with the tag
5. **Upload required files** to the release:
   - `main.js` (required)
   - `manifest.json` (required)
   - `styles.css` (required if plugin has styles)

```bash
# Example release workflow
git tag 1.0.16
git push origin 1.0.16
gh release create 1.0.16 --title "v1.0.16" --notes "Release notes here"
gh release upload 1.0.16 main.js manifest.json styles.css
```

**Important**: The release tag must match the version in `manifest.json` exactly. Obsidian uses this to locate and download plugin files.

## Known Constraints

- Obsidian API externals must match platform version (defined in `esbuild.config.mjs`)
- TypeScript compilation is strict mode with ES2020 target
- D3.js loaded dynamically from CDN (no bundling) for network visualization
- Settings changes (especially service type/language) may require Obsidian restart
- Tag formatting preserves `/` for nested tags but converts other special chars to hyphens
