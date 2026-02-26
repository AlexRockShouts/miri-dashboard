<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Activity, Server, Users, User, AlertCircle, Cpu } from "lucide-svelte";
    
    let { data } = $props();
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

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
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
                <Card.Title>Installed Skills</Card.Title>
                <Card.Description>Capabilities and tools available to the agent.</Card.Description>
            </Card.Header>
            <Card.Content>
                {#if data.skills && data.skills.length > 0}
                    <div class="space-y-4">
                        {#each data.skills as skill}
                            <div class="p-4 border rounded-lg bg-card/50">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-bold">{skill.name}</h3>
                                        {#if skill.version}
                                            <Badge variant="secondary" class="text-[10px] px-1.5 py-0">v{skill.version}</Badge>
                                        {/if}
                                    </div>
                                    <div class="flex gap-1">
                                        {#each (skill.tags || []) as tag}
                                            <Badge variant="outline" class="text-[10px] px-1.5 py-0">{tag}</Badge>
                                        {/each}
                                    </div>
                                </div>
                                <p class="text-sm text-muted-foreground">{skill.description || 'No description provided.'}</p>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        No skills installed.
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
                                        <Button variant="ghost" size="sm">Inspect</Button>
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
</div>
