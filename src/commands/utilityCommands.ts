import { MarkdownView, Notice, TFile } from 'obsidian';
import AITaggerPlugin from '../main';
import { TagUtils } from '../utils/tagUtils';
import { TagRenameModal } from '../ui/modals/TagRenameModal';
import { TagImportModal } from '../ui/modals/TagImportModal';
import { TagImportExport } from '../utils/tagImportExport';
import { TagTemplateApplyModal } from '../ui/modals/TagTemplateApplyModal';
import { TagDeduplicationModal } from '../ui/modals/TagDeduplicationModal';

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

    // Command to show tag analytics dashboard
    plugin.addCommand({
        id: 'show-tag-analytics',
        name: plugin.t.commands.showTagAnalytics,
        icon: 'bar-chart-2',
        callback: async () => {
            await plugin.showTagAnalytics();
        }
    });

    // Command to bulk rename tag
    plugin.addCommand({
        id: 'bulk-rename-tag',
        name: plugin.t.commands.bulkRenameTag,
        icon: 'replace',
        callback: () => {
            new TagRenameModal(
                plugin.app,
                plugin.t,
                plugin.settings.tagFormat
            ).open();
        }
    });

    // Command to export tags to CSV
    plugin.addCommand({
        id: 'export-tags-csv',
        name: plugin.t.commands.exportTagsCSV,
        icon: 'download',
        callback: async () => {
            const exporter = new TagImportExport(plugin.app);
            const csv = await exporter.exportToCSV();
            const filename = `tags-export-${new Date().toISOString().split('T')[0]}.csv`;
            exporter.downloadFile(csv, filename, 'text/csv');
            new Notice(plugin.t.tagImportExport.exportSuccess);
        }
    });

    // Command to export tags to JSON
    plugin.addCommand({
        id: 'export-tags-json',
        name: plugin.t.commands.exportTagsJSON,
        icon: 'download',
        callback: async () => {
            const exporter = new TagImportExport(plugin.app);
            const json = await exporter.exportToJSON();
            const filename = `tags-export-${new Date().toISOString().split('T')[0]}.json`;
            exporter.downloadFile(json, filename, 'application/json');
            new Notice(plugin.t.tagImportExport.exportSuccess);
        }
    });

    // Command to import tags
    plugin.addCommand({
        id: 'import-tags',
        name: plugin.t.commands.importTags,
        icon: 'upload',
        callback: () => {
            new TagImportModal(
                plugin.app,
                plugin.t,
                plugin.settings.tagFormat
            ).open();
        }
    });

    // Command to apply tag template
    plugin.addCommand({
        id: 'apply-tag-template',
        name: plugin.t.commands.applyTagTemplate,
        icon: 'layout-template',
        callback: () => {
            const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView?.file) {
                new Notice(plugin.t.messages.openNote);
                return;
            }

            if (plugin.settings.tagTemplates.length === 0) {
                new Notice(plugin.t.tagTemplates.noTemplates);
                return;
            }

            new TagTemplateApplyModal(
                plugin.app,
                plugin.t,
                plugin.settings.tagTemplates,
                activeView.file
            ).open();
        }
    });

    // Command to find and merge similar tags
    plugin.addCommand({
        id: 'deduplicate-tags',
        name: plugin.t.commands.deduplicateTags,
        icon: 'git-merge',
        callback: () => {
            new TagDeduplicationModal(
                plugin.app,
                plugin.t,
                plugin.settings.tagFormat
            ).open();
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
