import { ButtonComponent } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { BaseSettingSection } from './BaseSettingSection';

export class SupportSection extends BaseSettingSection {

    display(): void {
        this.containerEl.createEl('h1', { text: this.plugin.t.settings.support.title });

        const supportEl = this.containerEl.createDiv({ cls: 'support-container' });
        supportEl.createSpan({text: this.plugin.t.settings.support.description });

        new ButtonComponent(supportEl)
            .setButtonText(this.plugin.t.settings.support.buyCoffee)
            .setClass('support-button')
            .onClick(() => {
                window.open('https://buymeacoffee.com/niehu2015o', '_blank');
            });
    }
}
