<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Activity, Server, Users, User, AlertCircle, Cpu, X, Bot, Loader2, Download, Trash2, Calendar, Clock, CheckCircle2 } from "lucide-svelte";
    import { applyAction, deserialize } from '$app/forms';
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { invalidateAll } from '$app/navigation';
    import type { PageData as AdminData } from "./$types";
    
    interface DisplayMessage {
        role: string;
        content: string;
    }

    let { data } = $props() as { data: AdminData };

    let isInspecting = $state(false);
    let selectedSession = $state("");
    let sessionHistory = $state<DisplayMessage[]>([]);
    let isLoadingHistory = $state(false);
    let historyError = $state("");

    async function inspectSession(sessionId: string) {
        selectedSession = sessionId;
        isInspecting = true;
        isLoadingHistory = true;
        historyError = "";
        sessionHistory = [];

        console.log(`Inspecting session: ${sessionId}`);

        const formData = new FormData();
        formData.append('sessionId', sessionId);

        try {
            const response = await fetch('?/getHistory', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            console.log('Action response received');
            const result = deserialize(text);
            if (result.type === 'success' && result.data) {
                const actionData = result.data as any;
                if (actionData.error) {
                    historyError = actionData.error;
                } else {
                    sessionHistory = actionData.history || [];
                }
            } else {
                historyError = "Failed to fetch session history";
            }
        } catch (e: any) {
            historyError = e.message || "An error occurred";
        } finally {
            isLoadingHistory = false;
        }
    }

    function closeInspector() {
        isInspecting = false;
        selectedSession = "";
        sessionHistory = [];
        historyError = "";
    }
</script>

<div class="container mx-auto py-8 px-4">
    <header class="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 class="text-4xl font-bold tracking-tight">Miri Dashboard</h1>
            <p class="text-muted-foreground">Monitor and manage your Miri AI server instance.</p>
        </div>
        
        <div class="flex items-center gap-2">
            {#if data.health?.status?.toLowerCase() === 'ok'}
                <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200 gap-1.5 px-3 py-1">
                    <div class="h-2 w-2 rounded-full bg-green-500"></div>
                    System Online
                </Badge>
            {:else}
                <Badge variant="destructive" class="gap-1.5 px-3 py-1">
                    <AlertCircle class="h-4 w-4" />
                    System Offline
                </Badge>
            {/if}
            <Button variant="outline" size="sm" onclick={() => window.location.reload()}>Refresh</Button>
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
                    Failed to connect to the Miri server at <code>http://localhost:8080</code>.
                    Please ensure the server is running and reachable.
                </Card.Description>
            </Card.Header>
            <Card.Content>
                <p class="text-sm font-mono bg-destructive/10 p-2 rounded">{data.error}</p>
            </Card.Content>
        </Card.Root>
    {/if}

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between pb-2">
                <Card.Title class="text-sm font-medium">Server Status</Card.Title>
                <Activity class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{data.health?.status || 'Unknown'}</div>
                <p class="text-xs text-muted-foreground mt-1">{data.health?.message || 'No message'}</p>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between pb-2">
                <Card.Title class="text-sm font-medium">Active Sessions</Card.Title>
                <Users class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{data.sessions?.length || 0}</div>
                <p class="text-xs text-muted-foreground mt-1">Total concurrent connections</p>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between pb-2">
                <Card.Title class="text-sm font-medium">Total Humans</Card.Title>
                <User class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{data.humans?.length || 0}</div>
                <p class="text-xs text-muted-foreground mt-1">Identified human profiles</p>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between pb-2">
                <Card.Title class="text-sm font-medium">Installed Skills</Card.Title>
                <Cpu class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{data.skills?.length || 0}</div>
                <p class="text-xs text-muted-foreground mt-1">Available capabilities</p>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between pb-2">
                <Card.Title class="text-sm font-medium">Scheduled Tasks</Card.Title>
                <Calendar class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{data.tasks?.length || 0}</div>
                <p class="text-xs text-muted-foreground mt-1">Automated recurring tasks</p>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between pb-2">
                <Card.Title class="text-sm font-medium">Models Mode</Card.Title>
                <Server class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{data.config?.models?.mode || 'N/A'}</div>
                <p class="text-xs text-muted-foreground mt-1">{data.config?.server?.addr || 'No address'}</p>
            </Card.Content>
        </Card.Root>
    </div>

    <div class="grid gap-6 md:grid-cols-2 mb-8">
        <Card.Root>
            <Card.Header>
                <Card.Title>Recurring Tasks</Card.Title>
                <Card.Description>Status of scheduled automation and background jobs.</Card.Description>
            </Card.Header>
            <Card.Content>
                {#if data.tasks && data.tasks.length > 0}
                    <div class="space-y-4">
                        {#each data.tasks as task}
                            <div class="p-4 border rounded-lg bg-card/50">
                                <div class="flex items-center justify-between mb-3">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-bold">{task.name}</h3>
                                        <Badge variant={task.active ? 'default' : 'secondary'} class="text-[10px] px-1.5 py-0">
                                            {task.active ? 'active' : 'inactive'}
                                        </Badge>
                                    </div>
                                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Clock class="h-3 w-3" />
                                        {task.cron_expression}
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-4 text-xs">
                                    <div class="bg-muted/50 p-2 rounded">
                                        <span class="text-muted-foreground block mb-1 uppercase tracking-wider text-[9px] font-semibold">Last Run</span>
                                        <span class="font-mono">{task.last_run || 'Never'}</span>
                                    </div>
                                    <div class="bg-muted/50 p-2 rounded">
                                        <span class="text-muted-foreground block mb-1 uppercase tracking-wider text-[9px] font-semibold">Created</span>
                                        <span class="font-mono text-[10px]">{task.created ? new Date(task.created).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        No scheduled tasks found.
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header>
                <Card.Title>Communication Channels</Card.Title>
                <Card.Description>Active and configured external channels.</Card.Description>
            </Card.Header>
            <Card.Content>
                <div class="space-y-4">
                    <!-- WhatsApp -->
                    <div class="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                        <div class="flex items-center gap-3">
                            <div class="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            </div>
                            <div>
                                <p class="font-medium">WhatsApp</p>
                                <p class="text-xs text-muted-foreground">
                                    {data.config?.channels?.whatsapp?.enabled ? 'Channel enabled' : 'Channel disabled'}
                                </p>
                            </div>
                        </div>
                        {#if data.config?.channels?.whatsapp?.enabled}
                            <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        {:else}
                            <Badge variant="secondary">Inactive</Badge>
                        {/if}
                    </div>

                    <!-- IRC -->
                    <div class="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                        <div class="flex items-center gap-3">
                            <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>
                            </div>
                            <div>
                                <p class="font-medium">IRC ({data.config?.channels?.irc?.nick || 'N/A'})</p>
                                <p class="text-xs text-muted-foreground">
                                    {data.config?.channels?.irc?.host || 'No host'}:{data.config?.channels?.irc?.port || 'N/A'}
                                </p>
                            </div>
                        </div>
                        {#if data.config?.channels?.irc?.enabled}
                            <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        {:else}
                            <Badge variant="secondary">Inactive</Badge>
                        {/if}
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header>
                <Card.Title>Active Sessions</Card.Title>
                <Card.Description>Manage current conversation sessions.</Card.Description>
            </Card.Header>
            <Card.Content>
                {#if data.sessions && data.sessions.length > 0}
                    <Table.Root>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Session ID</Table.Head>
                                <Table.Head class="text-right">Action</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each data.sessions as sessionId}
                                <Table.Row>
                                    <Table.Cell class="font-mono text-xs">{sessionId}</Table.Cell>
                                    <Table.Cell class="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            onclick={() => inspectSession(sessionId)}
                                        >
                                            Inspect
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                {:else}
                    <div class="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        No active sessions found.
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header>
                <Card.Title>Stored Humans</Card.Title>
                <Card.Description>Identified people in long-term memory.</Card.Description>
            </Card.Header>
            <Card.Content>
                {#if data.humans && data.humans.length > 0}
                    <Table.Root>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
                                <Table.Head>Notes</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each data.humans as human}
                                <Table.Row>
                                    <Table.Cell class="font-medium">{human.id}</Table.Cell>
                                    <Table.Cell class="text-muted-foreground text-sm truncate max-w-[200px]">
                                        {human.notes || 'No notes available'}
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                {:else}
                    <div class="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        No human profiles stored.
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>
    </div>

    <Card.Root class="mt-8">
        <Card.Header>
            <Card.Title>Server Configuration</Card.Title>
        </Card.Header>
        <Card.Content>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                <div>
                    <span class="text-sm font-semibold block text-muted-foreground uppercase tracking-wider mb-1">Storage Directory</span>
                    <span class="font-mono text-sm">{data.config?.storage_dir || 'N/A'}</span>
                </div>
                <div>
                    <span class="text-sm font-semibold block text-muted-foreground uppercase tracking-wider mb-1">Models Path</span>
                    <span class="font-mono text-sm">{data.config?.storage_dir || 'N/A'}</span>
                </div>
                <div>
                    <span class="text-sm font-semibold block text-muted-foreground uppercase tracking-wider mb-1">Server Addr</span>
                    <span class="font-mono text-sm">{data.config?.server?.addr || 'N/A'}</span>
                </div>
            </div>
        </Card.Content>
    </Card.Root>

    {#if isInspecting}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
            <Card.Root class="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <Card.Header class="flex flex-row items-center justify-between border-b py-4">
                    <div>
                        <Card.Title class="text-xl">Session History</Card.Title>
                        <Card.Description class="font-mono text-xs">{selectedSession}</Card.Description>
                    </div>
                    <Button variant="ghost" size="icon" onclick={closeInspector}>
                        <X class="h-4 w-4" />
                    </Button>
                </Card.Header>
                <Card.Content class="flex-1 overflow-hidden p-0">
                    <div class="h-[60vh] flex flex-col bg-muted/20">
                        {#if isLoadingHistory}
                            <div class="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 class="h-8 w-8 animate-spin" />
                                <p>Loading conversation history...</p>
                            </div>
                        {:else if historyError}
                            <div class="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                                <AlertCircle class="h-12 w-12 text-destructive opacity-50" />
                                <div class="space-y-2">
                                    <h3 class="font-bold text-lg text-destructive">Error Loading History</h3>
                                    <p class="text-sm text-muted-foreground max-w-md">{historyError}</p>
                                </div>
                                <Button variant="outline" onclick={() => inspectSession(selectedSession)}>Try Again</Button>
                            </div>
                        {:else if sessionHistory.length === 0}
                            <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
                                <Bot class="h-12 w-12 mb-4 opacity-20" />
                                <p>This session has no recorded messages yet.</p>
                            </div>
                        {:else}
                            <ScrollArea class="flex-1 p-6">
                                <div class="space-y-6 max-w-3xl mx-auto">
                                    {#each sessionHistory as msg}
                                        <div class="space-y-1">
                                            <div class="flex items-center gap-2">
                                                <span class="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
                                                    {msg.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}">
                                                    {msg.role}
                                                </span>
                                            </div>
                                            <div class="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-mono bg-muted/30 p-3 rounded-md border border-border/50">
                                                {msg.content}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </ScrollArea>
                        {/if}
                    </div>
                </Card.Content>
                <Card.Footer class="border-t p-4 flex justify-end">
                    <Button onclick={closeInspector}>Close</Button>
                </Card.Footer>
            </Card.Root>
        </div>
    {/if}
</div>
