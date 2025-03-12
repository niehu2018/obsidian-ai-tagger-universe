import { App, Modal, TFile } from 'obsidian';
import { TagUtils } from './tagUtils';

interface TagData {
    tag: string;
    frequency: number;
    connections: Map<string, number>;
}

export class TagNetworkManager {
    private app: App;
    private tagData: Map<string, TagData> = new Map();

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Analyze all notes in the vault to build tag network data
     */
    async buildTagNetwork(): Promise<Map<string, TagData>> {
        this.tagData.clear();
        const allFiles = this.app.vault.getMarkdownFiles();
        
        // First pass: count tag frequencies
        for (const file of allFiles) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                const tags = TagUtils.getExistingTags(cache.frontmatter);
                
                // Update tag frequency
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
                
                // Update tag connections (tags that appear together)
                for (let i = 0; i < tags.length; i++) {
                    for (let j = i + 1; j < tags.length; j++) {
                        const tag1 = tags[i];
                        const tag2 = tags[j];
                        
                        // Update connection for tag1
                        const tagInfo1 = this.tagData.get(tag1)!;
                        if (!tagInfo1.connections.has(tag2)) {
                            tagInfo1.connections.set(tag2, 0);
                        }
                        tagInfo1.connections.set(tag2, tagInfo1.connections.get(tag2)! + 1);
                        
                        // Update connection for tag2
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
    
    /**
     * Get network data in a format suitable for visualization
     */
    getNetworkData(): { nodes: any[], edges: any[] } {
        const nodes: any[] = [];
        const edges: any[] = [];
        const edgeSet = new Set<string>(); // To avoid duplicate edges
        
        // Create nodes
        this.tagData.forEach((data) => {
            nodes.push({
                id: data.tag,
                label: data.tag.startsWith('#') ? data.tag.substring(1) : data.tag,
                size: Math.max(5, Math.min(30, 5 + data.frequency * 3)), // Scale node size between 5 and 30
                frequency: data.frequency
            });
            
            // Create edges
            data.connections.forEach((weight, connectedTag) => {
                // Create a unique ID for the edge to avoid duplicates
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
    private networkData: { nodes: any[], edges: any[] };
    
    constructor(app: App, networkData: { nodes: any[], edges: any[] }) {
        super(app);
        this.networkData = networkData;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tag-network-view');
        
        // Add title
        contentEl.createEl('h2', { text: 'Tag Network Visualization' });
        
        // Add description
        const description = contentEl.createEl('p', { 
            text: 'Node size represents tag frequency. Connections represent tags that appear together in notes.' 
        });
        description.style.marginBottom = '20px';
        
        // Add controls
        const controlsContainer = contentEl.createDiv({ cls: 'tag-network-controls' });
        
        // Add search input
        const searchContainer = controlsContainer.createDiv();
        searchContainer.createEl('span', { text: 'Search tags: ' });
        const searchInput = searchContainer.createEl('input', { 
            type: 'text',
            placeholder: 'Type to search...'
        });
        
        // Add legend
        const legendContainer = contentEl.createDiv({ cls: 'tag-network-legend' });
        legendContainer.createEl('span', { text: 'Frequency: ' });
        
        // Create legend items
        const lowFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        const lowFreqColor = lowFreqItem.createDiv({ cls: 'tag-network-legend-color' });
        lowFreqColor.style.backgroundColor = 'rgb(100, 149, 237)';
        lowFreqItem.createEl('span', { text: 'Low' });
        
        const mediumFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        const mediumFreqColor = mediumFreqItem.createDiv({ cls: 'tag-network-legend-color' });
        mediumFreqColor.style.backgroundColor = 'rgb(50, 99, 212)';
        mediumFreqItem.createEl('span', { text: 'Medium' });
        
        const highFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        const highFreqColor = highFreqItem.createDiv({ cls: 'tag-network-legend-color' });
        highFreqColor.style.backgroundColor = 'rgb(0, 49, 187)';
        highFreqItem.createEl('span', { text: 'High' });
        
        // Create container for the network visualization
        const container = contentEl.createDiv({ cls: 'tag-network-container' });
        
        // Set explicit dimensions for the container
        container.style.width = '100%';
        container.style.height = '500px';
        container.style.position = 'relative';
        container.style.backgroundColor = 'var(--background-secondary)';
        container.style.borderRadius = 'var(--radius-m)';
        container.style.marginBottom = '20px';
        
        // Create tooltip element
        const tooltip = contentEl.createDiv({ cls: 'tag-tooltip' });
        tooltip.style.display = 'none';
        tooltip.createDiv({ cls: 'tag-tooltip-content' });
        
        // Add a status message to show loading or errors
        const statusEl = contentEl.createDiv({ cls: 'tag-network-status' });
        statusEl.setText('Loading visualization...');
        
        // Check if we have data to display
        if (this.networkData.nodes.length === 0) {
            statusEl.setText('No tags found in your vault. Add some tags to your notes first!');
            return;
        }
        
        // Load the visualization library and render the network
        try {
            this.loadVisualizationLibrary(container, searchInput, tooltip, statusEl);
        } catch (error) {
            console.error('Error loading visualization libraries:', error);
            statusEl.setText('Error loading visualization. Check console for details.');
        }
    }
    
    private loadVisualizationLibrary(container: HTMLElement, searchInput: HTMLInputElement, tooltip: HTMLElement, statusEl: HTMLElement) {
        // Instead of loading from CDN, we'll use a simpler approach with D3.js
        // Load D3.js from CDN (more widely supported in Obsidian)
        const script = document.createElement('script');
        script.src = 'https://d3js.org/d3.v7.min.js';
        script.onerror = () => {
            console.error('Failed to load D3.js');
            statusEl.setText('Failed to load visualization library. Check console for details.');
        };
        script.onload = () => {
            try {
                this.renderD3Network(container, searchInput, tooltip, statusEl);
            } catch (error) {
                console.error('Error rendering network:', error);
                statusEl.setText('Error rendering network. Check console for details.');
            }
        };
        document.head.appendChild(script);
    }
    
    private renderD3Network(container: HTMLElement, searchInput: HTMLInputElement, tooltip: HTMLElement, statusEl: HTMLElement) {
        // @ts-ignore - D3 is loaded dynamically
        const d3 = window.d3;
        if (!d3) {
            statusEl.setText('Error: D3.js library not loaded');
            return;
        }
        
        statusEl.setText('Rendering network...');
        
        // Clear the container
        container.empty();
        
        // Set up the SVG
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        const svg = d3.select(container).append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height])
            .attr('style', 'max-width: 100%; height: auto;');
        
        // Create a group for the graph
        const g = svg.append('g');
        
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', (event: any) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Prepare the data
        const nodes = this.networkData.nodes.map(node => ({
            id: node.id,
            label: node.label,
            size: node.size,
            frequency: node.frequency
        }));
        
        const links = this.networkData.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            weight: edge.weight
        }));
        
        // Create a force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius((d: any) => d.size + 5));
        
        // Create the links
        const link = g.append('g')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke-width', (d: any) => Math.sqrt(d.weight));
        
        // Create the nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', (d: any) => d.size)
            .attr('fill', (d: any) => this.getNodeColor(d.frequency))
            .call(this.drag(simulation));
        
        // Add labels to nodes
        const labels = g.append('g')
            .selectAll('text')
            .data(nodes)
            .join('text')
            .text((d: any) => d.label)
            .attr('font-size', 12)
            .attr('dx', (d: any) => d.size + 5)
            .attr('dy', 4)
            .attr('fill', '#333');
        
        // Add tooltip behavior
        node.on('mouseover', (event: any, d: any) => {
            // Highlight the node and its connections
            node.attr('opacity', (n: any) => {
                const isConnected = links.some((link: any) => 
                    (link.source.id === d.id && link.target.id === n.id) || 
                    (link.target.id === d.id && link.source.id === n.id)
                );
                return n === d || isConnected ? 1 : 0.2;
            });
            
            link.attr('stroke-opacity', (l: any) => 
                l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
            );
            
            // Show tooltip
            tooltip.style.display = 'block';
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
        });
        
        node.on('mouseout', () => {
            // Reset opacity
            node.attr('opacity', 1);
            link.attr('stroke-opacity', 0.6);
            
            // Hide tooltip
            tooltip.style.display = 'none';
        });
        
        // Add search functionality
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            
            if (searchTerm.length > 0) {
                node.attr('opacity', (d: any) => 
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
        });
        
        // Update positions on each tick of the simulation
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
        
        // Hide the status message
        statusEl.style.display = 'none';
    }
    
    // Drag behavior for D3
    private drag(simulation: any) {
        // @ts-ignore - D3 is loaded dynamically
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
        // Color scale from light blue to dark blue based on frequency
        const minFreq = 1;
        const maxFreq = Math.max(...this.networkData.nodes.map(n => n.frequency));
        const normalizedFreq = (frequency - minFreq) / (maxFreq - minFreq);
        
        // Generate color from light blue to dark blue
        const r = Math.floor(100 - normalizedFreq * 100);
        const g = Math.floor(149 - normalizedFreq * 100);
        const b = Math.floor(237 - normalizedFreq * 50);
        
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
