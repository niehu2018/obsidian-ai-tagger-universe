import { App, Modal, TFile } from 'obsidian';
import { TagUtils } from './tagUtils';

declare global {
    interface Window {
        d3: any;
    }
}

interface TagData {
    tag: string;
    frequency: number;
    connections: Map<string, number>;
}

interface NetworkNode {
    id: string;
    label: string;
    size: number;
    frequency: number;
}

interface NetworkEdge {
    id: string;
    source: string;
    target: string;
    weight: number;
}

interface NetworkData {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
}

export class TagNetworkManager {
    private app: App;
    private tagData: Map<string, TagData> = new Map();

    constructor(app: App) {
        this.app = app;
    }

    async buildTagNetwork(): Promise<Map<string, TagData>> {
        this.tagData.clear();
        const allFiles = this.app.vault.getMarkdownFiles();
        
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

export class TagNetworkView extends Modal {
    private networkData: NetworkData;
    private cleanup: (() => void)[] = [];
    private d3LoadPromise: Promise<void> | null = null;
    
    constructor(app: App, networkData: NetworkData) {
        super(app);
        this.networkData = networkData;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tag-network-view');
        
        contentEl.createEl('h2', { text: 'Tag Network Visualization' });
        contentEl.createEl('p', { 
            text: 'Node size represents tag frequency. Connections represent tags that appear together in notes.' 
        });
        
        const controlsContainer = contentEl.createDiv({ cls: 'tag-network-controls' });
        
        const searchContainer = controlsContainer.createDiv({ cls: 'tag-network-search' });
        searchContainer.createEl('span', { text: 'Search tags: ' });
        const searchInput = searchContainer.createEl('input', { 
            type: 'text',
            placeholder: 'Type to search...',
            cls: 'tag-network-search-input'
        });
        
        const legendContainer = contentEl.createDiv({ cls: 'tag-network-legend' });
        legendContainer.createEl('span', { text: 'Frequency: ' });
        
        const lowFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        lowFreqItem.createDiv({ cls: 'tag-network-legend-color low' });
        lowFreqItem.createEl('span', { text: 'Low' });
        
        const mediumFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        mediumFreqItem.createDiv({ cls: 'tag-network-legend-color medium' });
        mediumFreqItem.createEl('span', { text: 'Medium' });
        
        const highFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        highFreqItem.createDiv({ cls: 'tag-network-legend-color high' });
        highFreqItem.createEl('span', { text: 'High' });
        
        const container = contentEl.createDiv({ cls: 'tag-network-container' });
        
        const tooltip = contentEl.createDiv({ cls: 'tag-tooltip' });
        tooltip.addClass('tag-tooltip-hidden');
        tooltip.createDiv({ cls: 'tag-tooltip-content' });
        
        const statusEl = contentEl.createDiv({ cls: 'tag-network-status' });
        statusEl.setText('Loading visualization...');
        
        if (this.networkData.nodes.length === 0) {
            statusEl.setText('No tags found in your vault. Add some tags first!');
            return;
        }
        
        try {
            this.loadVisualizationLibrary(container, searchInput, tooltip, statusEl);
        } catch (error) {
            statusEl.setText('Error loading visualization. Please try again.');
        }
    }
    
    private async loadVisualizationLibrary(container: HTMLElement, searchInput: HTMLInputElement, tooltip: HTMLElement, statusEl: HTMLElement) {
        if (this.d3LoadPromise) {
            await this.d3LoadPromise;
            return;
        }

        if (window.d3) {
            this.renderD3Network(container, searchInput, tooltip, statusEl);
            return;
        }

        this.d3LoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://d3js.org/d3.v7.min.js';
            script.async = true;

            const cleanup = () => {
                script.removeEventListener('load', handleLoad);
                script.removeEventListener('error', handleError);
            };

            const handleLoad = () => {
                cleanup();
                try {
                    this.renderD3Network(container, searchInput, tooltip, statusEl);
                    resolve();
                } catch (error) {
                    statusEl.setText('Error rendering network. Please try again.');
                    reject(error);
                }
            };

            const handleError = (error: ErrorEvent) => {
                cleanup();
                statusEl.setText('Failed to load visualization library. Please check your internet connection.');
                reject(error);
            };

            script.addEventListener('load', handleLoad);
            script.addEventListener('error', handleError);
            document.head.appendChild(script);

            this.cleanup.push(() => {
                cleanup();
                script.remove();
            });
        });

        try {
            await this.d3LoadPromise;
        } finally {
            this.d3LoadPromise = null;
        }
    }
    
