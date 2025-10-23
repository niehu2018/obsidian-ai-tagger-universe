# 嵌套标签实现方案

## 📋 概述

本文档概述了 AI Tagger Universe 中支持嵌套/层级标签的实现方案，旨在解决 GitHub Issues #20 和 #21。

**Issue #20**：支持嵌套标签，如 `#CS/Machine-Learning`
**Issue #21**：将现有扁平标签合并为层级结构（例如 `#apple` → `#fruit/apple`）

---

## 🎯 目标

1. **启用层级标签生成**：允许 AI 生成嵌套标签（如 `科学/生物学/遗传学`）
2. **保持现有功能**：确保与扁平标签的向后兼容性
3. **用户控制**：提供启用/禁用嵌套标签的配置选项
4. **智能重组**：可选地将现有扁平标签重组为层级结构

---

## 🏗️ 架构分析

### 现状分析

✅ **已支持**：
- Obsidian 原生支持使用 `/` 分隔符的嵌套标签
- 代码已保留标签中的 `/`（正则：`[^\p{L}\p{N}/-]`）
- 标签格式化系统与层级兼容

❌ **缺少的组件**：
- LLM 提示词未鼓励层级思维
- 无嵌套标签的 UI 配置
- 无层级感知的标签分析
- 无现有标签的重组工具

---

## 📅 实施阶段

### 阶段 1：基础嵌套标签生成（MVP）
**优先级**：⭐⭐⭐⭐⭐ | **复杂度**：低 | **时间**：1-2天

#### 1.1 设置架构
文件：`src/core/settings.ts`

```typescript
export interface AITaggerSettings {
    // ... 现有设置 ...

    // 嵌套标签设置
    enableNestedTags: boolean;           // 启用嵌套标签生成
    nestedTagsMaxDepth: number;          // 最大层级深度 (1-3)
    nestedTagsStrategy: 'auto' | 'manual'; // 未来使用
}

export const DEFAULT_SETTINGS: AITaggerSettings = {
    // ... 现有默认值 ...

    enableNestedTags: false,
    nestedTagsMaxDepth: 2,
    nestedTagsStrategy: 'auto',
}
```

#### 1.2 提示词工程
文件：`src/services/prompts/tagPrompts.ts`

**核心改动**：
- 当 `enableNestedTags` 为 true 时添加嵌套标签指令
- 提供清晰的层级标签示例
- 说明何时使用嵌套 vs 扁平标签

**示例添加**：
```typescript
if (pluginSettings?.enableNestedTags) {
    prompt += `
<nested_tags_requirements>
在适当的情况下使用正斜杠 (/) 生成层级/嵌套格式的标签。
使用嵌套标签展示从一般到具体的概念关系。

结构：父标签/子标签 或 父标签/子标签/孙标签（最多 ${maxDepth} 层）

良好示例：
- 技术/人工智能/机器学习
- 科学/生物学/遗传学
- 编程/语言/python
- 商业/营销/社交媒体

何时使用嵌套标签：
1. 存在明确的分类层级
2. 概念有更广泛的父主题
3. 有助于按领域组织

何时使用扁平标签：
1. 概念是独立的
2. 没有明确的父类别
3. 简单的独立主题

根据内容相关性生成嵌套和扁平标签的混合。
</nested_tags_requirements>
`;
}
```

#### 1.3 UI 配置
文件：`src/ui/settings/AITaggerSettingTab.ts`

添加设置部分：
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

### 阶段 2：层级感知智能（中级）
**优先级**：⭐⭐⭐⭐ | **复杂度**：中 | **时间**：2-3天

#### 2.1 层级分析工具
文件：`src/utils/tagHierarchyUtils.ts`（新文件）

