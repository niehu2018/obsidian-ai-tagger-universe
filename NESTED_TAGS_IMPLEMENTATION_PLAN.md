# Nested Tags Implementation Plan

## 📋 Overview

This document outlines the implementation plan for supporting nested/hierarchical tags in AI Tagger Universe, addressing GitHub Issues #20 and #21.

**Issue #20**: Support for nested tags like `#CS/Machine-Learning`
**Issue #21**: Ability to merge existing flat tags into hierarchical structure (e.g., `#apple` → `#fruit/apple`)

---

## 🎯 Goals

1. **Enable hierarchical tag generation**: Allow AI to generate nested tags (e.g., `science/biology/genetics`)
2. **Maintain existing functionality**: Ensure backward compatibility with flat tags
3. **User control**: Provide configuration options for enabling/disabling nested tags
4. **Smart reorganization**: Optionally reorganize existing flat tags into hierarchies

---

## 🏗️ Architecture

### Current State Analysis

✅ **Already Supported**:
- Obsidian natively supports nested tags with `/` separator
- Code already preserves `/` in tags (regex: `[^\p{L}\p{N}/-]`)
- Tag formatting system is hierarchy-compatible

❌ **Missing Components**:
- LLM prompts don't encourage hierarchical thinking
- No UI configuration for nested tags
- No hierarchy-aware tag analysis
- No reorganization tools for existing tags

---

## 📅 Implementation Phases

### Phase 1: Basic Nested Tag Generation (MVP)
**Priority**: ⭐⭐⭐⭐⭐ | **Complexity**: Low | **Time**: 1-2 days

#### 1.1 Settings Schema
File: `src/core/settings.ts`

```typescript
export interface AITaggerSettings {
    // ... existing settings ...

    // Nested Tags Settings
    enableNestedTags: boolean;           // Enable nested tag generation
    nestedTagsMaxDepth: number;          // Max hierarchy depth (1-3)
    nestedTagsStrategy: 'auto' | 'manual'; // Future use
}

export const DEFAULT_SETTINGS: AITaggerSettings = {
    // ... existing defaults ...

    enableNestedTags: false,
    nestedTagsMaxDepth: 2,
    nestedTagsStrategy: 'auto',
}
```

#### 1.2 Prompt Engineering
File: `src/services/prompts/tagPrompts.ts`

**Key Changes**:
- Add nested tag instructions when `enableNestedTags` is true
- Provide clear examples of hierarchical tags
- Explain when to use nested vs flat tags

**Example Addition**:
```typescript
if (pluginSettings?.enableNestedTags) {
    prompt += `
<nested_tags_requirements>
Generate tags in hierarchical/nested format using forward slashes (/) when appropriate.
Use nested tags to show relationships from general to specific concepts.

Structure: parent/child or parent/child/grandchild (max ${maxDepth} levels)

Good Examples:
- technology/artificial-intelligence/machine-learning
- science/biology/genetics
- programming/languages/python
- business/marketing/social-media

When to use nested tags:
1. Clear categorical hierarchy exists
2. Concept has a broader parent topic
3. Helps organize by domain

When to use flat tags:
1. Concept is independent
2. No clear parent category
3. Simple, standalone topics

Generate a mix of nested and flat tags based on content.
</nested_tags_requirements>
`;
}
```

#### 1.3 UI Configuration
File: `src/ui/settings/AITaggerSettingTab.ts`

Add settings section:
```typescript
containerEl.createEl('h3', { text: t.settings.nestedTagsSettings });

new Setting(containerEl)
    .setName(t.settings.enableNestedTags)
    .setDesc(t.settings.enableNestedTagsDesc)
    .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableNestedTags)
        .onChange(async (value) => {
            this.plugin.settings.enableNestedTags = value;
            await this.plugin.saveSettings();
        }));

new Setting(containerEl)
    .setName(t.settings.nestedTagsMaxDepth)
    .setDesc(t.settings.nestedTagsMaxDepthDesc)
    .addSlider(slider => slider
        .setLimits(1, 3, 1)
        .setValue(this.plugin.settings.nestedTagsMaxDepth)
        .setDynamicTooltip()
        .onChange(async (value) => {
            this.plugin.settings.nestedTagsMaxDepth = value;
            await this.plugin.saveSettings();
        }));
```

