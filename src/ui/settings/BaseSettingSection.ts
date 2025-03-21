import type { Plugin } from 'obsidian';
import type AITaggerPlugin from '../../main';
import type { AITaggerSettingTab } from './AITaggerSettingTab';

export abstract class BaseSettingSection {
    protected plugin: AITaggerPlugin;
    protected containerEl: HTMLElement;
    protected settingTab: AITaggerSettingTab;

    constructor(plugin: AITaggerPlugin, containerEl: HTMLElement, settingTab: AITaggerSettingTab) {
        this.plugin = plugin;
        this.containerEl = containerEl;
        this.settingTab = settingTab;
    }

    abstract display(): void;
}
