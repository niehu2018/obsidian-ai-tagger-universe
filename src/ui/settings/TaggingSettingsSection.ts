import { Setting, Notice } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { TaggingMode } from '../../services/prompts/types';
import { BaseSettingSection } from './BaseSettingSection';
import { LanguageUtils } from '../../utils/languageUtils';
import { ExcludedFilesModal } from '../modals/ExcludedFilesModal';

export class TaggingSettingsSection extends BaseSettingSection {
    private tagSourceSetting: Setting | null = null;
    private predefinedTagsFileSetting: Setting | null = null;

    // Update settings visibility
    private updateVisibility(): void {
        // Determine whether to show tag source setting
        if (this.tagSourceSetting) {
            const shouldShowTagSource = this.plugin.settings.taggingMode !== TaggingMode.GenerateNew;
            this.tagSourceSetting.settingEl.style.display = shouldShowTagSource ? 'flex' : 'none';
        }
        
        // Determine whether to show predefined tags file setting
        if (this.predefinedTagsFileSetting) {
            const shouldShowTagsFile = this.plugin.settings.taggingMode !== TaggingMode.GenerateNew && 
                                      this.plugin.settings.tagSourceType === 'file';
            this.predefinedTagsFileSetting.settingEl.style.display = shouldShowTagsFile ? 'flex' : 'none';
        }
    }

