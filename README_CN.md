# AI Tagger Universe: Obsidian 智能标签生成与管理插件

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md) [![中文](https://img.shields.io/badge/lang-中文-red.svg)](README_CN.md)

![AI Tagger Universe](https://img.shields.io/badge/Obsidian-AI%20Tagger%20Universe-blue)
![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22ai-tagger-universe%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![Obsidian Compatibility](https://img.shields.io/badge/Obsidian-v1.4.0+-blue)

> 使用 AI 自动为你的 Obsidian 笔记生成智能标签。本插件会分析你的笔记内容，并在笔记的 frontmatter 中添加相关标签，帮助你更好地组织和发现知识库中的联系。

## 🔌 安装方法

可以直接从 Obsidian 社区插件商店安装：

1. 打开 Obsidian 设置
2. 导航到「社区插件」
3. 关闭安全模式（如果已启用）
4. 搜索「AI Tagger Universe」
5. 点击「安装」，然后「启用」

也可以手动安装：

1. 从本仓库下载最新版本
2. 将文件解压到你的 Obsidian 仓库的 `.obsidian/plugins/ai-tagger-universe` 文件夹
3. 重启 Obsidian 并在社区插件设置中启用该插件

## ✨ 核心功能

### 🤖 灵活的 AI 集成

- **支持多种 AI 服务**：
  - **本地 LLM**：Ollama、LM Studio、LocalAI 或任何兼容 OpenAI 的本地服务
  - **云端服务**：OpenAI、Claude、Gemini、Groq、Grok、Mistral、DeepSeek、Cohere、SiliconFlow、阿里云、Bedrock、Vertex AI、OpenRouter 等

### 🏷️ 智能标签系统

- **多种标签模式**：
  - 根据内容生成全新标签
  - 匹配你仓库中的已有标签
  - 使用自定义预定义标签列表
  - 混合模式：结合生成新标签和匹配已有标签
- **批量操作**：一次性为多个笔记添加标签
- **多语言支持**：以你喜欢的语言生成标签

### 📊 标签网络可视化

- 交互式图表展示标签之间的关系
- 发现知识库中的联系和模式
- 搜索功能快速找到特定标签
- 节点大小表示标签使用频率

### 🛠️ 高级管理功能

- 为选中的文本片段生成标签
- 批量为整个文件夹或仓库添加标签
- 清除标签的同时保留其他 frontmatter 信息
- 收集并导出仓库中的所有标签
- **调试模式**：增强的日志记录功能，便于问题排查（新功能！）
- **热门工具提示**：常见 LLM 设置的内置配置指导（新功能！）

## 🆕 版本 1.0.14 新功能

### 主要特性

- **🎉 完整中文界面支持**：为中文用户提供完整的本地化界面
- **🌍 双语界面**：支持中英文界面轻松切换
- **🔧 增强的调试模式**：更好的日志记录和问题排查功能
- **📋 改进的用户指导**：提供热门 AI 工具和服务的配置提示

### 改进内容

- 更新所有 UI 元素以支持国际化
- 增强的错误信息和通知
- 更完善的翻译管理系统
- 改善非英语用户的使用体验

## 🚀 快速开始

1. **安装插件**：从 Obsidian 社区插件商店安装
2. **配置 AI 服务提供商**：
   - 进入「设置」→「AI Tagger Universe」→「LLM 设置」
   - 选择本地 LLM（如 Ollama、LM Studio）或云端服务（如 OpenAI、Claude）
   - 输入端点 URL 和 API 密钥（如需要）
   - 测试连接以确认配置正确
3. **选择标签模式**：
   - 选择标签生成方式（生成新标签、使用已有标签或混合模式）
   - 调整标签生成数量限制（每个笔记 0-10 个标签）
4. **可选：配置界面语言**：
   - 进入「设置」→「AI Tagger Universe」→「界面设置」
   - 选择「中文」或「English」
   - 重启 Obsidian 使语言更改生效
5. **开始生成标签**：
   - 使用功能区图标（左侧边栏）为当前笔记生成标签
   - 使用命令面板（Ctrl/Cmd+P）访问更多选项
   - 使用标签网络可视化查看标签关系

## 🔧 配置选项

### LLM 设置

- **服务类型**：本地 LLM 或云端服务
- **AI 提供商**：从 15+ 种服务中选择（Ollama、OpenAI、Claude、Gemini、Groq 等）
- **端点 URL**：你的 LLM 服务端点地址
- **API 密钥**：认证密钥（如需要）
- **模型名称**：要使用的具体模型

### 标签生成

- **标签模式**：选择标签生成或匹配方式
  - 生成新标签：根据内容创建全新标签
  - 预定义标签：匹配仓库中的已有标签
  - 混合模式：结合生成和匹配已有标签
  - 自定义：使用文件中的自定义标签列表
- **标签数量限制**：设置生成/匹配标签的最大数量（0-10）
- **标签语言**：以你喜欢的语言生成标签

### 界面与高级设置

- **界面语言**：在中文和英文之间切换
- **排除路径**：批量操作时跳过特定文件夹
- **调试模式**：启用详细日志以便问题排查
- **替换标签**：覆盖已有标签或追加到现有标签

## 📖 使用场景

- **研究笔记**：自动分类研究论文和发现
- **项目管理**：为项目笔记添加标签以便更好地组织
- **知识库**：发现概念之间的联系
- **内容创作**：为博客文章或文章生成相关标签
- **个人日记**：追踪日记条目中的主题和话题

## 🌐 语言支持

### 标签生成

支持多种语言生成标签，包括中文、英文、日文、德文、法文、西班牙文、俄文等。

### 界面本地化（新功能！）

- **完整中文界面**：插件界面完全支持中文
- **双语支持**：在中英文界面之间无缝切换
- **本地化设置**：所有配置面板和选项均提供中文版本
- **翻译命令**：命令面板和功能区操作完全本地化
- **多语言消息**：所有通知、提示和反馈均以你的首选语言显示

更改界面语言的方法：

1. 进入 AI Tagger Universe 设置
2. 导航到「界面设置」部分
3. 选择你喜欢的语言（English/中文）
4. 重启 Obsidian 使更改生效

## 🔄 Fork 改进

本 fork 版本相比原版插件包含多项增强功能：

### Bug 修复

- **修复格式错误的标签前缀**：解决了某些 LLM 会生成类似 `tag:matchedExistingTags-medical-research` 这样的标签，而不是干净的 `medical-research` 标签的问题
  - 添加了强大的标签清理功能，去除格式错误的前缀（`tag:`、`matchedExistingTags-`、`suggestedTags-` 等）
  - 通过明确的正确和错误标签格式示例增强了提示词

### 提示词工程改进

- **Claude 优化提示词**：使用 XML 风格标签（`<task>`、`<requirements>`、`<output_format>`）重构所有提示词，以提高 LLM 理解能力
- **强制使用 kebab-case 格式**：所有标签模式现在都统一生成 kebab-case 格式的标签（例如：`machine-learning`、`data-science`）
- **改进的标签质量指南**：添加了对简洁（1-3 个词）、具体和描述性标签的明确要求
- **真实示例**：将占位符示例替换为实际的领域适当标签示例
- **统一结构**：在所有标签模式（GenerateNew、PredefinedTags、Hybrid、Custom）中统一了提示词结构

### 代码质量

- **增强的错误处理**：更好地验证和清理 LLM 响应
- **全面的文档**：改进的内联代码注释和类型定义

### 测试

- 包含测试脚本（`test-sanitization.js`）用于验证你的实际 LLM 端点的标签生成
- 查看 `TEST_INSTRUCTIONS.md` 获取测试指南

这些改进使标签生成更可靠、格式更一致，并提高了与各种 LLM 提供商（包括 Claude、GPT-4 和本地模型）的兼容性。

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎贡献！请随时提交 Issue 或 Pull Request。

## 📮 支持

如果遇到问题或有功能请求，请在 [GitHub Issues](https://github.com/niehu-szkt/obsidian-ai-tagger-universe/issues) 中提交。

## 🙏 致谢

感谢所有为本项目做出贡献的开发者和用户！
