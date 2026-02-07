import { Setting } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { BaseSettingSection } from './BaseSettingSection';
import { getLanguageOptions, SupportedLanguage } from '../../i18n';

export class InterfaceSettingsSection extends BaseSettingSection {
    display(): void {
        this.containerEl.createEl('h1', { text: this.plugin.t.settings.interface.title });

        new Setting(this.containerEl)
            .setName(this.plugin.t.settings.interface.language)
            .setDesc(this.plugin.t.settings.interface.languageDesc)
            .addDropdown(dropdown => {
                const options = getLanguageOptions();

                return dropdown
                    .addOptions(options)
                    .setValue(this.plugin.settings.interfaceLanguage)
                    .onChange(async (value) => {
                        this.plugin.settings.interfaceLanguage = value as SupportedLanguage;
                        await this.plugin.saveSettings();

                        // Show restart required notice
                        const notice = document.createElement('div');
                        notice.className = 'notice';
                        notice.style.marginTop = '10px';
                        notice.style.padding = '8px 12px';
                        notice.style.backgroundColor = 'var(--background-modifier-info)';
                        notice.style.border = '1px solid var(--background-modifier-border)';
                        notice.style.borderRadius = '4px';
                        notice.style.color = 'var(--text-normal)';
                        // Use safe DOM methods instead of innerHTML to prevent XSS
                        const noticeContent = document.createElement('div');
                        noticeContent.style.display = 'flex';
                        noticeContent.style.alignItems = 'center';
                        const iconSpan = document.createElement('span');
                        iconSpan.style.marginRight = '8px';
                        iconSpan.textContent = 'ℹ️';
                        const textSpan = document.createElement('span');
                        textSpan.textContent = this.plugin.t.messages.restartRequired;
                        noticeContent.appendChild(iconSpan);
                        noticeContent.appendChild(textSpan);
                        notice.appendChild(noticeContent);

                        const existingNotice = this.containerEl.querySelector('.language-notice');
                        if (existingNotice) {
                            existingNotice.remove();
                        }

                        notice.addClass('language-notice');
                        this.containerEl.appendChild(notice);

                        // Auto-remove notice after 5 seconds
                        setTimeout(() => {
                            notice.remove();
                        }, 5000);
                    });
            });

        // Add restart notice - use safe DOM methods instead of innerHTML
        const restartNotice = this.containerEl.createDiv('language-notice');
        restartNotice.style.marginTop = '10px';
        restartNotice.style.padding = '8px 12px';
        restartNotice.style.backgroundColor = 'var(--background-modifier-info)';
        restartNotice.style.border = '1px solid var(--background-modifier-border)';
        restartNotice.style.borderRadius = '4px';
        restartNotice.style.color = 'var(--text-normal)';
        const restartContent = restartNotice.createDiv();
        restartContent.style.display = 'flex';
        restartContent.style.alignItems = 'center';
        const restartIcon = restartContent.createSpan();
        restartIcon.style.marginRight = '8px';
        restartIcon.textContent = '💡';
        const restartText = restartContent.createSpan();
        restartText.textContent = this.plugin.t.messages.languageChangeNotice;
    }
}