import { App, Notice, TFile, TFolder } from 'obsidian';
import { TagUtils } from './tagUtils';
import * as path from 'path';

export async function saveAllTags(app: App, tagDir: string = 'tags'): Promise<void> {
    const tags = TagUtils.getAllTags(app);
    const formattedTags = tags.map(tag => tag.startsWith('#') ? tag.substring(1) : tag).join('\n');

    const vault = app.vault;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const folderPath = tagDir;
    let folder = vault.getAbstractFileByPath(folderPath);
    if (!folder) {
        folder = await vault.createFolder(folderPath);
    }
    
    const filePath = path.join(folderPath, `tags_${dateStr}.md`);
    let file = vault.getAbstractFileByPath(filePath);
    
    if (!file) {
        file = await vault.create(filePath, formattedTags);
    } else {
        await vault.modify(file as TFile, formattedTags);
    }
    
    new Notice(`Tags saved to ${filePath}`);
}
