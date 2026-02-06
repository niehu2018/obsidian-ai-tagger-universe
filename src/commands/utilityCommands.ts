import { MarkdownView, Notice, TFile } from 'obsidian';
import AITaggerPlugin from '../main';
import { TagUtils } from '../utils/tagUtils';

export function registerUtilityCommands(plugin: AITaggerPlugin) {
    // Command to collect all tags from vault
    plugin.addCommand({
        id: 'collect-all-tags',
        name: plugin.t.commands.collectAllTags,
        icon: 'tags',
        callback: async () => {
            await TagUtils.saveAllTags(plugin.app, plugin.settings.tagDir);
        }
    });

    // Command to show tag network visualization
    plugin.addCommand({
        id: 'show-tag-network',
        name: plugin.t.commands.showTagNetwork,
        icon: 'git-graph',
        callback: async () => {
            await plugin.showTagNetwork();
        }
    });

    // Command to flatten hierarchical tags for current note
    plugin.addCommand({
        id: 'flatten-tags-for-current-note',
        name: plugin.t.commands.flattenTagsForCurrentNote,
        icon: 'list-tree',
        callback: async () => {
            const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView?.file) {
                new Notice(plugin.t.messages.openNote);
                return;
            }

            const confirmed = await plugin.showConfirmationDialog(plugin.t.messages.flattenTagsConfirm);
            if (!confirmed) {
                new Notice(plugin.t.messages.operationCancelled);
                return;
            }

            const result = await TagUtils.flattenHierarchicalTags(
                plugin.app,
                activeView.file,
                plugin.settings.tagFormat
            );

            if (result.success) {
                new Notice(result.message);
            } else {
                new Notice(`Error: ${result.message}`);
            }
        }
    });

    // Command to flatten hierarchical tags for current folder
    plugin.addCommand({
        id: 'flatten-tags-for-current-folder',
        name: plugin.t.commands.flattenTagsForCurrentFolder,
        icon: 'list-tree',
        callback: async () => {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice(plugin.t.messages.openNote);
                return;
            }

            const parentFolder = activeFile.parent;
            if (!parentFolder) {
                new Notice(plugin.t.messages.noParentFolder);
                return;
            }

            const filesInFolder = plugin.getNonExcludedMarkdownFilesFromFolder(parentFolder);
            if (filesInFolder.length === 0) {
                new Notice(plugin.t.messages.noMdFiles);
                return;
            }

            const confirmed = await plugin.showConfirmationDialog(
                plugin.t.messages.flattenTagsForFolderConfirm.replace('{count}', String(filesInFolder.length))
            );
            if (!confirmed) {
                new Notice(plugin.t.messages.operationCancelled);
                return;
            }

            await flattenTagsInFiles(plugin, filesInFolder);
        }
    });

    // Command to flatten hierarchical tags for vault
    plugin.addCommand({
        id: 'flatten-tags-for-vault',
        name: plugin.t.commands.flattenTagsForVault,
        icon: 'list-tree',
        callback: async () => {
            const files = plugin.getNonExcludedMarkdownFiles();
            if (files.length === 0) {
                new Notice(plugin.t.messages.noMdFiles);
                return;
            }

            const confirmed = await plugin.showConfirmationDialog(plugin.t.messages.flattenTagsForVaultConfirm);
            if (!confirmed) {
                new Notice(plugin.t.messages.operationCancelled);
                return;
            }

            await flattenTagsInFiles(plugin, files);
        }
    });
}

async function flattenTagsInFiles(plugin: AITaggerPlugin, files: TFile[]): Promise<void> {
    new Notice(plugin.t.messages.flatteningTags);

    let successCount = 0;
    let hasHierarchical = 0;

    for (const file of files) {
        const cache = plugin.app.metadataCache.getFileCache(file);
        const tags = cache?.frontmatter ? TagUtils.getExistingTags(cache.frontmatter) : [];

        // Check if file has hierarchical tags
        if (tags.some(tag => tag.includes('/'))) {
            hasHierarchical++;
            const result = await TagUtils.flattenHierarchicalTags(
                plugin.app,
                file,
                plugin.settings.tagFormat
            );
            if (result.success) {
                successCount++;
            }
        }
    }

    if (hasHierarchical === 0) {
        new Notice(plugin.t.messages.noHierarchicalTags);
    } else {
        new Notice(plugin.t.messages.tagsFlattenedSuccessfully.replace('{count}', String(successCount)));
    }
}