---

### Phase 2: Hierarchy-Aware Intelligence (Intermediate)
**Priority**: ⭐⭐⭐⭐ | **Complexity**: Medium | **Time**: 2-3 days

#### 2.1 Hierarchy Analysis Utilities
File: `src/utils/tagHierarchyUtils.ts` (new file)

**Core Functions**:
```typescript
export interface TagHierarchy {
    tag: string;
    parent: string | null;
    children: string[];
    level: number;
    fullPath: string;
}

export class TagHierarchyUtils {
    // Parse tag into hierarchy components
    static parseTagHierarchy(tag: string): TagHierarchy

    // Build complete hierarchy tree from vault tags
    static buildTagHierarchyTree(app: App): Map<string, TagHierarchy>

    // Get all ancestors of a tag
    static getTagAncestors(tag: string): string[]

    // Find root category
    static getRootCategory(tag: string): string

    // Group tags by root
    static groupTagsByRoot(tags: string[]): Map<string, string[]>

    // Suggest parent categories for new tags
    static suggestParentCategories(
        newTag: string,
        existingTags: string[],
        maxSuggestions: number
    ): string[]
}
```

#### 2.2 Context-Aware Prompts
File: `src/services/prompts/tagPrompts.ts`

**Enhancement**:
```typescript
export function buildTagPromptWithHierarchy(
    content: string,
    candidateTags: string[],
    mode: TaggingMode,
    maxTags: number,
    language?: LanguageCode
): string {
    let prompt = buildTagPrompt(content, candidateTags, mode, maxTags, language);

    if (pluginSettings?.enableNestedTags && candidateTags.length > 0) {
        const rootCategories = TagHierarchyUtils.groupTagsByRoot(candidateTags);
        const hierarchyExamples = Array.from(rootCategories.entries())
            .slice(0, 10)
            .map(([root, tags]) => `${root}: ${tags.slice(0, 3).join(', ')}`)
            .join('\n');

        prompt += `\n
<existing_tag_hierarchies>
Your vault already uses these tag categories:
${hierarchyExamples}

Follow similar hierarchical patterns when generating new nested tags.
Use existing categories as parents when appropriate.
</existing_tag_hierarchies>`;
    }

    return prompt;
}
```

---

### Phase 3: Tag Reorganization (Advanced)
**Priority**: ⭐⭐⭐ | **Complexity**: High | **Time**: 3-5 days

#### 3.1 Reorganization Command
File: `src/commands/utilityCommands.ts`

```typescript
plugin.addCommand({
    id: 'reorganize-tags-hierarchically',
    name: plugin.t.commands.reorganizeTagsHierarchically,
    icon: 'git-branch',
    callback: async () => {
        await plugin.reorganizeTagsHierarchically();
    }
});
```

#### 3.2 Core Reorganization Logic
File: `src/main.ts`

**Workflow**:
1. Collect all existing tags from vault
2. Send to LLM with reorganization prompt
3. Parse LLM response (JSON mapping: old → new)
4. Show preview modal with proposed changes
5. Apply changes if user confirms
6. Update all affected files

**Key Functions**:
```typescript
public async reorganizeTagsHierarchically(): Promise<void>
private parseReorganizationResponse(response: string): Map<string, string>
private async showReorganizationPreview(mapping: Map<string, string>): Promise<boolean>
private async applyTagReorganization(mapping: Map<string, string>): Promise<void>
```

