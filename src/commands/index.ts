import { registerGenerateCommands } from './generateCommands';
import { registerClearCommands } from './clearCommands';
import { registerUtilityCommands } from './utilityCommands';
import AITaggerPlugin from '../main';

export function registerCommands(plugin: AITaggerPlugin) {
    registerGenerateCommands(plugin);
    registerClearCommands(plugin);
    registerUtilityCommands(plugin);
}
