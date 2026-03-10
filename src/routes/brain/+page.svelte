<script lang="ts">
    import JSONTree from '$lib/components/json-tree/json-tree.svelte';
    import { onMount } from 'svelte';
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { AlertCircle, Brain, Database, FileText, Info, Search, ArrowUpDown, ArrowUp, ArrowDown, Network, Fingerprint, Zap, ChevronLeft, ChevronRight } from "lucide-svelte";
    import type { PageData as BrainData } from "./$types";
    
    let { data } = $props() as { data: BrainData };
    
    let activeTab = $state<'facts' | 'summaries' | 'topology' | 'map' | 'about'>('facts');
    
    // Pagination state (synced with URL)
    let currentPage = $state(data.page || 1);
    const pageSize = data.pageSize || 50;

    function goToTab(tab: 'facts' | 'summaries' | 'topology' | 'map' | 'about') {
        activeTab = tab;
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState({}, '', url.toString());
    }

    function goToPage(page: number) {
        const url = new URL(window.location.href);
        url.searchParams.set('page', page.toString());
        url.searchParams.set('pageSize', pageSize.toString());
        window.location.href = url.toString();
    }

    const sortOptions = [
        { label: 'Content', value: 'content' },
        { label: 'Category', value: 'metadata.category' },
        { label: 'Confidence', value: 'metadata.confidence' },
        { label: 'Access Count', value: 'metadata.access_count' },
        { label: 'Topology Source', value: 'metadata.topology_source' },
        { label: 'Source Labels', value: 'metadata.source_turn_labels' }
    ];

    function getSortValue(item: any, path: string) {
        if (path === 'content') return item.content || '';
        if (path.startsWith('metadata.')) {
            const key = path.split('.')[1];
            
            // Special handling for source turn labels
            if (key === 'source_turn_labels') {
                // Check if labels already exists in metadata directly (unlikely based on context)
                if (item.metadata?.[key]) return item.metadata[key];
                
                // Try source_turn
                const sourceTurn = item.metadata?.['source_turn'];
                if (sourceTurn) {
                    try {
                        const parsed = JSON.parse(sourceTurn);
                        if (parsed.labels) return parsed.labels.join(', ');
                    } catch (e) {
                        // Not JSON, or no labels
                    }
                }

                // Try source_turns (plural as requested)
                const sourceTurns = item.metadata?.['source_turns'];
                if (sourceTurns) {
                    try {
                        const parsed = JSON.parse(sourceTurns);
                        // If it's an array of turns, collect all labels
                        if (Array.isArray(parsed)) {
                            const labels = parsed.flatMap(t => t.labels || []);
                            return [...new Set(labels)].join(', ');
                        } else if (parsed.labels) {
                            return parsed.labels.join(', ');
                        }
                    } catch (e) {
                        // Not JSON, or no labels
                    }
                }
                return '';
            }
            
            return item.metadata?.[key] || '';
        }
        return '';
    }

    function compareValues(a: any, b: any) {
        const valA = getSortValue(a, sortBy);
        const valB = getSortValue(b, sortBy);

        // Numeric sorting for confidence, access_count, and topology_source
        if (sortBy === 'metadata.confidence' || sortBy === 'metadata.access_count' || sortBy === 'metadata.topology_source') {
            const numA = parseFloat(valA) || 0;
            const numB = parseFloat(valB) || 0;
            return sortOrder === 'asc' ? numA - numB : numB - numA;
        }

        // String sorting for others
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        
        if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
        if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    }

    $effect(() => {
        // Automatically set descending order for high-value priority fields when they are selected
        if (['metadata.confidence', 'metadata.access_count', 'metadata.topology_source'].includes(sortBy)) {
            sortOrder = 'desc';
        }
    });

    $effect(() => {
        // Reset pagination when filter or tab changes
        const _tab = activeTab;
        const _query = searchQuery;
        const _category = selectedCategory;
        const _sortBy = sortBy;
        const _sortOrder = sortOrder;
        currentPage = 1;
    });

    let searchQuery = $state("");
    let sessionFilter = $state("");
    let sortBy = $state<string>("content");
    let sortOrder = $state<'asc' | 'desc'>('asc');
    let selectedCategory = $state<string>("all");
    let selectedNodeId = $state<string | null>(null);

    onMount(() => {
        // Check if we should switch to a specific tab from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab') as 'facts' | 'summaries' | 'topology' | 'map' | 'about' | null;
        if (tab && ['facts', 'summaries', 'topology', 'map', 'about'].includes(tab)) {
            activeTab = tab;
        }

        // Check if we should switch to topology tab for this session
        const sessionId = urlParams.get('session_id');
        if (sessionId) {
            sessionFilter = sessionId;
            activeTab = 'topology';
        }
    });

    let allCategories = $derived.by(() => {
        const categories = new Set<string>();
        data.facts.forEach(f => {
            if (f.metadata?.category) categories.add(f.metadata.category);
        });
        data.summaries.forEach(s => {
            if (s.metadata?.category) categories.add(s.metadata.category);
        });
        return ["all", ...Array.from(categories).sort()];
    });

    let filteredFacts = $derived(
        data.facts
            .filter(f => {
                const matchesSearch = f.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    Object.values(f.metadata || {}).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()));
                
                const matchesCategory = selectedCategory === "all" || f.metadata?.category === selectedCategory;
                
                return matchesSearch && matchesCategory;
            })
            .sort(compareValues)
    );

    let filteredSummaries = $derived(
        data.summaries
            .filter(s => {
                const matchesSearch = s.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    Object.values(s.metadata || {}).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()));
                
                const matchesCategory = selectedCategory === "all" || s.metadata?.category === selectedCategory;
                
                return matchesSearch && matchesCategory;
            })
            .sort(compareValues)
    );

    let paginatedFacts = $derived(
        filteredFacts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    );
    let paginatedSummaries = $derived(
        filteredSummaries.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    );

    let totalPages = $derived(
        activeTab === 'facts' 
            ? Math.ceil(filteredFacts.length / pageSize) 
            : Math.ceil(filteredSummaries.length / pageSize)
    );

    let relatedNodes = $derived.by(() => {
        if (!selectedNodeId || !data.topology) return null;
        
        const node = data.topology.nodes.find(n => n.id === selectedNodeId);
        if (!node) return null;

        // Find incoming and outgoing edges for this node
        const outgoing = data.topology.edges.filter(e => e.from === selectedNodeId);
        const incoming = data.topology.edges.filter(e => e.to === selectedNodeId);

        return {
            node,
            evidence: [
                ...incoming.filter(e => e.bond === 'E').map(e => ({ node: data.topology.nodes.find(n => n.id === e.from), edge: e })),
                ...outgoing.filter(e => e.bond === 'E').map(e => ({ node: data.topology.nodes.find(n => n.id === e.to), edge: e }))
            ].filter(r => r.node),
            deducements: [
                ...incoming.filter(e => e.bond === 'D').map(e => ({ node: data.topology.nodes.find(n => n.id === e.from), edge: e })),
                ...outgoing.filter(e => e.bond === 'D').map(e => ({ node: data.topology.nodes.find(n => n.id === e.to), edge: e }))
            ].filter(r => r.node),
            refinements: [
                ...incoming.filter(e => e.bond === 'R').map(e => ({ node: data.topology.nodes.find(n => n.id === e.from), edge: e })),
                ...outgoing.filter(e => e.bond === 'R').map(e => ({ node: data.topology.nodes.find(n => n.id === e.to), edge: e }))
            ].filter(r => r.node)
        };
    });

    function tryParseJson(str: string | undefined) {
        if (!str) return null;
        
        let target = str.trim();
        
        // Handle Markdown-wrapped JSON (e.g., ```json ... ```)
        if (target.startsWith('```')) {
            const lines = target.split('\n');
            const firstLine = lines[0].toLowerCase();
            
            // If it starts with ```json or just ```
            if (firstLine.startsWith('```json') || firstLine === '```') {
                // Find the index of the last line starting with ```
                const lastLineIndex = lines.findLastIndex(line => line.trim() === '```');
                if (lastLineIndex > 0) {
                    target = lines.slice(1, lastLineIndex).join('\n').trim();
                }
            }
        }
        
        try {
            const parsed = JSON.parse(target);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch (e) {
            // If failed, try to find the first '{' and last '}'
            const start = target.indexOf('{');
            const end = target.lastIndexOf('}');
            
            if (start !== -1 && end !== -1 && end > start) {
                try {
                    const parsed = JSON.parse(target.substring(start, end + 1));
                    if (typeof parsed === 'object' && parsed !== null) return parsed;
                } catch (innerE) {}
            }

            // Same for arrays
            const arrStart = target.indexOf('[');
            const arrEnd = target.lastIndexOf(']');
            if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
                try {
                    const parsed = JSON.parse(target.substring(arrStart, arrEnd + 1));
                    if (typeof parsed === 'object' && parsed !== null) return parsed;
                } catch (innerE) {}
            }
        }
        return null;
    }

    function handleRefresh() {
        // Clear session ID and page from URL to get a clean refresh of everything
        // But keep the tab
        const url = new URL(window.location.href);
        const currentTab = url.searchParams.get('tab');
        url.searchParams.delete('page');
        url.searchParams.delete('session_id');
        if (currentTab) url.searchParams.set('tab', currentTab);
        window.location.href = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
    }
