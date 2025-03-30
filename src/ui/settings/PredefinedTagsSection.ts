import { Setting, ButtonComponent, Notice } from 'obsidian';
import type AITaggerPlugin from '../../main';
import { BaseSettingSection } from './BaseSettingSection';

export class PredefinedTagsSection extends BaseSettingSection {

    display(): void {
        this.containerEl.createEl('h1', { text: 'Predefined tags' });

        const predefinedTagsSetting = new Setting(this.containerEl)
            .setName('Predefined tags file')
            .setDesc('Path to a file containing predefined tags (one tag per line)');
        
        const tagsFileInputContainer = predefinedTagsSetting.controlEl.createDiv('path-input-container');
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
                const items: {path: string, isFolder: boolean}[] = [];
                
                this.plugin.app.vault.getFiles().forEach(file => {
                    if (file.path.toLowerCase().contains(searchTerm.toLowerCase())) {
                        items.push({
                            path: file.path,
                            isFolder: false
                        });
                    }
                });
                
                items.sort((a, b) => a.path.localeCompare(b.path));
                const limitedItems = items.slice(0, 50);
                tagsDropdownContainer.empty();
                
                if (limitedItems.length === 0) {
                    tagsDropdownContainer.createEl('div', {
                        text: 'No matching files',
                        cls: 'path-dropdown-empty'
                    });
                    return;
                }
                
                limitedItems.forEach(item => {
                    const pathItem = tagsDropdownContainer.createEl('div', {
                        cls: 'path-dropdown-item'
                    });
                    
                    pathItem.createSpan({
                        cls: 'path-item-icon file-icon'
                    });
                    
                    pathItem.createSpan({
                        text: item.path,
                        cls: 'path-item-text'
                    });
                    
                    pathItem.addEventListener('click', async () => {
                        tagsFileInput.value = item.path;
                        this.plugin.settings.predefinedTagsPath = item.path;
                        await this.plugin.saveSettings();
                        tagsDropdownContainer.style.display = 'none';
                    });
                });
            } catch (error) {
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
        
        tagsFileInput.addEventListener('input', async () => {
            this.plugin.settings.predefinedTagsPath = tagsFileInput.value;
            await this.plugin.saveSettings();
            
            if (tagsDropdownContainer.style.display === 'block') {
                updateTagsDropdown(tagsFileInput.value);
            }
        });
        
        document.addEventListener('click', (event) => {
            if (!tagsFileInputContainer.contains(event.target as Node)) {
                tagsDropdownContainer.style.display = 'none';
            }
        });
        
        // Add validate tags button
        predefinedTagsSetting.addButton(button => {
            button
                .setButtonText('Validate tags')
                .onClick(async () => {
                    if (!this.plugin.settings.predefinedTagsPath) {
                        new Notice('Please set a predefined tags file path first', 3000);
                        return;
                    }
                    
                    try {
                        const tagsContent = await this.plugin.app.vault.adapter.read(this.plugin.settings.predefinedTagsPath);
                        const tags = tagsContent.split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0);
                        
                        if (tags.length === 0) {
                            new Notice('No tags found in the file');
                            return;
                        }
                        
                        // Validate each tag
                        const invalidTags: string[] = [];
                        const validTags: string[] = [];
                        
                        for (const tag of tags) {
                            // Ensure tag starts with #
                            const tagWithHash = tag.startsWith('#') ? tag : `#${tag}`;
                            
                            // First check: if tag doesn't start with #, it must start with a letter
                            if (!tag.startsWith('#') && !/^[\p{L}]/u.test(tag)) {
                                invalidTags.push(tag);
                                continue;
                            }

                            // Second check: tag (with #) must only contain letters, numbers, hyphens, and underscores
                            const isValid = /^#[\p{L}\p{N}_-]+$/u.test(tagWithHash);
                            
                            if (isValid) {
                                validTags.push(tagWithHash);
                            } else {
                                invalidTags.push(tag);
                            }
                        }
                        
                        if (invalidTags.length > 0) {
                            new Notice(`Found ${invalidTags.length} invalid tags: ${invalidTags.join(', ')}`, 5000);
                        } else {
                            new Notice(`All ${validTags.length} tags are valid!`, 3000);
                        }
                    } catch (error) {
                        new Notice(`Error reading tags file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                });
        });
    }
}
