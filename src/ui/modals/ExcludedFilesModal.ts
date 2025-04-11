import { App, Modal, ButtonComponent, Setting } from 'obsidian';
import AITaggerPlugin from '../../main';
import { getVaultItems, VaultItem, getPathStrings } from '../../utils/vaultPathFetcher';

export class ExcludedFilesModal extends Modal {
    private excludedFolders: string[] = [];
    private filterInput!: HTMLInputElement;
    private pathDropdownContainer!: HTMLElement;
    private searchTerm: string = '';
    private cachedPaths: VaultItem[] = [];
    private hasLoadedPaths: boolean = false;

    private documentClickListener = (event: MouseEvent) => {
        const target = event.target as Node;
        if (this.filterInput && !this.filterInput.parentElement?.contains(target) && 
            !this.pathDropdownContainer.contains(target)) {
            this.pathDropdownContainer.style.display = 'none';
        }
    };

    constructor(
        app: App, 
        private plugin: AITaggerPlugin, 
        private onSave: (excludedFolders: string[]) => void
    ) {
        super(app);
        this.excludedFolders = [...plugin.settings.excludedFolders];
    }

    private loadCachedPaths() {
        // Only load paths if they haven't been loaded yet
        if (!this.hasLoadedPaths) {
            try {
                this.cachedPaths = getVaultItems(this.app);
                this.hasLoadedPaths = true;
            } catch (error) {
                this.cachedPaths = [];
            }
        }
    }