#### 3.3 LLM Reorganization Prompt
```typescript
const prompt = `
<task>
Analyze these flat tags and suggest a hierarchical organization.
Group related tags under common parent categories.
</task>

<existing_tags>
${allTags.join(', ')}
</existing_tags>

<requirements>
- Identify common themes → create parent categories
- Convert: flat → nested format (parent/child)
- Maintain semantic accuracy
- Max 2-3 levels of nesting
- Return JSON mapping
</requirements>

<output_format>
{
  "reorganization": [
    {"old": "apple", "new": "fruit/apple"},
    {"old": "pear", "new": "fruit/pear"},
    {"old": "python", "new": "programming/languages/python"}
  ]
}
</output_format>`;
```

---

### Phase 4: Enhanced Visualization
**Priority**: ⭐⭐⭐ | **Complexity**: Medium | **Time**: 1-2 days

#### 4.1 Hierarchy-Aware Network View
File: `src/ui/views/TagNetworkView.ts`

**Enhancements**:
```typescript
// Color nodes by hierarchy level
private getNodeColorByHierarchy(tag: string): string {
    const level = tag.split('/').length - 1;
    const colors = [
        'rgba(100, 149, 237, 1)',  // Level 0 - blue
        'rgba(60, 179, 113, 1)',   // Level 1 - green
        'rgba(255, 140, 0, 1)',    // Level 2 - orange
    ];
    return colors[Math.min(level, colors.length - 1)];
}

// Add hierarchy level filter
private addHierarchyFilter(container: HTMLElement): void {
    const filterContainer = container.createDiv({ cls: 'hierarchy-filter' });
    ['All', '0', '1', '2', '3+'].forEach(level => {
        const btn = filterContainer.createEl('button', { text: level });
        btn.addEventListener('click', () => {
            this.filterByHierarchyLevel(level);
        });
    });
}
```

---

### Phase 5: Internationalization
**Priority**: ⭐⭐⭐⭐⭐ | **Complexity**: Low | **Time**: 0.5 days

#### English (en.ts)
```typescript
export const en = {
    settings: {
        nestedTagsSettings: "Nested Tags Settings",
        enableNestedTags: "Enable Nested Tags",
        enableNestedTagsDesc: "Generate hierarchical tags like parent/child (e.g., science/biology)",
        nestedTagsMaxDepth: "Max Nesting Depth",
        nestedTagsMaxDepthDesc: "Maximum levels of nesting (1-3)",
    },
    commands: {
        reorganizeTagsHierarchically: "Reorganize Tags into Hierarchies",
    },
    messages: {
        reorganizingTags: "Analyzing tags...",
        reorganizationComplete: "Reorganization complete!",
    }
};
```

#### Chinese (zh.ts)
```typescript
export const zh = {
    settings: {
        nestedTagsSettings: "嵌套标签设置",
        enableNestedTags: "启用嵌套标签",
        enableNestedTagsDesc: "生成层级标签，如 parent/child（例如：科学/生物学）",
        nestedTagsMaxDepth: "最大嵌套深度",
        nestedTagsMaxDepthDesc: "嵌套的最大层级数（1-3）",
    },
    commands: {
        reorganizeTagsHierarchically: "将标签重组为层级结构",
    },
    messages: {
        reorganizingTags: "正在分析标签...",
        reorganizationComplete: "重组完成！",
    }
};
```

---

## 🎯 Recommended Implementation Path

### Minimum Viable Product (MVP)
**Goal**: Quickly address core user needs

**Includes**:
- ✅ Phase 1: Basic nested tag generation
- ✅ Phase 5: Internationalization

**Result**:
- Solves Issue #20 (generate nested tags)
- Partially solves Issue #21 (users can manually specify hierarchies in prompts)
- Fast to implement (1-2 days)
- Low risk

### Full Solution
**Goal**: Comprehensive hierarchical tag system

