import { registerGenerateCommands } from './generateCommands';
import { registerClearCommands } from './clearCommands';
import { registerPredefinedTagsCommands } from './predefinedTagsCommands';
import { registerUtilityCommands } from './utilityCommands';
import AITaggerPlugin from '../main';

export function registerCommands(plugin: AITaggerPlugin) {
    registerGenerateCommands(plugin);
    registerClearCommands(plugin);
    registerPredefinedTagsCommands(plugin);
    registerUtilityCommands(plugin);
}
