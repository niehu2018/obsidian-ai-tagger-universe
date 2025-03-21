import { Setting } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { TaggingMode } from '../../services/prompts/tagPrompts';
import { BaseSettingSection } from './BaseSettingSection';

export class TaggingSettingsSection extends BaseSettingSection {

    display(): void {
        this.containerEl.createEl('h1', { text: 'Tagging settings' });

        new Setting(this.containerEl)
            .setName('Tagging mode')
            .setDesc('Choose how tags should be generated')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    [TaggingMode.PredefinedTags]: 'Use predefined tags only',
                    [TaggingMode.ExistingTags]: 'Use existing tags only',
                    [TaggingMode.GenerateNew]: 'Generate new tags',
                    [TaggingMode.HybridGenerateExisting]: 'Generate new + match existing tags',
                    [TaggingMode.HybridGeneratePredefined]: 'Generate new + match predefined tags'
                })
                .setValue(this.plugin.settings.taggingMode)
                .onChange(async (value) => {
                    this.plugin.settings.taggingMode = value as TaggingMode;
                    await this.plugin.saveSettings();
                }));

        // Tag Range Settings
        this.containerEl.createEl('h3', { text: 'Tag range settings' });

        new Setting(this.containerEl)
            .setName('Maximum predefined tags')
            .setDesc('Maximum number of predefined tags to use (0-10)')
            .addSlider(slider => {
                const container = slider.sliderEl.parentElement;
                if (container) {
                    const numberDisplay = container.createSpan({ cls: 'value-display' });
                    numberDisplay.style.marginLeft = '10px';
                    numberDisplay.setText(String(this.plugin.settings.tagRangePredefinedMax));
                    
                    slider.setLimits(0, 10, 1)
                        .setValue(this.plugin.settings.tagRangePredefinedMax)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            numberDisplay.setText(String(value));
                            this.plugin.settings.tagRangePredefinedMax = value;
                            await this.plugin.saveSettings();
                        });
                }
                return slider;
            });

        new Setting(this.containerEl)
            .setName('Maximum existing tags')
            .setDesc('Maximum number of existing tags to match (0-10)')
            .addSlider(slider => {
                const container = slider.sliderEl.parentElement;
                if (container) {
                    const numberDisplay = container.createSpan({ cls: 'value-display' });
                    numberDisplay.style.marginLeft = '10px';
                    numberDisplay.setText(String(this.plugin.settings.tagRangeMatchMax));
                    
                    slider.setLimits(0, 10, 1)
                        .setValue(this.plugin.settings.tagRangeMatchMax)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            numberDisplay.setText(String(value));
                            this.plugin.settings.tagRangeMatchMax = value;
                            await this.plugin.saveSettings();
                        });
                }
                return slider;
            });

        new Setting(this.containerEl)
            .setName('Maximum generated tags')
            .setDesc('Maximum number of new tags to generate (0-10)')
            .addSlider(slider => {
                const container = slider.sliderEl.parentElement;
                if (container) {
                    const numberDisplay = container.createSpan({ cls: 'value-display' });
                    numberDisplay.style.marginLeft = '10px';
                    numberDisplay.setText(String(this.plugin.settings.tagRangeGenerateMax));
                    
                    slider.setLimits(0, 10, 1)
                        .setValue(this.plugin.settings.tagRangeGenerateMax)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            numberDisplay.setText(String(value));
                            this.plugin.settings.tagRangeGenerateMax = value;
                            await this.plugin.saveSettings();
                        });
                }
                return slider;
            });

        new Setting(this.containerEl)
            .setName('Output language')
            .setDesc('Language for generating tags')
            .addDropdown(dropdown => 
                dropdown
                    .addOptions({
                        'default': 'AI model default',
                        'ar': 'العربية',
                        'cs': 'Čeština',
                        'da': 'Dansk',
                        'de': 'Deutsch',
                        'en': 'English',
                        'es': 'Español',
                        'fr': 'Français',
                        'id': 'Bahasa Indonesia',
                        'it': 'Italiano',
                        'ja': '日本語',
                        'ko': '한국어',
                        'nl': 'Nederlands',
                        'no': 'Norsk',
                        'pl': 'Polski',
                        'pt': 'Português',
                        'pt-BR': 'Português do Brasil',
                        'ro': 'Română',
                        'ru': 'Русский',
                        'tr': 'Türkçe',
                        'uk': 'Українська',
                        'zh': '中文',
                        'zh-TW': '繁體中文'
                    })
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value as 'default' | 'ar' | 'cs' | 'da' | 'de' | 'en' | 'es' | 'fr' | 'id' | 'it' | 'ja' | 'ko' | 'nl' | 'no' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'tr' | 'uk' | 'zh' | 'zh-TW';
                        await this.plugin.saveSettings();
                    }));
    }
}