**Includes**:
- ✅ Phase 1: Basic generation
- ✅ Phase 2: Hierarchy intelligence
- ✅ Phase 3: Tag reorganization
- ✅ Phase 4: Enhanced visualization
- ✅ Phase 5: Internationalization

**Result**:
- Complete solution to Issues #20 and #21
- Intelligent, context-aware tag generation
- Tools for reorganizing existing tags
- Better visualization

**Timeline**: 7-12 days

---

## 📊 Priority Matrix

| Phase | Complexity | Dev Time | User Value | Priority |
|-------|-----------|----------|------------|----------|
| Phase 1 | Low | 1-2 days | High | ⭐⭐⭐⭐⭐ |
| Phase 2 | Medium | 2-3 days | Medium | ⭐⭐⭐⭐ |
| Phase 3 | High | 3-5 days | Medium | ⭐⭐⭐ |
| Phase 4 | Medium | 1-2 days | Low | ⭐⭐ |
| Phase 5 | Low | 0.5 days | High (CN users) | ⭐⭐⭐⭐⭐ |

---

## 🧪 Testing Plan

### Unit Tests
- Tag hierarchy parsing
- Parent/child relationship detection
- Tag reorganization mapping

### Integration Tests
- Nested tag generation with different LLMs
- Hierarchy-aware prompt enhancement
- Tag reorganization workflow

### User Testing
- Generate tags for various content types
- Test with existing hierarchical vaults
- Verify backward compatibility with flat tags

---

## 📝 Documentation Updates

### README Updates
- Add nested tags to feature list
- Include examples with nested tags
- Document new settings

### User Guide
- How to enable nested tags
- Best practices for hierarchical tagging
- Tag reorganization tutorial

---

## 🚀 Rollout Strategy

### Stage 1: MVP Release (v1.1.0)
- Release Phase 1 + Phase 5
- Mark feature as "Beta" in settings
- Gather user feedback

### Stage 2: Intelligence Update (v1.2.0)
- Add Phase 2 based on feedback
- Improve prompt engineering
- Optimize performance

### Stage 3: Full Feature (v1.3.0)
- Add Phase 3 + Phase 4
- Remove "Beta" label
- Comprehensive documentation

---

## 🔧 Configuration Examples

### Basic Setup (MVP)
```yaml
enableNestedTags: true
nestedTagsMaxDepth: 2
```

### Advanced Setup (Full)
```yaml
enableNestedTags: true
nestedTagsMaxDepth: 3
nestedTagsStrategy: auto
```

---

## 📈 Success Metrics

1. **Adoption Rate**: % of users who enable nested tags
2. **Tag Depth**: Average nesting level in generated tags
3. **User Satisfaction**: Feedback on Issue #20 and #21
4. **Tag Quality**: Manual review of generated hierarchies
5. **Performance**: Generation time for nested vs flat tags

---

## 🐛 Potential Issues & Mitigations

### Issue 1: Over-nesting
**Problem**: LLM generates too many levels
**Mitigation**: Strict `maxDepth` enforcement in prompt + post-processing

### Issue 2: Inconsistent Hierarchies
**Problem**: Same concept gets different parent categories
**Mitigation**: Phase 2 context-awareness + user-defined rules

### Issue 3: Performance with Large Vaults
**Problem**: Hierarchy analysis slow for 10k+ tags
**Mitigation**: Caching + incremental updates

### Issue 4: Migration Concerns
**Problem**: Users worried about breaking existing tags
**Mitigation**: Non-destructive by default + preview before changes

---

## 📚 References

- [Obsidian Nested Tags Documentation](https://help.obsidian.md/Editing+and+formatting/Tags#Nested+tags)
- GitHub Issue #20: Support for nested tags
- GitHub Issue #21: Tag merging and nesting management

---

## 👥 Stakeholders

- **Users**: Request feature, provide feedback
- **Developer**: Implement and maintain
- **Community**: Test and suggest improvements

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Status**: Pending Implementation
