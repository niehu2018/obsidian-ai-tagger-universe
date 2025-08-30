import { App, TFile } from 'obsidian';
import { TagUtils } from './tagUtils';

export interface TagData {
    tag: string;
    frequency: number;
    connections: Map<string, number>;
}

export interface NetworkNode {
    id: string;
    label: string;
    size: number;
    frequency: number;
}

export interface NetworkEdge {
    id: string;
    source: string;
    target: string;
    weight: number;
}

export interface NetworkData {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
}

export class TagNetworkManager {
    private app: App;
    private tagData: Map<string, TagData> = new Map();

    constructor(app: App) {
        this.app = app;
    }

    async buildTagNetwork(files?: TFile[]): Promise<Map<string, TagData>> {
        this.tagData.clear();
        const allFiles = files || this.app.vault.getMarkdownFiles();
        
        for (const file of allFiles) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                const tags = TagUtils.getExistingTags(cache.frontmatter);
                
                for (const tag of tags) {
                    if (!this.tagData.has(tag)) {
                        this.tagData.set(tag, {
                            tag,
                            frequency: 0,
                            connections: new Map()
                        });
                    }
                    
                    const tagInfo = this.tagData.get(tag)!;
                    tagInfo.frequency += 1;
                }
                
                for (let i = 0; i < tags.length; i++) {
                    for (let j = i + 1; j < tags.length; j++) {
                        const tag1 = tags[i];
                        const tag2 = tags[j];
                        
                        const tagInfo1 = this.tagData.get(tag1)!;
                        if (!tagInfo1.connections.has(tag2)) {
                            tagInfo1.connections.set(tag2, 0);
                        }
                        tagInfo1.connections.set(tag2, tagInfo1.connections.get(tag2)! + 1);
                        
                        const tagInfo2 = this.tagData.get(tag2)!;
                        if (!tagInfo2.connections.has(tag1)) {
                            tagInfo2.connections.set(tag1, 0);
                        }
                        tagInfo2.connections.set(tag1, tagInfo2.connections.get(tag1)! + 1);
                    }
                }
            }
        }
        
        return this.tagData;
    }
    
    getNetworkData(): NetworkData {
        const nodes: NetworkNode[] = [];
        const edges: NetworkEdge[] = [];
        const edgeSet = new Set<string>();
        
        this.tagData.forEach((data) => {
            nodes.push({
                id: data.tag,
                label: data.tag.startsWith('#') ? data.tag.substring(1) : data.tag,
                size: Math.max(5, Math.min(30, 5 + data.frequency * 3)),
                frequency: data.frequency
            });
            
            data.connections.forEach((weight, connectedTag) => {
                const edgeId = [data.tag, connectedTag].sort().join('-');
                
                if (!edgeSet.has(edgeId)) {
                    edges.push({
                        id: edgeId,
                        source: data.tag,
                        target: connectedTag,
                        weight: weight
                    });
                    edgeSet.add(edgeId);
                }
            });
        });
        
        return { nodes, edges };
    }
}
