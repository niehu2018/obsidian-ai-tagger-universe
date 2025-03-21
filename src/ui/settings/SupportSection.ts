import { ButtonComponent } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { BaseSettingSection } from './BaseSettingSection';

export class SupportSection extends BaseSettingSection {

    display(): void {
        this.containerEl.createEl('h1', { text: 'Support developer' });

        const supportEl = this.containerEl.createDiv({ cls: 'support-container' });
        supportEl.createSpan({text: 'If you find this plugin helpful, consider buying me a coffee ☕️'});
        
        new ButtonComponent(supportEl)
            .setButtonText('Buy me a coffee')
            .setClass('support-button')
            .onClick(() => {
                window.open('https://buymeacoffee.com/niehu2015o', '_blank');
            });
    }
}
