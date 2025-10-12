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

                        // 显示需要重启的提示
                        const notice = document.createElement('div');
                        notice.className = 'notice';
                        notice.style.marginTop = '10px';
                        notice.style.padding = '8px 12px';
                        notice.style.backgroundColor = 'var(--background-modifier-info)';
                        notice.style.border = '1px solid var(--background-modifier-border)';
                        notice.style.borderRadius = '4px';
                        notice.style.color = 'var(--text-normal)';
                        notice.innerHTML = `
                            <div style="display: flex; align-items: center;">
                                <span style="margin-right: 8px;">ℹ️</span>
                                <span>${this.plugin.t.messages.restartRequired}</span>
                            </div>
                        `;

                        const existingNotice = this.containerEl.querySelector('.language-notice');
                        if (existingNotice) {
                            existingNotice.remove();
                        }

                        notice.addClass('language-notice');
                        this.containerEl.appendChild(notice);

                        // 5秒后自动移除提示
                        setTimeout(() => {
                            notice.remove();
                        }, 5000);
                    });
            });

        // 添加重启提示
        const restartNotice = this.containerEl.createDiv('language-notice');
        restartNotice.style.marginTop = '10px';
        restartNotice.style.padding = '8px 12px';
        restartNotice.style.backgroundColor = 'var(--background-modifier-info)';
        restartNotice.style.border = '1px solid var(--background-modifier-border)';
        restartNotice.style.borderRadius = '4px';
        restartNotice.style.color = 'var(--text-normal)';
        restartNotice.innerHTML = `
            <div style="display: flex; align-items: center;">
                <span style="margin-right: 8px;">💡</span>
                <span>${this.plugin.t.messages.languageChangeNotice}</span>
            </div>
        `;
    }
}