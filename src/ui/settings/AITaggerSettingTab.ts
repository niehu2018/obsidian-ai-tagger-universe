import { App, PluginSettingTab } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { LLMSettingsSection } from './LLMSettingsSection';
import { TaggingSettingsSection } from './TaggingSettingsSection';
import { PredefinedTagsSection } from './PredefinedTagsSection';
import { SupportSection } from './SupportSection';

export class AITaggerSettingTab extends PluginSettingTab {
    private plugin: AITaggerPlugin;
    private llmSection?: LLMSettingsSection;
    private taggingSection?: TaggingSettingsSection;
    private predefinedTagsSection?: PredefinedTagsSection;
    private supportSection?: SupportSection;

    constructor(app: App, plugin: AITaggerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Initialize all sections
        this.llmSection = new LLMSettingsSection(this.plugin, containerEl, this);
        this.taggingSection = new TaggingSettingsSection(this.plugin, containerEl, this);
        this.predefinedTagsSection = new PredefinedTagsSection(this.plugin, containerEl, this);
        this.supportSection = new SupportSection(this.plugin, containerEl, this);

        // Display all sections
        this.llmSection.display();
        this.taggingSection.display();
        this.predefinedTagsSection.display();
        this.supportSection.display();
    }
}