    display(): void {
        this.containerEl.createEl('h1', { text: 'Tagging settings' });

        new Setting(this.containerEl)
            .setName('Tagging mode')
            .setDesc('Choose how tags should be generated')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    [TaggingMode.PredefinedTags]: 'Use predefined tags only',
                    [TaggingMode.GenerateNew]: 'Generate new tags',
                    [TaggingMode.Hybrid]: 'Hybrid mode (Generate + Predefined)'
                })
                .setValue(this.plugin.settings.taggingMode)
                .onChange(async (value) => {
                    this.plugin.settings.taggingMode = value as TaggingMode;
                    await this.plugin.saveSettings();
                    this.updateVisibility();
                }));

        // Tag Source Setting (for PredefinedTags and Hybrid modes)
        this.tagSourceSetting = new Setting(this.containerEl)
            .setName('Tag source')
            .setDesc('Choose where to get the predefined tags from')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'file': 'From predefined tags file',
                    'vault': 'From all existing tags in vault'
                })
                .setValue(this.plugin.settings.tagSourceType)
                .onChange(async (value) => {
                    this.plugin.settings.tagSourceType = value as 'file' | 'vault';
                    await this.plugin.saveSettings();
                    this.updateVisibility();
                }));
                
        // Predefined tags file setting
        this.predefinedTagsFileSetting = new Setting(this.containerEl)
            .setName('Predefined tags file')
            .setDesc('Path to a file containing predefined tags (one tag per line)');
        
        const tagsFileInputContainer = this.predefinedTagsFileSetting.controlEl.createDiv('path-input-container');
        const tagsFileInput = tagsFileInputContainer.createEl('input', { 
            type: 'text', 
            placeholder: 'path/to/your/tags.txt',
            cls: 'path-input',
            value: this.plugin.settings.predefinedTagsPath || ''
        });
        
        const tagsDropdownContainer = tagsFileInputContainer.createDiv('path-dropdown-container');
        tagsDropdownContainer.style.display = 'none';
        
        const updateTagsDropdown = async (searchTerm: string) => {
            try {
                const items: {path: string, isFolder: boolean, name: string}[] = [];
                const lowerSearchTerm = searchTerm.toLowerCase().trim();
                
                // If search term is empty, show common tag-related files
                if (!lowerSearchTerm) {
                    // Common tag files
                    const commonTagFiles = ['tags.md', 'tags.txt', 'Tags/', 'tag_list.md'];
                    
                    this.plugin.app.vault.getFiles().forEach(file => {
                        // Only show files that look like tag files
                        if (commonTagFiles.some(tagFile => 
                            file.path.toLowerCase().includes(tagFile.toLowerCase()))) {
                            items.push({
                                path: file.path,
                                isFolder: false,
                                name: file.name
                            });
                        }
                    });
                } else {
                    // Make sure search term exists in file path or name
                    this.plugin.app.vault.getFiles().forEach(file => {
                        const filePath = file.path.toLowerCase();
                        const fileName = file.name.toLowerCase();
                        
                        // Only show files with names or paths containing the search term
                        if (filePath.includes(lowerSearchTerm) || fileName.includes(lowerSearchTerm)) {
                            items.push({
                                path: file.path,
                                isFolder: false,
                                name: file.name
                            });
                        }
                    });
                    
                    // Add folder search
                    this.plugin.app.vault.getAllLoadedFiles().forEach(abstractFile => {
                        if ('children' in abstractFile) {  // Check if it's a folder
                            const folderPath = abstractFile.path.toLowerCase() + '/';
                            if (folderPath.includes(lowerSearchTerm)) {
                                items.push({
                                    path: abstractFile.path + '/',
                                    isFolder: true,
                                    name: abstractFile.name
                                });
                            }
                        }
                    });
                }
                
                // Sort results - prioritize items starting with search term
                items.sort((a, b) => {
                    // First check if starts with search term
                    const aStartsWith = a.name.toLowerCase().startsWith(lowerSearchTerm);
                    const bStartsWith = b.name.toLowerCase().startsWith(lowerSearchTerm);
                    
                    if (aStartsWith && !bStartsWith) return -1;
                    if (!aStartsWith && bStartsWith) return 1;
                    
                    // Then sort by file/folder type
                    if (a.isFolder && !b.isFolder) return -1;
                    if (!a.isFolder && b.isFolder) return 1;
                    
                    // Finally sort alphabetically by path
                    return a.path.localeCompare(b.path);
                });
                
                const limitedItems = items.slice(0, 15);  // Limit to 15 items for performance
                tagsDropdownContainer.empty();
                
                if (limitedItems.length === 0) {
                    tagsDropdownContainer.createEl('div', {
                        text: 'No matching files',
                        cls: 'path-dropdown-empty'
                    });
                    return;
                }
                
                // Set dropdown style to ensure visibility
                tagsDropdownContainer.style.position = 'absolute';
                tagsDropdownContainer.style.width = '100%';
                tagsDropdownContainer.style.zIndex = '1000';
                tagsDropdownContainer.style.backgroundColor = 'var(--background-primary)';
                tagsDropdownContainer.style.border = '1px solid var(--background-modifier-border)';
                tagsDropdownContainer.style.maxHeight = '200px';
                tagsDropdownContainer.style.overflowY = 'auto';
                tagsDropdownContainer.style.top = '100%';  // Position below input
                tagsDropdownContainer.style.left = '0';
                tagsDropdownContainer.style.borderRadius = '4px';
                tagsDropdownContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                
                limitedItems.forEach(item => {
                    const pathItem = tagsDropdownContainer.createEl('div', {
                        cls: 'path-dropdown-item'
                    });
                    
                    // Style dropdown item
                    pathItem.style.padding = '6px 8px';
                    pathItem.style.cursor = 'pointer';
                    pathItem.style.borderBottom = '1px solid var(--background-modifier-border-hover)';
                    pathItem.style.display = 'flex';
                    pathItem.style.alignItems = 'center';
                    
                    // Add hover effect
                    pathItem.addEventListener('mouseenter', () => {
                        pathItem.style.backgroundColor = 'var(--background-secondary)';
                    });
                    
                    pathItem.addEventListener('mouseleave', () => {
                        pathItem.style.backgroundColor = '';
                    });
                    
                    // Add icon
                    const iconEl = pathItem.createSpan({
                        cls: `path-item-icon ${item.isFolder ? 'folder-icon' : 'file-icon'}`
                    });
                    
                    // Style icon
                    iconEl.style.marginRight = '6px';
                    iconEl.style.fontSize = '14px';
                    
                    // Create path text element
                    const textEl = pathItem.createSpan({
                        cls: 'path-item-text'
                    });
                    
                    // Highlight matching part
                    if (lowerSearchTerm && item.path.toLowerCase().includes(lowerSearchTerm)) {
                        const path = item.path;
                        const lowerPath = path.toLowerCase();
                        const index = lowerPath.indexOf(lowerSearchTerm);
                        
                        if (index >= 0) {
                            // Text before match
                            if (index > 0) {
                                textEl.createSpan({
                                    text: path.substring(0, index)
                                });
                            }
                            
                            // Highlight match
                            textEl.createSpan({
                                text: path.substring(index, index + lowerSearchTerm.length),
                                cls: 'path-match-highlight'
                            }).style.backgroundColor = 'var(--text-highlight-bg)';
                            
                            // Text after match
                            if (index + lowerSearchTerm.length < path.length) {
                                textEl.createSpan({
                                    text: path.substring(index + lowerSearchTerm.length)
                                });
                            }
                        } else {
                            textEl.setText(path);
                        }
                    } else {
                        textEl.setText(item.path);
                    }
                    
                    pathItem.addEventListener('click', async () => {
                        tagsFileInput.value = item.path;
                        this.plugin.settings.predefinedTagsPath = item.path;
                        await this.plugin.saveSettings();
                        tagsDropdownContainer.style.display = 'none';
                    });
                });
            } catch (error) {
                console.error('Error updating tags dropdown:', error);
                tagsDropdownContainer.empty();
                tagsDropdownContainer.createEl('div', {
                    text: 'Error loading files',
                    cls: 'path-dropdown-error'
                });
            }
        };
        
        tagsFileInput.addEventListener('focus', () => {
            tagsDropdownContainer.style.display = 'block';
            updateTagsDropdown(tagsFileInput.value);
        });
        
        tagsFileInput.addEventListener('click', (e) => {
            // Prevent document click handler from hiding dropdown
            e.stopPropagation();
            
            // Show dropdown on input click
            tagsDropdownContainer.style.display = 'block';
            updateTagsDropdown(tagsFileInput.value);
        });
        
        tagsFileInput.addEventListener('input', async () => {
            this.plugin.settings.predefinedTagsPath = tagsFileInput.value;
            await this.plugin.saveSettings();
            
            // Ensure dropdown remains visible during input
            tagsDropdownContainer.style.display = 'block';
            updateTagsDropdown(tagsFileInput.value);
        });
        
        // Handle document clicks to close dropdown
        const documentClickListener = (event: MouseEvent) => {
            if (!tagsFileInputContainer.contains(event.target as Node)) {
                tagsDropdownContainer.style.display = 'none';
            }
        };
        
        document.addEventListener('click', documentClickListener);
        
        // Clean up when component is destroyed
        this.plugin.register(() => {
            document.removeEventListener('click', documentClickListener);
        });
        
        // Apply initial visibility
        this.updateVisibility();

        // File exclusion Setting
        this.containerEl.createEl('h3', { text: 'File exclusion' });
        
        const excludedFoldersSetting = new Setting(this.containerEl)
            .setName('Excluded files and folders')
            .setDesc('Files matching these patterns will be hidden in Search, Graph View, and Unlinked Mentions, less noticeable in Quick Switcher and link suggestions.');

        const excludedInfo = excludedFoldersSetting.descEl.createDiv({
            cls: 'excluded-info'
        });

        const updateExcludedInfo = () => {
            excludedInfo.empty();
            
            if (this.plugin.settings.excludedFolders.length === 0) {
                excludedInfo.createSpan({
                    text: 'No exclusions configured',
                    cls: 'excluded-info-text muted'
                });
            } else {
                excludedInfo.createSpan({
                    text: `${this.plugin.settings.excludedFolders.length} pattern${this.plugin.settings.excludedFolders.length === 1 ? '' : 's'} configured`,
                    cls: 'excluded-info-text'
                });
            }
        };
        
        updateExcludedInfo();

        excludedFoldersSetting.addButton(button => 
            button
                .setButtonText('Manage')
                .setCta()
                .onClick(() => {
                    const modal = new ExcludedFilesModal(
                        this.plugin.app, 
                        this.plugin, 
                        async (excludedFolders: string[]) => {
                            this.plugin.settings.excludedFolders = excludedFolders;
                            await this.plugin.saveSettings();
                            updateExcludedInfo();
                        }
                    );
                    modal.open();
                })
        );

        // Tag Range Settings
        this.containerEl.createEl('h3', { text: 'Tag range settings' });

        new Setting(this.containerEl)
            .setName('Maximum predefined tags')
            .setDesc('Maximum number of predefined tags to use (0-10). Used in Predefined and Hybrid modes.')
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
            .setName('Maximum generated tags')
            .setDesc('Maximum number of new tags to generate (0-10). Used in Generate and Hybrid modes.')
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
                // Add language options
                const options: Record<string, string> = LanguageUtils.getLanguageOptions();
                
                return dropdown
                    .addOptions(options)
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value as any;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
