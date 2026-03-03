<script lang="ts">
    import JSONTree from '$lib/components/json-tree/json-tree.svelte';
    import { onMount } from 'svelte';
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { AlertCircle, Brain, Database, FileText, Info, Search, ArrowUpDown, ArrowUp, ArrowDown, Network, Fingerprint, Zap, ChevronLeft, ChevronRight } from "lucide-svelte";
    import type { PageData as BrainData } from "./$types";
    
    let { data } = $props() as { data: BrainData };
    
    let activeTab = $state<'facts' | 'summaries' | 'topology'>('facts');
    let searchQuery = $state("");
    let sessionFilter = $state("");
    let sortBy = $state<string>("content");
    let sortOrder = $state<'asc' | 'desc'>('asc');
    let selectedCategory = $state<string>("all");
    
    // Pagination state (synced with URL)
    let currentPage = $state(data.page || 1);
    const pageSize = data.pageSize || 12;

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

    onMount(() => {
        // Check if we should switch to topology tab for this session
        const urlParams = new URLSearchParams(window.location.search);
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

    let paginatedFacts = $derived(filteredFacts);
    let paginatedSummaries = $derived(filteredSummaries);

    let totalPages = $derived(
        activeTab === 'facts' 
            ? Math.ceil(filteredFacts.length / pageSize) 
            : Math.ceil(filteredSummaries.length / pageSize)
    );

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
        const url = new URL(window.location.href);
        url.searchParams.delete('page');
        url.searchParams.delete('session_id');
        window.location.href = url.pathname;
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
                        onclick={() => activeTab = 'facts'}
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
                        onclick={() => activeTab = 'summaries'}
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
                        onclick={() => activeTab = 'topology'}
                    >
                        <Network class="h-4 w-4" />
                        Topology
                        <Badge variant={activeTab === 'topology' ? 'secondary' : 'outline'} class="ml-1 px-1.5 py-0 text-[10px]">
                            {data.topology?.nodes?.length || 0}
                        </Badge>
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
                                <Card.Root class="border-l-4 border-l-primary/50">
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
            {/if}
        </div>

        {#if activeTab !== 'topology' && totalPages > 1}
            <div class="mt-8 flex items-center justify-between border-t pt-4">
                <div class="text-sm text-muted-foreground">
                    Showing <span class="font-medium">{(currentPage - 1) * pageSize + 1}</span> to 
                    <span class="font-medium">{Math.min(currentPage * pageSize, activeTab === 'facts' ? data.totalFacts : data.totalSummaries)}</span> of 
                    <span class="font-medium">{activeTab === 'facts' ? data.totalFacts : data.totalSummaries}</span> results
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