    private renderD3Network(container: HTMLElement, searchInput: HTMLInputElement, tooltip: HTMLElement, statusEl: HTMLElement) {
        const d3 = window.d3;
        if (!d3) {
            statusEl.setText('Error: D3.js library not loaded');
            return;
        }
        
        statusEl.setText('Rendering network...');
        container.empty();
        
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        
        const svg = d3.select(container).append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height])
            .attr('class', 'tag-network-svg');
        
        const g = svg.append('g');
        
        const zoom = d3.zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', (event: { transform: any }) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        const nodes = this.networkData.nodes.map(node => ({
            ...node,
            x: undefined,
            y: undefined,
            fx: undefined,
            fy: undefined
        }));
        
        const links = this.networkData.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            weight: edge.weight
        }));
        
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id((d: NetworkNode) => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius((d: NetworkNode) => d.size + 5));
        
        const link = g.append('g')
                .attr('class', 'tag-network-link')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke-width', (d: NetworkEdge) => Math.sqrt(d.weight));
        
        const node = g.append('g')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('class', 'tag-network-node')
            .attr('r', (d: NetworkNode) => d.size)
            .attr('fill', (d: NetworkNode) => this.getNodeColor(d.frequency))
            .call(this.drag(simulation));
        
        const labels = g.append('g')
            .selectAll('text')
            .data(nodes)
            .join('text')
            .attr('class', 'tag-network-label')
            .text((d: NetworkNode) => d.label)
            .attr('dx', (d: NetworkNode) => d.size + 5)
            .attr('dy', 4);
        
        const handleMouseOver = (event: MouseEvent, d: NetworkNode) => {
            node.attr('opacity', (n: NetworkNode) => {
                const isConnected = links.some((link: any) => 
                    (link.source.id === d.id && link.target.id === n.id) || 
                    (link.target.id === d.id && link.source.id === n.id)
                );
                return n === d || isConnected ? 1 : 0.2;
            });
            
            link.attr('stroke-opacity', (l: any) => 
                l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
            );
            
            tooltip.addClass('visible');
            tooltip.style.left = `${event.pageX + 5}px`;
            tooltip.style.top = `${event.pageY + 5}px`;
            
            const tooltipContent = tooltip.querySelector('.tag-tooltip-content');
            if (tooltipContent) {
                const connectedNodes = links.filter((link: any) => 
                    link.source.id === d.id || link.target.id === d.id
                ).length;
                
                tooltipContent.innerHTML = `
                    <div class="tag-tooltip-title">${d.label}</div>
                    <div class="tag-tooltip-info">Frequency: ${d.frequency}</div>
                    <div class="tag-tooltip-info">Connected to ${connectedNodes} other tags</div>
                `;
            }
        };
        
        const handleMouseOut = () => {
            node.attr('opacity', 1);
            link.attr('stroke-opacity', 0.6);
            tooltip.removeClass('visible');
        };
        
        node.on('mouseover', handleMouseOver)
            .on('mouseout', handleMouseOut);
        
        const handleSearch = () => {
            const searchTerm = searchInput.value.toLowerCase();
            
            if (searchTerm.length > 0) {
                node.attr('opacity', (d: NetworkNode) => 
                    d.label.toLowerCase().includes(searchTerm) ? 1 : 0.2
                );
                
                link.attr('stroke-opacity', (l: any) => {
                    const sourceMatches = l.source.label.toLowerCase().includes(searchTerm);
                    const targetMatches = l.target.label.toLowerCase().includes(searchTerm);
                    return sourceMatches && targetMatches ? 1 : 0.1;
                });
            } else {
                node.attr('opacity', 1);
                link.attr('stroke-opacity', 0.6);
            }
        };
        
        searchInput.addEventListener('input', handleSearch);
        this.cleanup.push(() => searchInput.removeEventListener('input', handleSearch));
        
        simulation.on('tick', () => {
            link
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);
            
            node
                .attr('cx', (d: any) => d.x)
                .attr('cy', (d: any) => d.y);
            
            labels
                .attr('x', (d: any) => d.x)
                .attr('y', (d: any) => d.y);
        });

        this.cleanup.push(() => simulation.stop());
        statusEl.style.display = 'none';
    }
    
    private drag(simulation: any) {
        const d3 = window.d3;
        
        function dragstarted(event: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event: any) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event: any) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }
    
    private getNodeColor(frequency: number, opacity: number = 1): string {
        const minFreq = 1;
        const maxFreq = Math.max(...this.networkData.nodes.map(n => n.frequency));
        const normalizedFreq = (frequency - minFreq) / (maxFreq - minFreq);
        
        const r = Math.floor(100 - normalizedFreq * 100);
        const g = Math.floor(149 - normalizedFreq * 100);
        const b = Math.floor(237 - normalizedFreq * 50);
        
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    onClose() {
        const { contentEl } = this;
        this.cleanup.forEach(cleanup => cleanup());
        this.cleanup = [];
        const d3Script = document.querySelector('script[src*="d3.v7.min.js"]');
        if (d3Script) {
            d3Script.remove();
        }
        contentEl.empty();
    }
}