**核心功能**：
```typescript
export interface TagHierarchy {
    tag: string;
    parent: string | null;
    children: string[];
    level: number;
    fullPath: string;
}

export class TagHierarchyUtils {
    // 将标签解析为层级组件
    static parseTagHierarchy(tag: string): TagHierarchy

    // 从仓库标签构建完整层级树
    static buildTagHierarchyTree(app: App): Map<string, TagHierarchy>

    // 获取标签的所有祖先
    static getTagAncestors(tag: string): string[]

    // 查找根分类
    static getRootCategory(tag: string): string

    // 按根分类分组标签
    static groupTagsByRoot(tags: string[]): Map<string, string[]>

    // 为新标签建议父分类
    static suggestParentCategories(
        newTag: string,
        existingTags: string[],
        maxSuggestions: number
    ): string[]
}
```

#### 2.2 上下文感知提示词
文件：`src/services/prompts/tagPrompts.ts`

**增强功能**：
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
你的仓库已经使用这些标签分类：
${hierarchyExamples}

生成新的嵌套标签时遵循类似的层级模式。
适当时使用现有分类作为父标签。
</existing_tag_hierarchies>`;
    }

    return prompt;
}
```

---

### 阶段 3：标签重组（高级）
**优先级**：⭐⭐⭐ | **复杂度**：高 | **时间**：3-5天

#### 3.1 重组命令
文件：`src/commands/utilityCommands.ts`

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

#### 3.2 核心重组逻辑
文件：`src/main.ts`

**工作流程**：
1. 从仓库收集所有现有标签
2. 发送给 LLM 并附带重组提示词
3. 解析 LLM 响应（JSON 映射：旧标签 → 新标签）
4. 显示预览模态框展示建议的更改
5. 用户确认后应用更改
6. 更新所有受影响的文件

**关键函数**：
```typescript
public async reorganizeTagsHierarchically(): Promise<void>
private parseReorganizationResponse(response: string): Map<string, string>
private async showReorganizationPreview(mapping: Map<string, string>): Promise<boolean>
private async applyTagReorganization(mapping: Map<string, string>): Promise<void>
```

#### 3.3 LLM 重组提示词
```typescript
const prompt = `
<task>
分析这些扁平标签并建议层级组织结构。
将相关标签分组到共同的父分类下。
</task>

<existing_tags>
${allTags.join(', ')}
</existing_tags>

<requirements>
- 识别共同主题 → 创建父分类
- 转换：扁平 → 嵌套格式（父/子）
- 保持语义准确性
- 最多 2-3 层嵌套
- 返回 JSON 映射
</requirements>

<output_format>
{
  "reorganization": [
    {"old": "苹果", "new": "水果/苹果"},
    {"old": "梨", "new": "水果/梨"},
    {"old": "python", "new": "编程/语言/python"}
  ]
}
</output_format>`;
```

---

### 阶段 4：增强可视化
**优先级**：⭐⭐⭐ | **复杂度**：中 | **时间**：1-2天

#### 4.1 层级感知网络视图
文件：`src/ui/views/TagNetworkView.ts`

**增强功能**：
```typescript
// 按层级级别为节点着色
private getNodeColorByHierarchy(tag: string): string {
    const level = tag.split('/').length - 1;
    const colors = [
        'rgba(100, 149, 237, 1)',  // 0 级 - 蓝色
        'rgba(60, 179, 113, 1)',   // 1 级 - 绿色
        'rgba(255, 140, 0, 1)',    // 2 级 - 橙色
    ];
    return colors[Math.min(level, colors.length - 1)];
}

// 添加层级级别过滤器
private addHierarchyFilter(container: HTMLElement): void {
    const filterContainer = container.createDiv({ cls: 'hierarchy-filter' });
    ['全部', '0', '1', '2', '3+'].forEach(level => {
        const btn = filterContainer.createEl('button', { text: level });
        btn.addEventListener('click', () => {
            this.filterByHierarchyLevel(level);
        });
    });
}
```

---

### 阶段 5：国际化
**优先级**：⭐⭐⭐⭐⭐ | **复杂度**：低 | **时间**：0.5天

#### 英文 (en.ts)
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

#### 中文 (zh.ts)
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

## 🎯 推荐实施路径

### 最小可行产品 (MVP)
**目标**：快速解决核心用户需求

**包括**：
- ✅ 阶段 1：基础嵌套标签生成
- ✅ 阶段 5：国际化

