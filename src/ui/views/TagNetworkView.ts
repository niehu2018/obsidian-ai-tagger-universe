import { App, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { NetworkData, NetworkNode, NetworkEdge, TagNetworkManager } from '../../utils/tagNetworkUtils';
import { Translations } from '../../i18n/types';

export const TAG_NETWORK_VIEW_TYPE = 'tag-network-view';

declare global {
    interface Window {
        d3: any;
    }
}

interface ForceSettings {
    repulsion: number;
    linkDistance: number;
}

export class TagNetworkView extends ItemView {
    private networkData: NetworkData;
    private cleanup: (() => void)[] = [];
    private d3LoadPromise: Promise<void> | null = null;
    private simulation: any = null;
    private forceSettings: ForceSettings = { repulsion: -300, linkDistance: 100 };
    private tagNetworkManager: TagNetworkManager;
    private t: Translations;

    constructor(leaf: WorkspaceLeaf, data: NetworkData, app: App, t: Translations) {
        super(leaf);
        this.networkData = data;
        this.tagNetworkManager = new TagNetworkManager(app);
        this.t = t;
    }

    getViewType(): string {
        return TAG_NETWORK_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.t.tagNetwork.title;
    }

    getIcon(): string {
        return 'git-graph';
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tag-network-view');

        contentEl.createEl('h2', { text: this.t.tagNetwork.title });
        contentEl.createEl('p', { text: this.t.tagNetwork.description });

        const controlsContainer = contentEl.createDiv({ cls: 'tag-network-controls' });

        // Search control
        const searchContainer = controlsContainer.createDiv({ cls: 'tag-network-search' });
        searchContainer.createEl('span', { text: 'Search: ' });
        const searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: this.t.tagNetwork.searchPlaceholder,
            cls: 'tag-network-search-input'
        });

        // Force settings controls
        const forceControlsContainer = controlsContainer.createDiv({ cls: 'tag-network-force-controls' });

        // Repulsion slider
        const repulsionContainer = forceControlsContainer.createDiv({ cls: 'tag-network-slider-container' });
        repulsionContainer.createEl('label', { text: `${this.t.tagNetwork.repulsionStrength}: ` });
        const repulsionValue = repulsionContainer.createEl('span', { text: '300', cls: 'tag-network-slider-value' });
        const repulsionSlider = repulsionContainer.createEl('input', {
            type: 'range',
            cls: 'tag-network-slider'
        });
        repulsionSlider.min = '50';
        repulsionSlider.max = '800';
        repulsionSlider.value = '300';

        // Link distance slider
        const linkDistanceContainer = forceControlsContainer.createDiv({ cls: 'tag-network-slider-container' });
        linkDistanceContainer.createEl('label', { text: `${this.t.tagNetwork.linkDistance}: ` });
        const linkDistanceValue = linkDistanceContainer.createEl('span', { text: '100', cls: 'tag-network-slider-value' });
        const linkDistanceSlider = linkDistanceContainer.createEl('input', {
            type: 'range',
            cls: 'tag-network-slider'
        });
        linkDistanceSlider.min = '30';
        linkDistanceSlider.max = '300';
        linkDistanceSlider.value = '100';

        // Refresh button
        const refreshBtn = forceControlsContainer.createEl('button', {
            text: this.t.tagNetwork.refresh,
            cls: 'tag-network-refresh-btn'
        });

        const legendContainer = contentEl.createDiv({ cls: 'tag-network-legend' });
        legendContainer.createEl('span', { text: 'Frequency: ' });

        const lowFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        lowFreqItem.createDiv({ cls: 'tag-network-legend-color low' });
        lowFreqItem.createEl('span', { text: this.t.tagNetwork.frequencyLow });

        const mediumFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        mediumFreqItem.createDiv({ cls: 'tag-network-legend-color medium' });
        mediumFreqItem.createEl('span', { text: this.t.tagNetwork.frequencyMedium });

        const highFreqItem = legendContainer.createDiv({ cls: 'tag-network-legend-item' });
        highFreqItem.createDiv({ cls: 'tag-network-legend-color high' });
        highFreqItem.createEl('span', { text: this.t.tagNetwork.frequencyHigh });

        // Hint for click functionality
        const hintContainer = contentEl.createDiv({ cls: 'tag-network-hint' });
        hintContainer.createEl('span', { text: this.t.tagNetwork.clickToShowDocs });

        const container = contentEl.createDiv({ cls: 'tag-network-container' });

        const tooltip = contentEl.createDiv({ cls: 'tag-tooltip' });
        tooltip.addClass('tag-tooltip-hidden');
        tooltip.createDiv({ cls: 'tag-tooltip-content' });

        // Document list panel (hidden by default)
        const docPanel = contentEl.createDiv({ cls: 'tag-network-doc-panel tag-network-doc-panel-hidden' });
        const docPanelHeader = docPanel.createDiv({ cls: 'tag-network-doc-panel-header' });
        docPanelHeader.createEl('span', { cls: 'tag-network-doc-panel-title' });
        const closeBtn = docPanelHeader.createEl('button', { text: '×', cls: 'tag-network-doc-panel-close' });
        const docList = docPanel.createDiv({ cls: 'tag-network-doc-list' });

        closeBtn.addEventListener('click', () => {
            docPanel.addClass('tag-network-doc-panel-hidden');
        });

        const statusEl = contentEl.createDiv({ cls: 'tag-network-status' });
        statusEl.setText('Loading visualization...');

        if (this.networkData.nodes.length === 0) {
            statusEl.setText('No tags found in your vault. Add some tags first!');
            return;
        }

        // Slider event handlers
        const handleRepulsionChange = () => {
            const value = parseInt(repulsionSlider.value);
            repulsionValue.setText(String(value));
            this.forceSettings.repulsion = -value;
            this.updateForceSettings();
        };

        const handleLinkDistanceChange = () => {
            const value = parseInt(linkDistanceSlider.value);
            linkDistanceValue.setText(String(value));
            this.forceSettings.linkDistance = value;
            this.updateForceSettings();
        };

        repulsionSlider.addEventListener('input', handleRepulsionChange);
        linkDistanceSlider.addEventListener('input', handleLinkDistanceChange);
        this.cleanup.push(() => {
            repulsionSlider.removeEventListener('input', handleRepulsionChange);
            linkDistanceSlider.removeEventListener('input', handleLinkDistanceChange);
        });

        // Refresh button handler
        const handleRefresh = async () => {
            statusEl.style.display = 'block';
            statusEl.setText('Refreshing...');
            await this.refreshNetworkData();
            try {
                await this.loadVisualizationLibrary(container, searchInput, tooltip, statusEl, docPanel, docList);
            } catch (error) {
                statusEl.setText('Error refreshing visualization.');
            }
        };
        refreshBtn.addEventListener('click', handleRefresh);
        this.cleanup.push(() => refreshBtn.removeEventListener('click', handleRefresh));

        // Register metadata cache listener for real-time updates
        const metadataCacheHandler = this.app.metadataCache.on('changed', async () => {
            try {
                await this.refreshNetworkData();
                if (this.simulation) {
                    this.simulation.alpha(0.3).restart();
                }
            } catch (error) {
                console.error('Error refreshing tag network:', error);
            }
        });
        this.cleanup.push(() => this.app.metadataCache.offref(metadataCacheHandler));

        try {
            await this.loadVisualizationLibrary(container, searchInput, tooltip, statusEl, docPanel, docList);
        } catch (error) {
            statusEl.setText('Error loading visualization. Please try again.');
        }
    }

    async onClose(): Promise<void> {
        this.cleanup.forEach(cleanup => cleanup());
        this.cleanup = [];
        this.simulation = null;
        const d3Script = document.querySelector('script[src*="d3.v7.min.js"]');
        if (d3Script) {
            d3Script.remove();
        }
        this.contentEl.empty();
    }

    public async onResize(): Promise<void> {
        const container = this.contentEl.querySelector('.tag-network-container') as HTMLElement;
        const searchInput = this.contentEl.querySelector('.tag-network-search-input') as HTMLInputElement;
        const tooltip = this.contentEl.querySelector('.tag-tooltip') as HTMLElement;
        const statusEl = this.contentEl.querySelector('.tag-network-status') as HTMLElement;
        const docPanel = this.contentEl.querySelector('.tag-network-doc-panel') as HTMLElement;
        const docList = this.contentEl.querySelector('.tag-network-doc-list') as HTMLElement;

        if (container && searchInput && tooltip && statusEl && docPanel && docList) {
            try {
                await this.loadVisualizationLibrary(container, searchInput, tooltip, statusEl, docPanel, docList);
            } catch (error) {
                // Silent fail on resize
            }
        }
    }

    private async refreshNetworkData(): Promise<void> {
        await this.tagNetworkManager.buildTagNetwork();
        this.networkData = this.tagNetworkManager.getNetworkData();
    }

    private updateForceSettings(): void {
        if (!this.simulation) return;

        const d3 = window.d3;
        if (!d3) return;

        this.simulation
            .force('charge', d3.forceManyBody().strength(this.forceSettings.repulsion))
            .force('link').distance(this.forceSettings.linkDistance);

        this.simulation.alpha(0.5).restart();
    }

    private getDocumentsWithTag(tagName: string): TFile[] {
        const files = this.app.vault.getMarkdownFiles();
        const docs: TFile[] = [];

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.tags) {
                const tags = Array.isArray(cache.frontmatter.tags)
                    ? cache.frontmatter.tags
                    : [cache.frontmatter.tags];
                const normalizedTags = tags.map((t: string) =>
                    t.startsWith('#') ? t.substring(1).toLowerCase() : t.toLowerCase()
                );
                if (normalizedTags.includes(tagName.toLowerCase())) {
                    docs.push(file);
                }
            }
        }

        return docs;
    }

    private async loadVisualizationLibrary(container: HTMLElement, searchInput: HTMLInputElement, tooltip: HTMLElement, statusEl: HTMLElement, docPanel: HTMLElement, docList: HTMLElement) {
        if (this.d3LoadPromise) {
            await this.d3LoadPromise;
            return;
        }

        if (window.d3) {
            this.renderD3Network(container, searchInput, tooltip, statusEl, docPanel, docList);
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
                    this.renderD3Network(container, searchInput, tooltip, statusEl, docPanel, docList);
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

    private renderD3Network(container: HTMLElement, searchInput: HTMLInputElement, tooltip: HTMLElement, statusEl: HTMLElement, docPanel: HTMLElement, docList: HTMLElement) {
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

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id((d: NetworkNode) => d.id).distance(this.forceSettings.linkDistance))
            .force('charge', d3.forceManyBody().strength(this.forceSettings.repulsion))
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
            .call(this.drag(this.simulation));

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

            const tooltipContent = tooltip.querySelector('.tag-tooltip-content') as HTMLElement;
            if (tooltipContent) {
                const connectedNodes = links.filter((link: any) =>
                    link.source.id === d.id || link.target.id === d.id
                ).length;

                // Use safe DOM methods instead of innerHTML to prevent XSS
                tooltipContent.empty();
                const titleDiv = tooltipContent.createDiv({ cls: 'tag-tooltip-title' });
                titleDiv.textContent = d.label;
                const freqDiv = tooltipContent.createDiv({ cls: 'tag-tooltip-info' });
                freqDiv.textContent = `Frequency: ${d.frequency}`;
                const connDiv = tooltipContent.createDiv({ cls: 'tag-tooltip-info' });
                connDiv.textContent = `Connected to ${connectedNodes} other tags`;
            }
        };

        const handleMouseOut = () => {
            node.attr('opacity', 1);
            link.attr('stroke-opacity', 0.6);
            tooltip.removeClass('visible');
        };

        // Click handler to show documents
        const handleClick = (event: MouseEvent, d: NetworkNode) => {
            event.stopPropagation();
            const docs = this.getDocumentsWithTag(d.label);

            const titleEl = docPanel.querySelector('.tag-network-doc-panel-title') as HTMLElement;
            if (titleEl) {
                titleEl.setText(`${this.t.tagNetwork.documentsWithTag}: ${d.label} (${docs.length})`);
            }

            docList.empty();
            if (docs.length === 0) {
                docList.createEl('div', { text: this.t.tagNetwork.noDocuments, cls: 'tag-network-doc-empty' });
            } else {
                for (const doc of docs) {
                    const docItem = docList.createEl('div', { cls: 'tag-network-doc-item' });
                    docItem.createEl('span', { text: doc.basename });
                    docItem.addEventListener('click', () => {
                        this.app.workspace.openLinkText(doc.path, '', false);
                    });
                }
            }

            docPanel.removeClass('tag-network-doc-panel-hidden');
        };

        node.on('mouseover', handleMouseOver)
            .on('mouseout', handleMouseOut)
            .on('click', handleClick);

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

        this.simulation.on('tick', () => {
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

        this.cleanup.push(() => {
            if (this.simulation) {
                this.simulation.stop();
            }
        });
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
}