    onOpen() {
        const { contentEl } = this;

        // Load paths when the modal is opened
        this.loadCachedPaths();

        // Set container styles
        contentEl.addClass('excluded-files-modal');
        contentEl.style.padding = '20px';
        contentEl.style.maxWidth = '500px';
        contentEl.style.margin = '0 auto';
        
        // Set modal title with improved styling
        const titleEl = contentEl.createEl('h2', { 
            text: 'Excluded files',
            cls: 'excluded-files-title'
        });
        titleEl.style.marginTop = '0';
        titleEl.style.marginBottom = '10px';
        titleEl.style.color = 'var(--text-normal)';
        titleEl.style.borderBottom = '1px solid var(--background-modifier-border)';
        titleEl.style.paddingBottom = '10px';
        
        const subtitleEl = contentEl.createEl('p', { 
            text: 'Files matching the following filters are currently excluded:',
            cls: 'excluded-files-subtitle'
        });
        subtitleEl.style.margin = '10px 0 15px';
        subtitleEl.style.color = 'var(--text-muted)';
        subtitleEl.style.fontSize = '14px';

        // Create container for excluded paths list
        const excludedListContainer = contentEl.createDiv({ cls: 'excluded-list' });
        excludedListContainer.style.marginBottom = '20px';
        excludedListContainer.style.maxHeight = '200px';
        excludedListContainer.style.overflowY = 'auto';
        excludedListContainer.style.padding = '5px';
        excludedListContainer.style.border = '1px solid var(--background-modifier-border)';
        excludedListContainer.style.borderRadius = '4px';
        excludedListContainer.style.backgroundColor = 'var(--background-secondary)';
        
        this.renderExcludedList(excludedListContainer);

        // Create filter input container with improved styling
        const filterContainer = contentEl.createDiv({
            cls: 'filter-container'
        });
        filterContainer.style.marginBottom = '20px';

        // Add filter label
        const filterLabel = filterContainer.createEl('div', { 
            text: 'Filter', 
            cls: 'filter-label' 
        });
        filterLabel.style.fontWeight = 'bold';
        filterLabel.style.marginBottom = '8px';
        filterLabel.style.fontSize = '16px';

        // Create input container
        const inputContainer = filterContainer.createDiv({
            cls: 'filter-input-container'
        });
        inputContainer.style.display = 'flex';
        inputContainer.style.position = 'relative';

        // Add input field with improved styling
        this.filterInput = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter path or "/regex/"',
            cls: 'filter-input',
            value: ''
        });
        this.filterInput.style.flex = '1';
        this.filterInput.style.padding = '8px 12px';
        this.filterInput.style.fontSize = '14px';
        this.filterInput.style.border = '1px solid var(--background-modifier-border)';
        this.filterInput.style.borderRadius = '4px';
        this.filterInput.style.backgroundColor = 'var(--background-primary)';
        
        this.searchTerm = '';  // Start with empty search term

        // Create path dropdown container
        this.pathDropdownContainer = inputContainer.createDiv({
            cls: 'path-dropdown-container'
        });
        
        // Style the dropdown container
        this.pathDropdownContainer.style.position = 'absolute';
        this.pathDropdownContainer.style.top = '100%';
        this.pathDropdownContainer.style.left = '0';
        this.pathDropdownContainer.style.width = '100%';
        this.pathDropdownContainer.style.maxHeight = '200px';
        this.pathDropdownContainer.style.overflowY = 'auto';
        this.pathDropdownContainer.style.backgroundColor = 'var(--background-primary)';
        this.pathDropdownContainer.style.border = '1px solid var(--background-modifier-border)';
        this.pathDropdownContainer.style.borderRadius = '4px';
        this.pathDropdownContainer.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.15)';
        this.pathDropdownContainer.style.zIndex = '1000';
        this.pathDropdownContainer.style.display = 'none';
        
        // Prevent event bubbling to keep dropdown open when clicked
        this.pathDropdownContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Add button with improved styling
        const addButtonContainer = inputContainer.createDiv();
        addButtonContainer.style.marginLeft = '8px';
        
        const addButtonEl = new ButtonComponent(addButtonContainer)
            .setButtonText('Add')
            .onClick(() => {
                const value = this.filterInput.value.trim();
                if (value && !this.excludedFolders.includes(value)) {
                    this.excludedFolders.push(value);
                    this.renderExcludedList(excludedListContainer);
                    this.filterInput.value = '';
                    this.searchTerm = '';
                    this.pathDropdownContainer.style.display = 'none';
                }
            });
        
        // Add class to the button element
        addButtonEl.buttonEl.addClass('excluded-files-add-button');
        addButtonEl.buttonEl.style.padding = '8px 16px';
        addButtonEl.buttonEl.style.fontSize = '14px';
        addButtonEl.buttonEl.style.fontWeight = 'bold';

        // Set up input events
        this.filterInput.addEventListener('focus', () => {
            // Show dropdown when input gets focus
            this.updatePathDropdown(this.filterInput.value);
            this.pathDropdownContainer.style.display = 'block';
        });

        this.filterInput.addEventListener('input', () => {
            this.searchTerm = this.filterInput.value;
            this.updatePathDropdown(this.searchTerm);
            
            // Make sure dropdown is visible when typing
            this.pathDropdownContainer.style.display = 'block';
        });

        this.filterInput.addEventListener('click', (e) => {
            // Prevent document click handler from hiding dropdown
            e.stopPropagation();
            
            // Show dropdown on click in the input
            this.updatePathDropdown(this.filterInput.value);
            this.pathDropdownContainer.style.display = 'block';
        });

        // Handle clicks outside the dropdown
        document.addEventListener('click', this.documentClickListener);

        // Create spacer element to push buttons to bottom
        const spacerEl = contentEl.createDiv('modal-spacer');
        spacerEl.style.flexGrow = '1';
        spacerEl.style.minHeight = '20px';
        
        // Create button container for Save/Cancel with improved positioning
        const buttonContainer = contentEl.createDiv('modal-button-container');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.padding = '10px 0';
        buttonContainer.style.borderTop = '1px solid var(--background-modifier-border)';
        
        // Left-side buttons container
        const leftButtonContainer = buttonContainer.createDiv('left-buttons');
        
        // Add Clear All button
        const clearAllButtonEl = new ButtonComponent(leftButtonContainer)
            .setButtonText('Clear All')
            .onClick(() => {
                // Confirmation dialog to prevent accidental deletion
                if (this.excludedFolders.length > 0 && confirm('Are you sure you want to remove all excluded paths?')) {
                    this.excludedFolders = [];
                    this.renderExcludedList(excludedListContainer);
                }
            });
        
        // Set appropriate class
        clearAllButtonEl.buttonEl.addClass('excluded-files-clear-button');
        clearAllButtonEl.buttonEl.style.backgroundColor = 'var(--background-secondary)';
        
        // Disable button if no exclusions exist
        if (this.excludedFolders.length === 0) {
            clearAllButtonEl.buttonEl.setAttribute('disabled', 'true');
            clearAllButtonEl.buttonEl.addClass('disabled');
        }
        
        // Right-side buttons container
        const rightButtonContainer = buttonContainer.createDiv('right-buttons');
        rightButtonContainer.style.display = 'flex';
        rightButtonContainer.style.gap = '10px';
        
        // Add cancel button
        const cancelButtonEl = new ButtonComponent(rightButtonContainer)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close();
            });
        
        cancelButtonEl.buttonEl.style.minWidth = '80px';
        
        // Add save button
        const saveButtonEl = new ButtonComponent(rightButtonContainer)
            .setButtonText('Save')
            .setCta()
            .onClick(() => {
                this.onSave(this.excludedFolders);
                this.close();
            });
        
        saveButtonEl.buttonEl.style.minWidth = '80px';
    }

    private updatePathDropdown(searchTerm: string) {
        this.pathDropdownContainer.empty();
        
        try {
            // Make sure paths are loaded
            if (!this.hasLoadedPaths) {
                this.loadCachedPaths();
            }
            
            const lowerSearchTerm = searchTerm.toLowerCase().trim();
            let matchedItems: VaultItem[] = [];
            
            // Filter cached paths based on search term
            if (lowerSearchTerm) {
                matchedItems = this.cachedPaths.filter(item => 
                    item.path.toLowerCase().includes(lowerSearchTerm) ||
                    item.name.toLowerCase().includes(lowerSearchTerm)
                );
                
                // Sort by relevance - exact matches first, then starts with, then includes
                matchedItems.sort((a, b) => {
                    const aName = a.name.toLowerCase();
                    const bName = b.name.toLowerCase();
                    const aPath = a.path.toLowerCase();
                    const bPath = b.path.toLowerCase();
                    
                    // Exact name matches
                    if (aName === lowerSearchTerm && bName !== lowerSearchTerm) return -1;
                    if (aName !== lowerSearchTerm && bName === lowerSearchTerm) return 1;
                    
                    // Name starts with
                    if (aName.startsWith(lowerSearchTerm) && !bName.startsWith(lowerSearchTerm)) return -1;
                    if (!aName.startsWith(lowerSearchTerm) && bName.startsWith(lowerSearchTerm)) return 1;
                    
                    // Path starts with
                    if (aPath.startsWith(lowerSearchTerm) && !bPath.startsWith(lowerSearchTerm)) return -1;
                    if (!aPath.startsWith(lowerSearchTerm) && bPath.startsWith(lowerSearchTerm)) return 1;
                    
                    // Folders first
                    if (a.isFolder && !b.isFolder) return -1;
                    if (!a.isFolder && b.isFolder) return 1;
                    
                    // Default to alphabetical
                    return aPath.localeCompare(bPath);
                });
            } else {
                // Show common folders/patterns if no search term
                const commonPatterns = [
                    { path: 'Tags/', isFolder: true, name: 'Tags' },
                    { path: 'images/', isFolder: true, name: 'images' },
                    { path: 'audio/', isFolder: true, name: 'audio' },
                    { path: 'Excalidraw/', isFolder: true, name: 'Excalidraw' },
                    { path: 'textgenerator/', isFolder: true, name: 'textgenerator' },
                    { path: 'attachments/', isFolder: true, name: 'attachments' },
                    { path: 'templates/', isFolder: true, name: 'templates' },
                    { path: '.obsidian/', isFolder: true, name: '.obsidian' },
                ];
                
                // Find actual matching folders from vault that match common patterns
                for (const pattern of commonPatterns) {
                    const existingItem = this.cachedPaths.find(item => 
                        item.path.toLowerCase() === pattern.path.toLowerCase() ||
                        item.name.toLowerCase() === pattern.name.toLowerCase()
                    );
                    
                    if (existingItem) {
                        matchedItems.push(existingItem);
                    } else {
                        // Add suggestion even if not found
                        matchedItems.push(pattern);
                    }
                }
            }
            
            // Limit items shown for performance
            const limitedItems = matchedItems.slice(0, 10);
            
            if (limitedItems.length === 0) {
                // Show a message when no items match
                const noItemsEl = this.pathDropdownContainer.createDiv({
                    cls: 'path-dropdown-empty'
                });
                noItemsEl.style.padding = '10px';
                noItemsEl.style.textAlign = 'center';
                noItemsEl.style.color = 'var(--text-muted)';
                noItemsEl.style.fontSize = '14px';
                
                noItemsEl.textContent = 'No matching paths found';
                
                // Add option to use current text as a pattern
                if (lowerSearchTerm) {
                    const useCurrentTextEl = this.pathDropdownContainer.createDiv({
                        cls: 'path-dropdown-item path-use-current'
                    });
                    useCurrentTextEl.style.padding = '8px 12px';
                    useCurrentTextEl.style.cursor = 'pointer';
                    useCurrentTextEl.style.display = 'flex';
                    useCurrentTextEl.style.alignItems = 'center';
                    useCurrentTextEl.style.color = 'var(--text-accent)';
                    useCurrentTextEl.style.backgroundColor = 'var(--background-secondary)';
                    useCurrentTextEl.style.borderRadius = '4px';
                    useCurrentTextEl.style.margin = '8px';
                    
                    useCurrentTextEl.addEventListener('mouseenter', () => {
                        useCurrentTextEl.style.backgroundColor = 'var(--background-modifier-hover)';
                    });
                    
                    useCurrentTextEl.addEventListener('mouseleave', () => {
                        useCurrentTextEl.style.backgroundColor = 'var(--background-secondary)';
                    });
                    
                    useCurrentTextEl.textContent = `Use "${searchTerm}" as pattern`;
                    
                    useCurrentTextEl.addEventListener('click', () => {
                        // Add current text as an exclusion pattern
                        if (!this.excludedFolders.includes(searchTerm)) {
                            this.excludedFolders.push(searchTerm);
                            const listContainer = this.contentEl.querySelector('.excluded-list') as HTMLElement;
                            if (listContainer) this.renderExcludedList(listContainer);
                            this.filterInput.value = '';
                            this.searchTerm = '';
                            this.pathDropdownContainer.style.display = 'none';
                        }
                    });
                }
            } else {
                // Render all matched items
                for (const item of limitedItems) {
                    this.renderPathItem(item);
                }
                
                // Show total count if there are more results
                if (matchedItems.length > limitedItems.length) {
                    const moreItemsEl = this.pathDropdownContainer.createDiv({
                        cls: 'path-dropdown-more'
                    });
                    moreItemsEl.style.padding = '6px 10px';
                    moreItemsEl.style.textAlign = 'center';
                    moreItemsEl.style.fontSize = '12px';
                    moreItemsEl.style.color = 'var(--text-muted)';
                    moreItemsEl.style.borderTop = '1px solid var(--background-modifier-border)';
                    
                    moreItemsEl.textContent = `${matchedItems.length - limitedItems.length} more results...`;
                }
            }
            
            // Display the dropdown
            this.pathDropdownContainer.style.display = 'block';
        } catch (error) {
            //console.error('Error updating path dropdown:', error);
            
            // Show error state
            const errorEl = this.pathDropdownContainer.createDiv({
                cls: 'path-dropdown-error'
            });
            errorEl.style.padding = '10px';
            errorEl.style.color = 'var(--text-error)';
            errorEl.textContent = 'Error loading paths';
        }
    }

    private renderPathItem(item: VaultItem) {
        const itemEl = this.pathDropdownContainer.createDiv({
            cls: 'path-dropdown-item'
        });
        
        // Style the item
        itemEl.style.padding = '8px 12px';
        itemEl.style.cursor = 'pointer';
        itemEl.style.display = 'flex';
        itemEl.style.alignItems = 'center';
        itemEl.style.borderBottom = '1px solid var(--background-modifier-border)';
        
        // Add hover effect
        itemEl.addEventListener('mouseenter', () => {
            itemEl.style.backgroundColor = 'var(--background-modifier-hover)';
        });
        
        itemEl.addEventListener('mouseleave', () => {
            itemEl.style.backgroundColor = '';
        });
        
        // Add appropriate icon
        const iconEl = itemEl.createSpan({
            cls: `path-item-icon ${item.isFolder ? 'folder-icon' : 'file-icon'}`
        });
        
        iconEl.style.marginRight = '8px';
        iconEl.style.fontSize = '14px';
        iconEl.style.minWidth = '20px';
        iconEl.style.display = 'inline-flex';
        iconEl.style.alignItems = 'center';
        iconEl.style.justifyContent = 'center';
        
        // Create text element for path
        const textEl = itemEl.createSpan({
            cls: 'path-item-text',
            text: item.path
        });
        
        textEl.style.overflow = 'hidden';
        textEl.style.textOverflow = 'ellipsis';
        textEl.style.whiteSpace = 'nowrap';
        textEl.style.flex = '1';
        
        // Highlight search term if applicable
        if (this.searchTerm) {
            const searchTermLower = this.searchTerm.toLowerCase();
            const pathLower = item.path.toLowerCase();
            const index = pathLower.indexOf(searchTermLower);
            
            if (index >= 0) {
                textEl.empty();
                
                // Text before match
                if (index > 0) {
                    textEl.createSpan({
                        text: item.path.substring(0, index)
                    });
                }
                
                // Highlighted match
                const highlightSpan = textEl.createSpan({
                    text: item.path.substring(index, index + this.searchTerm.length),
                    cls: 'path-match-highlight'
                });
                
                highlightSpan.style.backgroundColor = 'var(--text-highlight-bg)';
                highlightSpan.style.borderRadius = '2px';
                
                // Text after match
                if (index + this.searchTerm.length < item.path.length) {
                    textEl.createSpan({
                        text: item.path.substring(index + this.searchTerm.length)
                    });
                }
            }
        }
        
        // Add click handler
        itemEl.addEventListener('click', () => {
            this.filterInput.value = item.path;
            this.searchTerm = item.path;
            this.pathDropdownContainer.style.display = 'none';
            
            // Add path to excluded folders directly
            if (!this.excludedFolders.includes(item.path)) {
                this.excludedFolders.push(item.path);
                const listContainer = this.contentEl.querySelector('.excluded-list') as HTMLElement;
                if (listContainer) this.renderExcludedList(listContainer);
                this.filterInput.value = '';
                this.searchTerm = '';
            }
        });
    }

    private renderExcludedList(container: HTMLElement) {
        container.empty();
        
        if (this.excludedFolders.length === 0) {
            const emptyEl = container.createEl('div', {
                text: 'No exclusions defined yet.',
                cls: 'excluded-empty-message'
            });
            
            emptyEl.style.padding = '10px';
            emptyEl.style.color = 'var(--text-muted)';
            emptyEl.style.textAlign = 'center';
            emptyEl.style.fontStyle = 'italic';
            
            return;
        }
        
        const excludedList = container.createEl('div', {
            cls: 'excluded-folders-list'
        });
        
        for (const folder of this.excludedFolders) {
            const item = excludedList.createEl('div', {
                cls: 'excluded-folder-item'
            });
            
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.padding = '6px 8px';
            item.style.margin = '3px 0';
            item.style.backgroundColor = 'var(--background-primary)';
            item.style.borderRadius = '4px';
            item.style.border = '1px solid var(--background-modifier-border)';
            
            // Path text with icon
            const pathContainer = item.createDiv({
                cls: 'excluded-folder-path'
            });
            pathContainer.style.display = 'flex';
            pathContainer.style.alignItems = 'center';
            pathContainer.style.overflow = 'hidden';
            pathContainer.style.flex = '1';
            
            // Add appropriate icon based on pattern
            const isFolder = folder.endsWith('/');
            const iconEl = pathContainer.createSpan({
                cls: `excluded-item-icon ${isFolder ? 'folder-icon' : folder.includes('*') ? 'search-icon' : 'file-icon'}`
            });
            iconEl.style.marginRight = '8px';
            
            // Path text
            const textEl = pathContainer.createSpan({
                text: folder,
                cls: 'excluded-folder-text'
            });
            textEl.style.overflow = 'hidden';
            textEl.style.textOverflow = 'ellipsis';
            textEl.style.whiteSpace = 'nowrap';
            
            // Remove button
            const removeButton = item.createEl('button', {
                cls: 'excluded-folder-remove',
                text: '×'
            });
            
            removeButton.style.border = 'none';
            removeButton.style.background = 'none';
            removeButton.style.cursor = 'pointer';
            removeButton.style.color = 'var(--text-muted)';
            removeButton.style.fontSize = '18px';
            removeButton.style.padding = '0 4px';
            removeButton.style.marginLeft = '4px';
            
            removeButton.addEventListener('mouseenter', () => {
                removeButton.style.color = 'var(--text-error)';
            });
            
            removeButton.addEventListener('mouseleave', () => {
                removeButton.style.color = 'var(--text-muted)';
            });
            
            removeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = this.excludedFolders.indexOf(folder);
                if (index !== -1) {
                    this.excludedFolders.splice(index, 1);
                    this.renderExcludedList(container);
                }
            });
        }
    }

    onClose() {
        document.removeEventListener('click', this.documentClickListener);
        this.contentEl.empty();
    }
} 