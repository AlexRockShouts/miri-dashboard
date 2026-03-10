<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { 
        AlertCircle, 
        Bot, 
        User, 
        Clock, 
        CheckCircle2, 
        XCircle, 
        Loader2, 
        Terminal, 
        Fingerprint, 
        RefreshCw,
        Search,
        Layers,
        Eye,
        Download,
        X
    } from "lucide-svelte";
    import type { PageData as SubAgentsData } from "./$types";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    
    let { data } = $props() as { data: SubAgentsData };
    
    let searchQuery = $state("");
    let selectedRunId = $state<string | null>(null);
    let selectedRun = $derived(data.runs.find(r => r.id === selectedRunId));
    
    let filteredRuns = $derived(
        data.runs
            .filter(run => 
                run.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                run.goal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                run.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                run.parent_session?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA; // Newest first
            })
    );

    function getStatusVariant(status: string | undefined) {
        switch (status?.toLowerCase()) {
            case 'completed': return 'default';
            case 'running': return 'secondary';
            case 'failed': return 'destructive';
            case 'cancelled': return 'outline';
            case 'pending': return 'outline';
            case 'paused': return 'outline';
            default: return 'outline';
        }
    }

    function getStatusColorClass(status: string | undefined) {
        switch (status?.toLowerCase()) {
            case 'completed': return 'bg-green-100 text-green-700 border-green-200';
            case 'running': return 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse';
            case 'failed': return 'bg-red-100 text-red-700 border-red-200';
            case 'cancelled': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'paused': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-muted text-muted-foreground border-border';
        }
    }

    function getRoleIcon(role: string | undefined) {
        switch (role?.toLowerCase()) {
            case 'researcher': return Terminal;
            case 'coder': return Terminal;
            case 'reviewer': return CheckCircle2;
            case 'planner': return Layers;
            default: return Bot;
        }
    }

    function formatDate(dateStr: string | undefined) {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleString();
        } catch (e) {
            return dateStr;
        }
    }

    function downloadResult(run: any) {
        const data = JSON.stringify(run, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subagent-run-${run.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadOutputText(run: any) {
        if (!run.output) return;
        const blob = new Blob([run.output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subagent-output-${run.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function isOlderThanOneDay(dateStr: string | undefined) {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const oneDayInMs = 24 * 60 * 60 * 1000;
        return diffInMs > oneDayInMs;
    }
</script>

<div class="container mx-auto py-8 px-4">
    <header class="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <div class="flex items-center gap-2 mb-1">
                <Layers class="h-8 w-8 text-primary" />
                <h1 class="text-4xl font-bold tracking-tight">Sub-Agents</h1>
            </div>
            <p class="text-muted-foreground">Monitor runs of autonomous specialized sub-agents.</p>
        </div>
        
        <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" onclick={() => window.location.reload()}>
                <RefreshCw class="h-4 w-4 mr-2" />
                Refresh
            </Button>
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
                    Failed to fetch sub-agent data from the Miri server.
                </Card.Description>
            </Card.Header>
            <Card.Content>
                <p class="text-sm font-mono bg-destructive/10 p-2 rounded">{data.error}</p>
            </Card.Content>
        </Card.Root>
    {/if}

    <div class="flex flex-col gap-6">
        <div class="relative w-full max-w-md">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
                type="text" 
                placeholder="Search sub-agents..." 
                class="w-full pl-9 pr-4 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                bind:value={searchQuery}
            />
        </div>

        <div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {#each filteredRuns as run}
                {@const isCompact = isOlderThanOneDay(run.created_at)}
                <Card.Root class="flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group {isCompact ? 'bg-muted/10' : ''}">
                    <div class="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Bot class="{isCompact ? 'h-10 w-10' : 'h-16 w-16'}" />
                    </div>
                    
                    <Card.Header class="{isCompact ? 'pb-1 pt-3' : 'pb-2'}">
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <Badge variant="outline" class="font-mono text-[10px] truncate max-w-[120px]" title={run.id}>
                                {run.id}
                            </Badge>
                            <Badge variant="outline" class="text-[10px] uppercase px-1.5 py-0 {getStatusColorClass(run.status)}">
                                {run.status || 'Unknown'}
                            </Badge>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="p-1.5 rounded-md bg-primary/10 text-primary">
                                <Bot class="h-4 w-4" />
                            </div>
                            <h3 class="font-bold text-sm uppercase tracking-tight">{run.role || 'Agent'}</h3>
                        </div>
                    </Card.Header>

                    <Card.Content class="flex-1 {isCompact ? 'space-y-2' : 'space-y-4'}">
                        <div class="space-y-1">
                            <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Goal</span>
                            <p class="text-sm leading-relaxed {isCompact ? 'line-clamp-1' : 'line-clamp-3'}" title={run.goal}>{run.goal}</p>
                        </div>

                        {#if run.output && !isCompact}
                            <div class="space-y-1">
                                <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Output</span>
                                <p class="text-xs italic text-muted-foreground line-clamp-2">{run.output}</p>
                            </div>
                        {/if}

                        {#if run.error}
                            <div class="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                                <p class="font-semibold uppercase text-[9px] mb-1">Error</p>
                                <span class="{isCompact ? 'line-clamp-1' : ''}">{run.error}</span>
                            </div>
                        {/if}

                        {#if !isCompact}
                            <div class="grid grid-cols-2 gap-2 pt-2 border-t">
                                <div class="space-y-0.5">
                                    <span class="text-[9px] text-muted-foreground uppercase tracking-wider">Created</span>
                                    <div class="flex items-center gap-1 text-[10px]">
                                        <Clock class="h-3 w-3 opacity-50" />
                                        {formatDate(run.created_at)}
                                    </div>
                                </div>
                                <div class="space-y-0.5">
                                    <span class="text-[9px] text-muted-foreground uppercase tracking-wider">Tokens</span>
                                    <div class="flex items-center gap-1 text-[10px]">
                                        <Terminal class="h-3 w-3 opacity-50" />
                                        {run.total_cost ? `$${run.total_cost.toFixed(4)}` : `${(run.prompt_tokens || 0) + (run.output_tokens || 0)} tokens`}
                                    </div>
                                </div>
                            </div>
                        {:else}
                             <div class="pt-1 flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-wider border-t">
                                <span class="flex items-center gap-1"><Clock class="h-2.5 w-2.5" /> {formatDate(run.created_at)}</span>
                                <span>{run.total_cost ? `$${run.total_cost.toFixed(4)}` : `${(run.prompt_tokens || 0) + (run.output_tokens || 0)} tokens`}</span>
                             </div>
                        {/if}
                        
                        {#if run.parent_session}
                            <div class="pt-2 flex gap-2">
                                <Button variant="outline" size="sm" class="flex-1 text-[10px] {isCompact ? 'h-6' : 'h-7'} gap-1.5" href="/brain?session_id={run.parent_session}">
                                    <Fingerprint class="h-3 w-3" />
                                    {#if !isCompact}Parent Session{:else}Brain{/if}
                                </Button>
                                <Button variant="secondary" size="sm" class="flex-1 text-[10px] {isCompact ? 'h-6' : 'h-7'} gap-1.5" onclick={() => selectedRunId = run.id || null}>
                                    <Eye class="h-3 w-3" />
                                    View
                                </Button>
                            </div>
                        {/if}
                    </Card.Content>
                </Card.Root>
            {:else}
                <div class="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                    <Bot class="h-10 w-10 mx-auto mb-3 opacity-20" />
                    {#if searchQuery}
                        <p>No sub-agent runs matching "{searchQuery}" found.</p>
                        <Button variant="link" size="sm" class="mt-2" onclick={() => searchQuery = ""}>Clear search</Button>
                    {:else}
                        <p>No sub-agent runs found in the system.</p>
                        <p class="text-xs mt-2 opacity-70">Sub-agents appear here when Miri spawns specialized workers for complex tasks.</p>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    {#if selectedRunId && selectedRun}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
            <Card.Root class="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <Card.Header class="flex flex-row items-center justify-between border-b py-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-lg bg-primary/10 text-primary">
                            <Bot class="h-5 w-5" />
                        </div>
                        <div>
                            <Card.Title class="text-xl">Sub-Agent Run Details</Card.Title>
                            <Card.Description class="font-mono text-xs">{selectedRun.id}</Card.Description>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button variant="outline" size="sm" class="gap-1.5" onclick={() => downloadOutputText(selectedRun)}>
                            <Download class="h-4 w-4" />
                            Download Text
                        </Button>
                        <Button variant="outline" size="sm" class="gap-1.5" onclick={() => downloadResult(selectedRun)}>
                            <Terminal class="h-4 w-4" />
                            JSON
                        </Button>
                        <Button variant="ghost" size="icon" onclick={() => selectedRunId = null}>
                            <X class="h-4 w-4" />
                        </Button>
                    </div>
                </Card.Header>
                <Card.Content class="flex-1 overflow-hidden p-0">
                    <ScrollArea class="h-[60vh]">
                        <div class="p-6 space-y-8">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="space-y-1">
                                    <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
                                    <div>
                                        <Badge variant="outline" class="uppercase {getStatusColorClass(selectedRun.status)}">
                                            {selectedRun.status}
                                        </Badge>
                                    </div>
                                </div>
                                <div class="space-y-1">
                                    <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</span>
                                    <p class="text-sm font-semibold">{selectedRun.role}</p>
                                </div>
                                <div class="space-y-1">
                                    <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Model</span>
                                    <p class="text-sm font-mono bg-muted px-1.5 py-0.5 rounded w-fit">{selectedRun.model || 'N/A'}</p>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Goal</span>
                                <div class="p-4 rounded-lg bg-muted/30 border text-sm leading-relaxed">
                                    {selectedRun.goal}
                                </div>
                            </div>

                            {#if selectedRun.output}
                                <div class="space-y-2">
                                    <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resulting Output</span>
                                    <div class="p-4 rounded-lg bg-primary/5 border border-primary/10 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedRun.output}
                                    </div>
                                </div>
                            {/if}

                            {#if selectedRun.error}
                                <div class="space-y-2">
                                    <span class="text-[10px] font-bold text-red-600 uppercase tracking-widest">Error Details</span>
                                    <div class="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-mono">
                                        {selectedRun.error}
                                    </div>
                                </div>
                            {/if}

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
                                <div class="space-y-3">
                                    <h4 class="text-xs font-bold uppercase tracking-widest text-muted-foreground">Timeline</h4>
                                    <div class="space-y-2">
                                        <div class="flex justify-between text-xs">
                                            <span class="text-muted-foreground">Created</span>
                                            <span>{formatDate(selectedRun.created_at)}</span>
                                        </div>
                                        <div class="flex justify-between text-xs">
                                            <span class="text-muted-foreground">Started</span>
                                            <span>{formatDate(selectedRun.started_at)}</span>
                                        </div>
                                        <div class="flex justify-between text-xs">
                                            <span class="text-muted-foreground">Finished</span>
                                            <span>{formatDate(selectedRun.finished_at)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-3">
                                    <h4 class="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resource Usage</h4>
                                    <div class="space-y-2">
                                        <div class="flex justify-between text-xs">
                                            <span class="text-muted-foreground">Prompt Tokens</span>
                                            <span class="font-mono">{selectedRun.prompt_tokens || 0}</span>
                                        </div>
                                        <div class="flex justify-between text-xs">
                                            <span class="text-muted-foreground">Output Tokens</span>
                                            <span class="font-mono">{selectedRun.output_tokens || 0}</span>
                                        </div>
                                        <div class="flex justify-between text-xs pt-2 border-t font-bold">
                                            <span>Total Estimated Cost</span>
                                            <span class="text-primary">${selectedRun.total_cost?.toFixed(6) || '0.000000'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </Card.Content>
                <Card.Footer class="border-t p-4 flex justify-between bg-muted/10">
                    <p class="text-[10px] text-muted-foreground">Parent Session: <span class="font-mono">{selectedRun.parent_session}</span></p>
                    <Button onclick={() => selectedRunId = null}>Close</Button>
                </Card.Footer>
            </Card.Root>
        </div>
    {/if}
</div>