</script>

<div class="container mx-auto py-8 px-4">
    <header class="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <div class="flex items-center gap-2 mb-1">
                <Brain class="h-8 w-8 text-primary" />
                <h1 class="text-4xl font-bold tracking-tight">Brain</h1>
            </div>
            <p class="text-muted-foreground">Visualize facts and summaries stored in Miri's long-term memory.</p>
        </div>
        
        <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" onclick={handleRefresh}>Refresh</Button>
        </div>
    </header>

    {#if data.error}
        <Card.Root class="border-destructive/50 bg-destructive/5 mb-8">
            <Card.Header>
                <Card.Title class="flex items-center gap-2 text-destructive">
                    <AlertCircle class="h-5 w-5" />
                    Connection Error
                </Card.Title>
                <Card.Description>
                    Failed to fetch brain data from the Miri server.
                </Card.Description>
            </Card.Header>
            <Card.Content>
                <p class="text-sm font-mono bg-destructive/10 p-2 rounded">{data.error}</p>
            </Card.Content>
        </Card.Root>
    {/if}

    <div class="flex flex-col gap-6">
        <div class="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/30 p-4 rounded-xl border">
            <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <div class="flex gap-1 bg-background p-1 rounded-lg border shadow-sm">
                    <button 
                        class="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2
                        {activeTab === 'facts' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}"
                        onclick={() => goToTab('facts')}
                    >
                        <Database class="h-4 w-4" />
                        Facts
                        <Badge variant={activeTab === 'facts' ? 'secondary' : 'outline'} class="ml-1 px-1.5 py-0 text-[10px]">
                            {data.totalFacts}
                        </Badge>
                    </button>
                    <button 
                        class="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2
                        {activeTab === 'summaries' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}"
                        onclick={() => goToTab('summaries')}
                    >
                        <FileText class="h-4 w-4" />
                        Summaries
                        <Badge variant={activeTab === 'summaries' ? 'secondary' : 'outline'} class="ml-1 px-1.5 py-0 text-[10px]">
                            {data.totalSummaries}
                        </Badge>
                    </button>
                    <button 
                        class="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2
                        {activeTab === 'topology' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}"
                        onclick={() => goToTab('topology')}
                    >
                        <Network class="h-4 w-4" />
                        Topology
                        <Badge variant={activeTab === 'topology' ? 'secondary' : 'outline'} class="ml-1 px-1.5 py-0 text-[10px]">
                            {data.topology?.nodes?.length || 0}
                        </Badge>
                    </button>
                    <button 
                        class="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2
                        {activeTab === 'map' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}"
                        onclick={() => goToTab('map')}
                    >
                        <Brain class="h-4 w-4" />
                        Brain Map
                    </button>
                    <button 
                        class="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2
                        {activeTab === 'about' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}"
                        onclick={() => goToTab('about')}
                    >
                        <Info class="h-4 w-4" />
                        About
                    </button>
                </div>

                <div class="flex items-center gap-2 bg-background p-1 rounded-lg border shadow-sm px-2">
                    <span class="text-xs text-muted-foreground whitespace-nowrap">Filter:</span>
                    <select 
                        bind:value={selectedCategory} 
                        class="bg-transparent border-none text-xs focus:ring-0 cursor-pointer outline-none py-1 min-w-[80px]"
                    >
                        {#each allCategories as category}
                            <option value={category}>
                                {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                            </option>
                        {/each}
                    </select>
                </div>

                <div class="flex items-center gap-2 bg-background p-1 rounded-lg border shadow-sm px-2">
                    <span class="text-xs text-muted-foreground whitespace-nowrap">Sort by:</span>
                    <select 
                        bind:value={sortBy} 
                        class="bg-transparent border-none text-xs focus:ring-0 cursor-pointer outline-none py-1"
                    >
                        {#each sortOptions as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                    <button 
                        onclick={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
                        class="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                        title="Toggle sort order"
                    >
                        {#if sortOrder === 'asc'}
                            <ArrowUp class="h-3.5 w-3.5" />
                        {:else}
                            <ArrowDown class="h-3.5 w-3.5" />
                        {/if}
                    </button>
                </div>
            </div>

            <div class="relative w-full md:w-80">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                    type="text" 
                    placeholder="Search in {activeTab}..." 
                    class="w-full pl-9 pr-4 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    bind:value={searchQuery}
                />
            </div>
            
            {#if activeTab === 'topology'}
                <div class="relative w-full md:w-64">
                    <Fingerprint class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <form onsubmit={(e) => { e.preventDefault(); const url = new URL(window.location.href); if (sessionFilter) url.searchParams.set('session_id', sessionFilter); else url.searchParams.delete('session_id'); window.location.href = url.toString(); }}>
                        <input 
                            type="text" 
                            placeholder="Filter by Session ID..." 
                            class="w-full pl-9 pr-4 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            bind:value={sessionFilter}
                        />
                    </form>
                </div>
            {/if}
        </div>

        <div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {#if activeTab === 'facts'}
                {#each paginatedFacts as fact}
                    <Card.Root class="flex flex-col h-full hover:shadow-md transition-shadow">
                        <Card.Content class="p-4 flex-1">
                            <p class="text-sm leading-relaxed mb-4">{fact.content}</p>
                            
                            {#if fact.metadata && Object.keys(fact.metadata).length > 0}
                                <div class="flex flex-wrap gap-1.5 pt-3 border-t">
                                    {#each Object.entries(fact.metadata) as [key, value]}
                                        <Badge variant="secondary" class="text-[10px] px-1.5 py-0 font-normal">
                                            <span class="text-muted-foreground mr-1">{key}:</span> {value}
                                        </Badge>
                                    {/each}
                                </div>
                            {/if}
                        </Card.Content>
                    </Card.Root>
                {:else}
                    <div class="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                        <Info class="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p>No facts found matching your search.</p>
                    </div>
                {/each}
            {:else if activeTab === 'summaries'}
                {#each paginatedSummaries as summary}
                    <Card.Root class="flex flex-col h-full hover:shadow-md transition-shadow">
                        <Card.Content class="p-4 flex-1">
                            {@const jsonContent = tryParseJson(summary.content)}
                            {#if jsonContent}
                                <div class="bg-muted/30 p-2 rounded-md border text-xs overflow-auto max-h-[300px] mb-4">
                                    <JSONTree value={jsonContent} defaultExpandedLevel={2} />
                                </div>
                            {:else}
                                <p class="text-sm leading-relaxed mb-4 italic text-muted-foreground">"{summary.content}"</p>
                            {/if}
                            
                            {#if summary.metadata && Object.keys(summary.metadata).length > 0}
                                <div class="flex flex-wrap gap-1.5 pt-3 border-t">
                                    {#each Object.entries(summary.metadata) as [key, value]}
                                        <Badge variant="outline" class="text-[10px] px-1.5 py-0 font-normal bg-muted/50">
                                            <span class="text-muted-foreground mr-1">{key}:</span> {value}
                                        </Badge>
                                    {/each}
                                </div>
                            {/if}
                        </Card.Content>
                    </Card.Root>
                {:else}
                    <div class="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                        <Info class="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p>No summaries found matching your search.</p>
                    </div>
                {/each}
            {:else if activeTab === 'topology'}
                {#if data.topology && data.topology.nodes && data.topology.nodes.length > 0}
                    <div class="col-span-full space-y-6">
                        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {#each data.topology.nodes as node}
                                <Card.Root class="border-l-4 border-l-primary/50 relative overflow-hidden group">
                                    <div class="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                                        {#if node.meta?.type === 'fact'}
                                            <Database class="h-8 w-8" />
                                        {:else if node.meta?.type === 'summary'}
                                            <FileText class="h-8 w-8" />
                                        {:else}
                                            <Zap class="h-8 w-8" />
                                        {/if}
                                    </div>
                                    <Card.Header class="pb-2">
                                        <div class="flex items-center justify-between gap-2">
                                            <Badge variant="outline" class="font-mono text-[10px] uppercase truncate max-w-[150px]">
                                                {node.id}
                                            </Badge>
                                            {#if node.meta?.type}
                                                <Badge class="text-[9px] uppercase px-1 py-0 h-4">
                                                    {String(node.meta.type)}
                                                </Badge>
                                            {/if}
                                        </div>
                                    </Card.Header>
                                    <Card.Content>
                                        <p class="text-sm leading-relaxed">{node.content}</p>
                                        {#if node.meta && Object.keys(node.meta).length > 1}
                                            <div class="mt-3 flex flex-wrap gap-1">
                                                {#each Object.entries(node.meta) as [key, value]}
                                                    {#if key !== 'type' && value !== null}
                                                        <Badge variant="secondary" class="text-[9px] font-normal px-1 py-0">
                                                            <span class="opacity-50 mr-1">{key}:</span> {String(value)}
                                                        </Badge>
                                                    {/if}
                                                {/each}
                                            </div>
                                        {/if}
                                    </Card.Content>
                                </Card.Root>
                            {/each}
                        </div>

                        {#if data.topology.edges && data.topology.edges.length > 0}
                            <div class="mt-8">
                                <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Zap class="h-4 w-4 text-primary" />
                                    Reasoning Bonds
                                </h3>
                                <div class="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                    {#each data.topology.edges as edge}
                                        <div class="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border text-[11px]">
                                            <span class="font-mono text-primary truncate max-w-[80px]" title={edge.from}>{edge.from?.split('-').pop()}</span>
                                            <div class="flex-1 border-t-2 border-dashed border-muted-foreground/30 relative flex justify-center">
                                                <Badge variant="outline" class="absolute -top-2.5 px-1 py-0 h-4 text-[9px] bg-background">
                                                    {edge.bond === 'D' ? 'Deduce' : edge.bond === 'R' ? 'Refine' : edge.bond === 'E' ? 'Evidence' : edge.bond}
                                                </Badge>
                                            </div>
                                            <span class="font-mono text-primary truncate max-w-[80px]" title={edge.to}>{edge.to?.split('-').pop()}</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                        <Network class="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p>No topology data available.</p>
                    </div>
                {/if}
            {:else if activeTab === 'map'}
                <div class="col-span-full flex flex-col items-center py-10 text-center">
                    <Brain class="h-16 w-16 text-primary mb-4 animate-pulse" />
                    <h2 class="text-2xl font-bold mb-2">Integrated Brain Map</h2>
                    <p class="text-muted-foreground max-w-md mb-8">
                        Visualizing the relationships between Factual Memories, Summaries, and Reasoning Chains.
                    </p>

                    {#if data.topology && data.topology.nodes && data.topology.nodes.length > 0}
                        <div class="w-full max-w-6xl space-y-12">
                            <!-- Node Detail / Focused View -->
                            {#if selectedNodeId && relatedNodes}
                                <div class="bg-card border-2 border-primary/20 rounded-2xl p-6 shadow-xl relative overflow-hidden text-left animate-in fade-in zoom-in duration-300">
                                    <div class="absolute top-0 right-0 p-4">
                                        <Button variant="ghost" size="sm" onclick={() => selectedNodeId = null}>✕ Close</Button>
                                    </div>
                                    
                                    <div class="flex items-center gap-2 mb-4">
                                        <Badge class="bg-primary/10 text-primary border-primary/20">Selected Node</Badge>
                                        <span class="text-xs font-mono opacity-50">#{selectedNodeId.split('-').pop()}</span>
                                    </div>
                                    
                                    <h3 class="text-xl font-semibold mb-6 pr-20">{relatedNodes.node.content}</h3>
                                    
                                    <div class="grid gap-6 md:grid-cols-3">
                                        <!-- Evidence Section -->
                                        <div class="space-y-3">
                                            <div class="flex items-center gap-2 text-blue-600 font-bold uppercase text-[10px] tracking-wider border-b border-blue-100 pb-2">
                                                <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                                Evidence ({relatedNodes.evidence.length})
                                            </div>
                                            {#each relatedNodes.evidence as rel}
                                                <button 
                                                    class="w-full text-left p-3 rounded-lg bg-blue-500/5 border border-blue-100 hover:border-blue-300 transition-all group"
                                                    onclick={() => selectedNodeId = rel.node.id}
                                                >
                                                    <p class="text-xs line-clamp-3 group-hover:line-clamp-none transition-all">{rel.node.content}</p>
                                                    <div class="mt-2 flex items-center justify-between">
                                                        <span class="text-[9px] font-mono opacity-50">#{rel.node.id.split('-').pop()}</span>
                                                        {#if rel.edge.from === selectedNodeId}
                                                            <ArrowDown class="h-3 w-3 opacity-30 group-hover:translate-y-0.5 transition-transform" />
                                                        {:else}
                                                            <ArrowUp class="h-3 w-3 opacity-30 group-hover:-translate-y-0.5 transition-transform" />
                                                        {/if}
                                                    </div>
                                                </button>
                                            {:else}
                                                <p class="text-xs text-muted-foreground italic">No evidence linked.</p>
                                            {/each}
                                        </div>

                                        <!-- Deducement Section -->
                                        <div class="space-y-3">
                                            <div class="flex items-center gap-2 text-purple-600 font-bold uppercase text-[10px] tracking-wider border-b border-purple-100 pb-2">
                                                <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-purple-500"></div>
                                                Deducements ({relatedNodes.deducements.length})
                                            </div>
                                            {#each relatedNodes.deducements as rel}
                                                <button 
                                                    class="w-full text-left p-3 rounded-lg bg-purple-500/5 border border-purple-100 hover:border-purple-300 transition-all group"
                                                    onclick={() => selectedNodeId = rel.node.id}
                                                >
                                                    <p class="text-xs line-clamp-3 group-hover:line-clamp-none transition-all">{rel.node.content}</p>
                                                    <div class="mt-2 flex items-center justify-between">
                                                        <span class="text-[9px] font-mono opacity-50">#{rel.node.id.split('-').pop()}</span>
                                                        {#if rel.edge.from === selectedNodeId}
                                                            <ArrowDown class="h-3 w-3 opacity-30 group-hover:translate-y-0.5 transition-transform" />
                                                        {:else}
                                                            <ArrowUp class="h-3 w-3 opacity-30 group-hover:-translate-y-0.5 transition-transform" />
                                                        {/if}
                                                    </div>
                                                </button>
                                            {:else}
                                                <p class="text-xs text-muted-foreground italic">No deducements linked.</p>
                                            {/each}
                                        </div>

                                        <!-- Refinement Section -->
                                        <div class="space-y-3">
                                            <div class="flex items-center gap-2 text-amber-600 font-bold uppercase text-[10px] tracking-wider border-b border-amber-100 pb-2">
                                                <div class="w-2 h-2 bg-amber-500 rotate-45"></div>
                                                Refinements ({relatedNodes.refinements.length})
                                            </div>
                                            {#each relatedNodes.refinements as rel}
                                                <button 
                                                    class="w-full text-left p-3 rounded-lg bg-amber-500/5 border border-amber-100 hover:border-amber-300 transition-all group"
                                                    onclick={() => selectedNodeId = rel.node.id}
                                                >
                                                    <p class="text-xs line-clamp-3 group-hover:line-clamp-none transition-all">{rel.node.content}</p>
                                                    <div class="mt-2 flex items-center justify-between">
                                                        <span class="text-[9px] font-mono opacity-50">#{rel.node.id.split('-').pop()}</span>
                                                        {#if rel.edge.from === selectedNodeId}
                                                            <ArrowDown class="h-3 w-3 opacity-30 group-hover:translate-y-0.5 transition-transform" />
                                                        {:else}
                                                            <ArrowUp class="h-3 w-3 opacity-30 group-hover:-translate-y-0.5 transition-transform" />
                                                        {/if}
                                                    </div>
                                                </button>
                                            {:else}
                                                <p class="text-xs text-muted-foreground italic">No refinements linked.</p>
                                            {/each}
                                        </div>
                                    </div>
                                </div>
                            {/if}

                            <!-- Connection Explorer -->
                            {#if data.topology.edges && data.topology.edges.length > 0}
                                <div class="pt-8">
                                    <h3 class="text-2xl font-semibold mb-6 flex items-center gap-2 justify-center">
                                        <Network class="h-6 w-6 text-primary" />
                                        Factual Lineage
                                    </h3>
                                    <div class="grid gap-6 md:grid-cols-2">
                                        {#each data.topology.edges as edge}
                                            {@const fromNode = data.topology?.nodes?.find(n => n.id === edge.from)}
                                            {@const toNode = data.topology?.nodes?.find(n => n.id === edge.to)}
                                            
                                            <!-- Logic Colors: Evidence (blue), Deduce (purple), Refine (amber) -->
                                            {@const logicColor = edge.bond === 'E' ? 'blue' : edge.bond === 'D' ? 'purple' : edge.bond === 'R' ? 'amber' : 'slate'}
                                            {@const logicLabel = edge.bond === 'E' ? 'Evidence' : edge.bond === 'D' ? 'Deduce' : edge.bond === 'R' ? 'Refine' : edge.bond}
                                            
                                            <div class="flex flex-col bg-background border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <div class="flex items-stretch gap-0 border-b min-h-[120px]">
                                                    <button 
                                                        class="flex-1 p-4 text-xs bg-muted/20 hover:bg-muted/30 transition-colors text-left"
                                                        onclick={() => selectedNodeId = edge.from}
                                                    >
                                                        <div class="flex items-center gap-1.5 mb-2 opacity-60 uppercase text-[9px] font-bold">
                                                            {#if fromNode?.meta?.type === 'fact'}<Database class="h-3 w-3" />Fact{/if}
                                                            {#if fromNode?.meta?.type === 'summary'}<FileText class="h-3 w-3" />Summary{/if}
                                                            #{edge.from?.split('-').pop()}
                                                        </div>
                                                        <p class="line-clamp-3 leading-relaxed">{fromNode?.content || 'Unknown Source'}</p>
                                                    </button>
                                                    
                                                    <div class="w-20 flex flex-col items-center justify-center bg-muted/40 relative px-2">
                                                        {#if edge.bond === 'E'}
                                                            <div class="w-full h-0.5 border-t-2 border-dashed border-blue-400/50"></div>
                                                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse translate-y-[1px]"></div>
                                                            </div>
                                                            <Badge variant="outline" class="text-[9px] absolute -top-2.5 bg-background px-1.5 py-0 h-5 border-blue-300 text-blue-700 font-bold uppercase shadow-sm">
                                                                Evidence
                                                            </Badge>
                                                        {:else if edge.bond === 'D'}
                                                            <div class="w-full h-0.5 border-t-2 border-dashed border-purple-400/50"></div>
                                                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-purple-500 translate-y-[1px]"></div>
                                                            </div>
                                                            <Badge variant="outline" class="text-[9px] absolute -top-2.5 bg-background px-1.5 py-0 h-5 border-purple-300 text-purple-700 font-bold uppercase shadow-sm">
                                                                Deduce
                                                            </Badge>
                                                        {:else if edge.bond === 'R'}
                                                            <div class="w-full h-0.5 border-t-2 border-dashed border-amber-400/50"></div>
                                                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div class="w-2.5 h-2.5 bg-amber-500 rotate-45 translate-y-[1px]"></div>
                                                            </div>
                                                            <Badge variant="outline" class="text-[9px] absolute -top-2.5 bg-background px-1.5 py-0 h-5 border-amber-300 text-amber-700 font-bold uppercase shadow-sm">
                                                                Refine
                                                            </Badge>
                                                        {:else}
                                                            <div class="w-full h-0.5 border-t-2 border-dashed border-slate-400/50"></div>
                                                            <Badge variant="outline" class="text-[9px] absolute -top-2.5 bg-background px-1.5 py-0 h-5 border-slate-300 text-slate-700 font-bold uppercase shadow-sm">
                                                                {edge.bond}
                                                            </Badge>
                                                        {/if}
                                                    </div>

                                                    <button 
                                                        class="flex-1 p-4 text-xs text-left transition-colors
                                                        {edge.bond === 'E' ? 'bg-blue-500/5 hover:bg-blue-500/10' : 
                                                         edge.bond === 'D' ? 'bg-purple-500/5 hover:bg-purple-500/10' : 
                                                         edge.bond === 'R' ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'bg-slate-500/5 hover:bg-slate-500/10'}"
                                                        onclick={() => selectedNodeId = edge.to}
                                                    >
                                                        <div class="flex items-center gap-1.5 mb-2 opacity-60 uppercase text-[9px] font-bold 
                                                            {edge.bond === 'E' ? 'text-blue-700' : 
                                                             edge.bond === 'D' ? 'text-purple-700' : 
                                                             edge.bond === 'R' ? 'text-amber-700' : 'text-slate-700'}">
                                                            {#if toNode?.meta?.type === 'summary'}<FileText class="h-3 w-3" />Summary{:else}<Zap class="h-3 w-3" />Reasoning{/if}
                                                            #{edge.to?.split('-').pop()}
                                                        </div>
                                                        <p class="line-clamp-3 leading-relaxed font-medium">{toNode?.content || 'Unknown Target'}</p>
                                                    </button>
                                                </div>
                                                
                                                <div class="px-4 py-2 bg-muted/10 flex items-center justify-between">
                                                    <span class="text-[10px] text-muted-foreground italic">
                                                        {#if edge.bond === 'E'}Supporting evidence for the insight{:else if edge.bond === 'D'}Logical derivation from facts{:else if edge.bond === 'R'}Refining existing knowledge{/if}
                                                    </span>
                                                    {#if toNode?.meta?.confidence}
                                                        <Badge variant="secondary" class="text-[8px] h-3 px-1">
                                                            {Math.round(Number(toNode.meta.confidence) * 100)}% Confidence
                                                        </Badge>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <div class="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl w-full">
                            <Network class="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p>No map data available. Start a session or filter by Session ID.</p>
                        </div>
                    {/if}
                </div>
            {:else if activeTab === 'about'}
                <div class="col-span-full space-y-8 max-w-4xl mx-auto py-4">
                    <section class="space-y-4">
                        <h2 class="text-2xl font-bold flex items-center gap-2 border-b pb-2">
                            <Brain class="h-6 w-6 text-primary" />
                            How Miri's Brain Works
                        </h2>
                        <p class="text-muted-foreground leading-relaxed">
                            Miri's "Brain" is a sophisticated long-term memory system designed to transform fluid conversations into structured, actionable knowledge. It operates by continuously processing interactions through several stages of synthesis and reasoning.
                        </p>
                        
                        <div class="grid gap-6 md:grid-cols-2 mt-6">
                            <Card.Root>
                                <Card.Header>
                                    <Card.Title class="flex items-center gap-2 text-base">
                                        <Database class="h-4 w-4 text-blue-500" />
                                        Factual Memories
                                    </Card.Title>
                                </Card.Header>
                                <Card.Content>
                                    <p class="text-sm text-muted-foreground">
                                        The fundamental building blocks. These are discrete pieces of information extracted directly from user interactions, such as preferences, biographical details, or specific events.
                                    </p>
                                </Card.Content>
                            </Card.Root>
                            
                            <Card.Root>
                                <Card.Header>
                                    <Card.Title class="flex items-center gap-2 text-base">
                                        <FileText class="h-4 w-4 text-purple-500" />
                                        Contextual Summaries
                                    </Card.Title>
                                </Card.Header>
                                <Card.Content>
                                    <p class="text-sm text-muted-foreground">
                                        Higher-level abstractions that group related facts and conversation history into cohesive summaries, providing Miri with a "big picture" understanding of complex topics or long-term goals.
                                    </p>
                                </Card.Content>
                            </Card.Root>
                            
                            <Card.Root>
                                <Card.Header>
                                    <Card.Title class="flex items-center gap-2 text-base">
                                        <Network class="h-4 w-4 text-amber-500" />
                                        Reasoning Topology
                                    </Card.Title>
                                </Card.Header>
                                <Card.Content>
                                    <p class="text-sm text-muted-foreground">
                                        The map of relationships between thoughts. Miri uses <strong>Evidence</strong>, <strong>Deduction</strong>, and <strong>Refinement</strong> to link different memories, allowing her to "reason" through your history and draw new insights.
                                    </p>
                                </Card.Content>
                            </Card.Root>
                            
                            <Card.Root>
                                <Card.Header>
                                    <Card.Title class="flex items-center gap-2 text-base">
                                        <Zap class="h-4 w-4 text-primary" />
                                        Active Retrieval
                                    </Card.Title>
                                </Card.Header>
                                <Card.Content>
                                    <p class="text-sm text-muted-foreground">
                                        During chat, Miri performs semantic searches across these structures to pull relevant context, ensuring that her responses are always informed by what you've shared in the past.
                                    </p>
                                </Card.Content>
                            </Card.Root>
                        </div>
                    </section>

                    <section class="space-y-4 pt-4">
                        <h2 class="text-2xl font-bold flex items-center gap-2 border-b pb-2">
                            <Fingerprint class="h-6 w-6 text-primary" />
                            Core Assumptions
                        </h2>
                        <div class="space-y-4">
                            <div class="flex gap-4">
                                <div class="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <div class="h-2 w-2 rounded-full bg-primary"></div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-sm">Persistence is Priority</h4>
                                    <p class="text-sm text-muted-foreground mt-1">
                                        Information is assumed to be relevant until explicitly corrected or superseded. Miri favors consistency and builds upon previous knowledge rather than treating every session as a blank slate.
                                    </p>
                                </div>
                            </div>

                            <div class="flex gap-4">
                                <div class="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <div class="h-2 w-2 rounded-full bg-primary"></div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-sm">Confidence-Weighted Reasoning</h4>
                                    <p class="text-sm text-muted-foreground mt-1">
                                        Every node in the brain has a confidence score. High-confidence facts (like your name) anchor the reasoning process, while lower-confidence deductions are treated as hypotheses to be verified.
                                    </p>
                                </div>
                            </div>

                            <div class="flex gap-4">
                                <div class="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <div class="h-2 w-2 rounded-full bg-primary"></div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-sm">Semantic Connectivity</h4>
                                    <p class="text-sm text-muted-foreground mt-1">
                                        The brain assumes that related information should be linked. Relationships (bonds) are not just metadata—they are functional pathways that allow Miri to traverse from one thought to another during reasoning.
                                    </p>
                                </div>
                            </div>
                            
                            <div class="flex gap-4">
                                <div class="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <div class="h-2 w-2 rounded-full bg-primary"></div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-sm">Privacy by Isolation</h4>
                                    <p class="text-sm text-muted-foreground mt-1">
                                        Miri assumes that "Brain" data is personal and session-specific. While the underlying logic is shared, the factual content is isolated to your unique profile and interaction history.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            {/if}
        </div>

        {#if (activeTab === 'facts' || activeTab === 'summaries') && totalPages > 1}
            <div class="mt-8 flex items-center justify-between border-t pt-4">
                <div class="text-sm text-muted-foreground">
                    Showing <span class="font-medium">{Math.min((currentPage - 1) * pageSize + 1, activeTab === 'facts' ? filteredFacts.length : filteredSummaries.length)}</span> to 
                    <span class="font-medium">{Math.min(currentPage * pageSize, activeTab === 'facts' ? filteredFacts.length : filteredSummaries.length)}</span> of 
                    <span class="font-medium">{activeTab === 'facts' ? filteredFacts.length : filteredSummaries.length}</span> results
                </div>
                <div class="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        disabled={currentPage === 1}
                        onclick={() => goToPage(currentPage - 1)}
                    >
                        <ChevronLeft class="h-4 w-4" />
                    </Button>
                    <div class="text-sm font-medium">
                        Page {currentPage} of {totalPages}
                    </div>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        disabled={currentPage === totalPages || totalPages === 0}
                        onclick={() => goToPage(currentPage + 1)}
                    >
                        <ChevronRight class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        {/if}
    </div>
</div>