**结果**：
- 解决 Issue #20（生成嵌套标签）
- 部分解决 Issue #21（用户可在提示中手动指定层级）
- 快速实现（1-2天）
- 低风险

### 完整解决方案
**目标**：全面的层级标签系统

**包括**：
- ✅ 阶段 1：基础生成
- ✅ 阶段 2：层级智能
- ✅ 阶段 3：标签重组
- ✅ 阶段 4：增强可视化
- ✅ 阶段 5：国际化

**结果**：
- 完整解决 Issues #20 和 #21
- 智能、上下文感知的标签生成
- 重组现有标签的工具
- 更好的可视化

**时间线**：7-12天

---

## 📊 优先级矩阵

| 阶段 | 复杂度 | 开发时间 | 用户价值 | 优先级 |
|------|--------|----------|----------|--------|
| 阶段 1 | 低 | 1-2天 | 高 | ⭐⭐⭐⭐⭐ |
| 阶段 2 | 中 | 2-3天 | 中 | ⭐⭐⭐⭐ |
| 阶段 3 | 高 | 3-5天 | 中 | ⭐⭐⭐ |
| 阶段 4 | 中 | 1-2天 | 低 | ⭐⭐ |
| 阶段 5 | 低 | 0.5天 | 高（中文用户） | ⭐⭐⭐⭐⭐ |

---

## 🧪 测试计划

### 单元测试
- 标签层级解析
- 父子关系检测
- 标签重组映射

### 集成测试
- 使用不同 LLM 生成嵌套标签
- 层级感知提示增强
- 标签重组工作流

### 用户测试
- 为各种内容类型生成标签
- 在现有层级仓库中测试
- 验证与扁平标签的向后兼容性

---

## 📝 文档更新

### README 更新
- 将嵌套标签添加到功能列表
- 包含嵌套标签示例
- 记录新设置

### 用户指南
- 如何启用嵌套标签
- 层级标签的最佳实践
- 标签重组教程

---

## 🚀 发布策略

### 阶段 1：MVP 发布 (v1.1.0)
- 发布阶段 1 + 阶段 5
- 在设置中将功能标记为"测试版"
- 收集用户反馈

### 阶段 2：智能更新 (v1.2.0)
- 根据反馈添加阶段 2
- 改进提示词工程
- 优化性能

### 阶段 3：完整功能 (v1.3.0)
- 添加阶段 3 + 阶段 4
- 移除"测试版"标签
- 全面文档

---

## 🔧 配置示例

### 基础设置 (MVP)
```yaml
enableNestedTags: true
nestedTagsMaxDepth: 2
```

### 高级设置（完整）
```yaml
enableNestedTags: true
nestedTagsMaxDepth: 3
nestedTagsStrategy: auto
```

---

## 📈 成功指标

1. **采用率**：启用嵌套标签的用户百分比
2. **标签深度**：生成标签的平均嵌套级别
3. **用户满意度**：Issue #20 和 #21 的反馈
4. **标签质量**：生成层级的人工审查
5. **性能**：嵌套 vs 扁平标签的生成时间

---

## 🐛 潜在问题与缓解措施

### 问题 1：过度嵌套
**问题**：LLM 生成过多层级
**缓解**：在提示中严格执行 `maxDepth` + 后处理

### 问题 2：层级不一致
**问题**：相同概念获得不同的父分类
**缓解**：阶段 2 的上下文感知 + 用户定义规则

### 问题 3：大型仓库性能
**问题**：10k+ 标签的层级分析缓慢
**缓解**：缓存 + 增量更新

### 问题 4：迁移担忧
**问题**：用户担心破坏现有标签
**缓解**：默认非破坏性 + 更改前预览

---

## 📚 参考资料

- [Obsidian 嵌套标签文档](https://help.obsidian.md/Editing+and+formatting/Tags#Nested+tags)
- GitHub Issue #20：支持嵌套标签
- GitHub Issue #21：标签合并和嵌套管理

---

## 👥 利益相关者

- **用户**：请求功能，提供反馈
- **开发者**：实现和维护
- **社区**：测试和提出改进建议

---

**文档版本**：1.0
**最后更新**：2025-10-23
**状态**：待实施
