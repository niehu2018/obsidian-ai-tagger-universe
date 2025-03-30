import { Setting } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { TaggingMode } from '../../services/prompts/tagPrompts';
import { BaseSettingSection } from './BaseSettingSection';
import { LanguageCode } from '../../services/types';
import { languageNames } from '../../services/languageUtils';

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
            .addDropdown(dropdown => {
                const options: Record<string, string> = { 
                    'default': 'AI model default'
                };
                
                // 添加所有支持的语言
                Object.entries(languageNames).forEach(([code, name]) => {
                    if (code !== 'default') {
                        options[code] = name;
                    }
                });
                
                return dropdown
                    .addOptions(options)
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value as LanguageCode;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
