import AITaggerPlugin from '../main';
import { TagUtils } from '../utils/tagUtils';

export function registerUtilityCommands(plugin: AITaggerPlugin) {
    // Command to collect all tags from vault
    plugin.addCommand({
        id: 'collect-all-tags',
        name: 'Collect all tags from vault',
        icon: 'tags',
        callback: async () => {
            await TagUtils.saveAllTags(plugin.app, plugin.settings.tagDir);
        }
    });
    
    // Command to show tag network visualization
    plugin.addCommand({
        id: 'show-tag-network',
        name: 'Show tag network visualization',
        icon: 'network',
        callback: async () => {
            await plugin.showTagNetwork();
        }
    });
}
