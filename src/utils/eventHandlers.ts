import { App, TFile, MarkdownView, EventRef } from 'obsidian';

export class EventHandlers {
    private app: App;
    private fileChangeTimeoutId: NodeJS.Timeout | null = null;
    private eventRefs: EventRef[] = [];

    constructor(app: App) {
        this.app = app;
    }

    registerEventHandlers() {
        // Handle file deletions
        const deleteRef = this.app.vault.on('delete', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.app.workspace.trigger('file-open', file);
            }
        });
        this.eventRefs.push(deleteRef);

        // Handle file modifications
        const modifyRef = this.app.vault.on('modify', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                // Debounce file refresh on changes
                if (this.fileChangeTimeoutId) {
                    clearTimeout(this.fileChangeTimeoutId);
                }
                this.fileChangeTimeoutId = setTimeout(() => {
                    this.app.workspace.trigger('file-open', file);
                    this.fileChangeTimeoutId = null;
                }, 2000);
            }
        });
        this.eventRefs.push(modifyRef);

        // Handle layout changes
        const layoutRef = this.app.workspace.on('layout-change', () => {
            // Refresh any active editor views
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view?.getMode() === 'source') {
                view.editor.refresh();
            }
        });
        this.eventRefs.push(layoutRef);
    }

    cleanup() {
        if (this.fileChangeTimeoutId) {
            clearTimeout(this.fileChangeTimeoutId);
            this.fileChangeTimeoutId = null;
        }
        // Properly unregister all event listeners
        for (const ref of this.eventRefs) {
            this.app.vault.offref(ref);
            this.app.workspace.offref(ref);
        }
        this.eventRefs = [];
    }
}
