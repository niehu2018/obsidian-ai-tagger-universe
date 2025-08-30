import { Editor, MarkdownFileInfo, MarkdownView, Notice, TFile } from 'obsidian';
import AITaggerPlugin from '../main';

export function registerClearCommands(plugin: AITaggerPlugin) {
    // Command to clear tags in current note
    plugin.addCommand({
        id: 'clear-tags-for-current-note',
        name: 'Clear tags for current note',
        icon: 'eraser',
        editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
            const view = ctx instanceof MarkdownView ? ctx : null;
            if (view?.file) {
                plugin.clearNoteTags();
            } else {
                new Notice('Please open a note first');
            }
        }
    });

    // Command to clear tags in current folder
    plugin.addCommand({
        id: 'clear-tags-for-current-folder',
        name: 'Clear tags for current folder',
        icon: 'eraser',
        callback: async () => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('Please open a note first');
                return;
            }

            const parentFolder = activeFile.parent;
            if (!parentFolder) {
                new Notice('No parent folder found');
                return;
            }

            const filesInFolder = plugin.getNonExcludedMarkdownFilesFromFolder(parentFolder);

            if (filesInFolder.length === 0) {
                new Notice('No markdown files found in current folder');
                return;
            }

            const confirmed = await plugin.showConfirmationDialog(
                `Remove all tags from ${filesInFolder.length} notes in this folder? This cannot be undone.`
            );
            
            if (!confirmed) {
                new Notice('Operation cancelled');
                return;
            }
            
            const result = await plugin.clearDirectoryTags(filesInFolder);
            if (result.success) {
                new Notice(`Tags cleared from ${result.successCount} notes`);
            } else {
                new Notice('Failed to clear tags');
            }
        }
    });

    // Command to clear tags in vault
    plugin.addCommand({
        id: 'clear-tags-for-vault',
        name: 'Clear tags for vault',
        icon: 'eraser',
        callback: async () => {
            await plugin.clearAllNotesTags();
        }
    });
}
