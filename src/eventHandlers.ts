import { App, TFile, MarkdownView } from 'obsidian';

export class EventHandlers {
    private app: App;
    private fileChangeTimeoutId: NodeJS.Timeout | null = null;

    constructor(app: App) {
        this.app = app;
    }

    registerEventHandlers() {
        // Handle file deletions
        this.app.vault.on('delete', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.app.workspace.trigger('file-open', file);
            }
        });

        // Handle file modifications
        this.app.vault.on('modify', (file) => {
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

        // Handle layout changes
        this.app.workspace.on('layout-change', () => {
            // Refresh any active editor views
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view?.getMode() === 'source') {
                view.editor.refresh();
            }
        });
    }

    cleanup() {
        if (this.fileChangeTimeoutId) {
            clearTimeout(this.fileChangeTimeoutId);
            this.fileChangeTimeoutId = null;
        }
    }
}
