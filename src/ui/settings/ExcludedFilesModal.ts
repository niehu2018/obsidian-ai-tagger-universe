import { App, Modal, ButtonComponent, Setting } from 'obsidian';
import AITaggerPlugin from '../../main';
import { getVaultItems, VaultItem, getPathStrings } from '../../utils/vaultPathFetcher';

export class ExcludedFilesModal extends Modal {
    private excludedFolders: string[] = [];
    private filterInput!: HTMLInputElement;
    private pathDropdownContainer!: HTMLElement;
    private searchTerm: string = '';
    private cachedPaths: VaultItem[] = [];

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
        
        // Immediately load paths on construction to ensure they're available
        this.loadCachedPaths();
    }

    private async loadCachedPaths() {
        try {
            // Ensure we get all paths from the vault, including files and folders
            this.cachedPaths = getVaultItems(this.app);
        } catch (error) {
            // Even if there's an error, initialize with an empty array
            this.cachedPaths = [];
        }
    }

    onOpen() {
        const { contentEl } = this;

        // Refresh paths when opening to ensure they're up-to-date
        this.loadCachedPaths();

        // Set container styles
        contentEl.addClass('excluded-files-modal');
        
        // Set modal title
        const titleEl = contentEl.createEl('h2', { 
            text: 'Excluded files',
            cls: 'excluded-files-title'
        });
        
        const subtitleEl = contentEl.createEl('p', { 
            text: 'Files matching the following filters are currently excluded:',
            cls: 'excluded-files-subtitle'
        });

        // Create container for excluded paths list
        const excludedListContainer = contentEl.createDiv({ cls: 'excluded-list' });
        
        this.renderExcludedList(excludedListContainer);

        // Create filter input container
        const filterContainer = contentEl.createDiv({
            cls: 'filter-container'
        });

        // Add filter label
        const filterLabel = filterContainer.createEl('span', { 
            text: 'Filter', 
            cls: 'filter-label' 
        });

        // Create input container
        const inputContainer = filterContainer.createDiv({
            cls: 'filter-input-container'
        });

        // Add input field
        this.filterInput = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter path or "/regex/"',
            cls: 'filter-input',
            value: ''  // Start with empty value so user can type freely
        });
        
        this.searchTerm = '';  // Start with empty search term

        // Create path dropdown container - positioned directly in the inputContainer
        this.pathDropdownContainer = inputContainer.createDiv({
            cls: 'path-dropdown-container'
        });
        
        // Prevent event bubbling to keep dropdown open when clicked
        this.pathDropdownContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Add button
        const addButtonEl = new ButtonComponent(inputContainer)
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

        // Set up input events
        this.filterInput.addEventListener('focus', () => {
            // Ensure dropdown is visible and check state
            this.updatePathDropdown(this.filterInput.value);
            
            // Ensure dropdown is visible and check state
            this.pathDropdownContainer.style.display = 'block';
            
            // Force DOM repaint
            setTimeout(() => {
                if (this.pathDropdownContainer.style.display !== 'block') {
                    this.pathDropdownContainer.style.display = 'block';
                }
            }, 50);
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

        // Create button container for Save/Cancel
        const buttonContainer = contentEl.createDiv('modal-button-container');
        
        // Add Clear All button
        const clearAllButtonEl = new ButtonComponent(buttonContainer)
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
        
        // Disable button if no exclusions exist
        if (this.excludedFolders.length === 0) {
            clearAllButtonEl.buttonEl.setAttribute('disabled', 'true');
            clearAllButtonEl.buttonEl.addClass('disabled');
        }
        
        // Add cancel button
        const cancelButtonEl = new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close();
            });
        
        // Add save button
        const saveButtonEl = new ButtonComponent(buttonContainer)
            .setButtonText('Save')
            .setCta()
            .onClick(() => {
                this.onSave(this.excludedFolders);
                this.close();
            });
    }

    private updatePathDropdown(searchTerm: string) {
        this.pathDropdownContainer.empty();
        
        try {
            // Force reload paths if empty
            if (this.cachedPaths.length === 0) {
                this.cachedPaths = getVaultItems(this.app);
            }
            
            let items: VaultItem[] = [];
            const lowerSearchTerm = searchTerm.toLowerCase().trim();
            
            // Ensure there's some content even if search term is empty
            // If search term is empty, show common folders
            if (!lowerSearchTerm) {
                // Show some default folders
                const defaultFolders = [
                    { path: 'Tags/', isFolder: true, name: 'Tags' },
                    { path: 'image/', isFolder: true, name: 'image' },
                    { path: 'audio/', isFolder: true, name: 'audio' },
                    { path: 'Excalidraw/', isFolder: true, name: 'Excalidraw' },
                    { path: 'textgenerator/', isFolder: true, name: 'textgenerator' },
                    { path: 'Excalidraw_library/', isFolder: true, name: 'Excalidraw_library' },
                    { path: 'smart-chats/', isFolder: true, name: 'smart-chats' },
                    { path: 'Photos/', isFolder: true, name: 'Photos' },
                ];
                
                for (const item of defaultFolders) {
                    this.renderPathItem(item);
                }
                
                // Add "Add custom path" option
                const addCustomItem = this.pathDropdownContainer.createDiv({
                    cls: 'path-dropdown-item path-suggestion-item'
                });
                
                addCustomItem.addEventListener('mouseenter', () => {
                    addCustomItem.addClass('hover');
                });
                
                addCustomItem.addEventListener('mouseleave', () => {
                    addCustomItem.removeClass('hover');
                });
                
                addCustomItem.createSpan({
                    text: '+ Add custom path',
                    cls: 'path-suggestion-text'
                });
                
                addCustomItem.addEventListener('click', () => {
                    this.filterInput.value = '';
                    this.filterInput.focus();
                    this.pathDropdownContainer.style.display = 'none';
                });
                
                return;
            }
            
            // Use regex if the term starts with '/' (like '/regex/')
            if (searchTerm.startsWith('/') && searchTerm.endsWith('/') && searchTerm.length > 2) {
                try {
                    const regexPattern = searchTerm.slice(1, -1);
                    const regex = new RegExp(regexPattern, 'i');
                    items = this.cachedPaths.filter(item => regex.test(item.path));
                } catch (e) {
                    // If regex is invalid, fall back to normal search
                    items = this.cachedPaths.filter(item => 
                        item.path.toLowerCase().includes(lowerSearchTerm)
                    );
                }
            } else {
                // Enhanced substring search that also matches path segments
                items = this.cachedPaths.filter(item => {
                    // Check if the path or name contains the search term
                    const filePath = item.path.toLowerCase();
                    const fileName = item.name.toLowerCase();
                    
                    // Direct match for file path or filename
                    const pathMatch = filePath.includes(lowerSearchTerm);
                    const nameMatch = fileName.includes(lowerSearchTerm);
                    
                    // Match path segments (split by slash)
                    const pathSegments = item.path.split('/');
                    const segmentMatch = pathSegments.some(segment => 
                        segment.toLowerCase().includes(lowerSearchTerm)
                    );
                    
                    return pathMatch || nameMatch || segmentMatch;
                });
            }
            
            // First prioritize items that start with search term
            const sortedItems = [...items].sort((a, b) => {
                // First prioritize items that start with search term
                const aStartsWith = a.name.toLowerCase().startsWith(lowerSearchTerm);
                const bStartsWith = b.name.toLowerCase().startsWith(lowerSearchTerm);
                
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
                
                // Then sort by folder/file type
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                
                // Finally sort alphabetically by path
                return a.path.localeCompare(b.path);
            });
            
            // Show a direct add option at the top with improved styling
            const addDirectly = this.pathDropdownContainer.createDiv({
                cls: 'path-dropdown-item path-add-item'
            });
            
            addDirectly.addEventListener('mouseenter', () => {
                addDirectly.addClass('hover');
            });
            
            addDirectly.addEventListener('mouseleave', () => {
                addDirectly.removeClass('hover');
            });
            
            const addText = addDirectly.createSpan({
                text: `+ ${searchTerm}`,
                cls: 'path-suggestion-text'
            });
            
            addDirectly.addEventListener('click', () => {
                this.filterInput.value = searchTerm;
                this.pathDropdownContainer.style.display = 'none';
            });
            
            // If nothing found beyond the direct add option
            if (items.length === 0) {
                const noResultsItem = this.pathDropdownContainer.createDiv({
                    cls: 'path-dropdown-empty',
                    text: 'No matching paths found'
                });
                
                return;
            }
            
            // Limit to reasonable number of items (first 15)
            const limitedItems = sortedItems.slice(0, 15);
            
            for (const item of limitedItems) {
                this.renderPathItem(item);
            }
            
            // Show a hint if there are more results
            if (sortedItems.length > 15) {
                const moreResults = this.pathDropdownContainer.createDiv({
                    cls: 'path-dropdown-more'
                });
                
                moreResults.textContent = `${sortedItems.length - 15} more results not shown`;
            }
        } catch (error) {
            const errorItem = this.pathDropdownContainer.createDiv({
                cls: 'path-dropdown-error',
                text: 'Error loading paths'
            });
        }
    }
    
    private renderPathItem(item: VaultItem) {
        const dropdownItem = this.pathDropdownContainer.createDiv({
            cls: 'path-dropdown-item'
        });
        
        // Create icon container
        const iconContainer = dropdownItem.createDiv({
            cls: 'path-item-icon ' + (item.isFolder ? 'folder-icon' : 'file-icon')
        });
        
        // Use more consistent icon display method
        let iconSvg: string;
        if (item.isFolder) {
            // Folder icon - use SVG
            iconSvg = `<svg viewBox="0 0 100 100" width="16" height="16" class="folder-icon"><path fill="currentColor" d="M12.5,20C9.05,20,6,22.05,6,25.5v49c0,3.45,3.05,5.5,6.5,5.5h75c3.45,0,6.5-2.05,6.5-5.5v-40c0-3.45-3.05-5.5-6.5-5.5h-37.5l-10-9h-27.5z"></path></svg>`;
        } else {
            // File icon - use SVG
            iconSvg = `<svg viewBox="0 0 100 100" width="16" height="16" class="file-icon"><path fill="currentColor" d="M69.61,20H39.08V10h-28.63c-4.4,0-5.5,2.2-5.5,5.5v69c0,3.3,1.1,5.5,5.5,5.5h73c4.4,0,5.5-2.2,5.5-5.5v-58.5 L69.61,20z"></path></svg>`;
        }
        iconContainer.innerHTML = iconSvg;
        
        // Create text container
        const textContainer = dropdownItem.createDiv({
            cls: 'path-item-text',
            text: item.path
        });
        
        return dropdownItem;
    }

    private showEmptyState(container: HTMLElement, message: string = 'No matching paths found') {
        container.empty();
        
        // Adjust empty state styles
        const emptyState = container.createDiv({
            cls: 'path-dropdown-empty',
            text: message
        });
    }

    private renderExcludedList(container: HTMLElement) {
        container.empty();
        
        if (this.excludedFolders.length === 0) {
            const emptyState = container.createSpan({
                cls: 'excluded-empty-state',
                text: 'No exclusions defined yet.'
            });
            return;
        }
        
        // Create rows for each excluded path
        const rows = this.excludedFolders.map((path, index) => {
            const row = container.createDiv({
                cls: 'excluded-row'
            });
            
            // For last element, remove bottom border
            if (index < this.excludedFolders.length - 1) {
                row.addClass('with-border');
            }
            
            // Hover effect
            row.addEventListener('mouseenter', () => {
                row.addClass('hover');
            });
            
            row.addEventListener('mouseleave', () => {
                row.removeClass('hover');
            });
            
            // Add path text
            const pathText = row.createSpan({
                text: path,
                cls: 'excluded-path'
            });
            
            // Add delete button
            const deleteBtn = row.createSpan({
                cls: 'excluded-delete',
                text: '×'
            });
            
            // Hover effect for delete button
            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.addClass('hover');
            });
            
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.removeClass('hover');
            });
            
            deleteBtn.addEventListener('click', () => {
                this.excludedFolders = this.excludedFolders.filter(f => f !== path);
                this.renderExcludedList(container);
            });
            
            return row;
        });
    }

    onClose() {
        const { contentEl } = this;
        
        // Clean up event listeners
        document.removeEventListener('click', this.documentClickListener);
        
        contentEl.empty();
    }
} 