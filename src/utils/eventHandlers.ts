import { App, TFile, MarkdownView, EventRef } from 'obsidian';

interface TrackedEventRef {
    ref: EventRef;
    source: 'vault' | 'workspace';
}

export class EventHandlers {
    private app: App;
    private fileChangeTimeoutId: NodeJS.Timeout | null = null;
    private trackedRefs: TrackedEventRef[] = [];
    private isRegistered: boolean = false;

    constructor(app: App) {
        this.app = app;
    }

    registerEventHandlers() {
        // Prevent duplicate registration
        if (this.isRegistered) {
            return;
        }
        this.isRegistered = true;

        // Handle file deletions (vault event)
        const deleteRef = this.app.vault.on('delete', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.app.workspace.trigger('file-open', file);
            }
        });
        this.trackedRefs.push({ ref: deleteRef, source: 'vault' });

        // Handle file modifications (vault event)
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
        this.trackedRefs.push({ ref: modifyRef, source: 'vault' });

        // Handle layout changes (workspace event)
        const layoutRef = this.app.workspace.on('layout-change', () => {
            // Refresh any active editor views
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view?.getMode() === 'source') {
                view.editor.refresh();
            }
        });
        this.trackedRefs.push({ ref: layoutRef, source: 'workspace' });
    }

    cleanup() {
        if (this.fileChangeTimeoutId) {
            clearTimeout(this.fileChangeTimeoutId);
            this.fileChangeTimeoutId = null;
        }
        // Properly unregister event listeners from their correct sources
        for (const tracked of this.trackedRefs) {
            if (tracked.source === 'vault') {
                this.app.vault.offref(tracked.ref);
            } else {
                this.app.workspace.offref(tracked.ref);
            }
        }
        this.trackedRefs = [];
        this.isRegistered = false;
    }
}
