<script lang="ts">
    import { onMount } from 'svelte';
    import { configState } from "$lib/state/config.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import * as Card from "$lib/components/ui/card";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { Loader2, Save, RefreshCw, AlertCircle, CheckCircle2, Server, Cpu, Bot, Network, Database } from "lucide-svelte";

    let configJson = $state("");
    let isSaving = $state(false);
    let saveError = $state<string | null>(null);
    let saveSuccess = $state(false);
    let editingProvider = $state<string | null>(null);
    let newProviderName = $state('');
    let newProviderBaseUrl = $state('');
    let newProviderApiType = $state('openai');
    let newProviderModelsStr = $state('');
    let editModelsStr = $state('');

    onMount(async () => {
        await configState.fetchConfig();
        if (configState.config) {
            configJson = JSON.stringify(configState.config, null, 4);
        }
    });

    async function handleSave() {
        isSaving = true;
        saveError = null;
        saveSuccess = false;
        try {
            const parsed = JSON.parse(configJson);
            await configState.updateConfig(parsed);
            saveSuccess = true;
            setTimeout(() => {
                saveSuccess = false;
            }, 3000);
        } catch (e: any) {
            saveError = e.message || "Failed to save configuration";
        } finally {
            isSaving = false;
        }
    }

    async function handleRefresh() {
        await configState.fetchConfig();
        if (configState.config) {
            configJson = JSON.stringify(configState.config, null, 4);
        }
    }
</script>

<div class="container mx-auto p-6 max-w-5xl">
    <div class="flex items-center justify-between mb-6">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">Configuration</h1>
            <p class="text-muted-foreground">Manage Miri server settings and sub-agent parameters.</p>
        </div>
        <div class="flex gap-2">
            <Button variant="outline" size="sm" onclick={handleRefresh} disabled={configState.isFetchingConfig}>
                <RefreshCw class="h-4 w-4 mr-2 {configState.isFetchingConfig ? 'animate-spin' : ''}" />
                Refresh
            </Button>
            <Button size="sm" onclick={handleSave} disabled={isSaving || configState.isFetchingConfig}>
                {#if isSaving}
                    <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                {:else}
                    <Save class="h-4 w-4 mr-2" />
                {/if}
                Save Changes
            </Button>
        </div>
    </div>

    {#if saveError}
        <div class="bg-destructive/15 text-destructive p-4 rounded-lg mb-6 flex items-center gap-3 border border-destructive/20">
            <AlertCircle class="h-5 w-5 shrink-0" />
            <p class="text-sm font-medium">{saveError}</p>
        </div>
    {/if}

    {#if saveSuccess}
        <div class="bg-green-500/15 text-green-600 dark:text-green-400 p-4 rounded-lg mb-6 flex items-center gap-3 border border-green-500/20">
            <CheckCircle2 class="h-5 w-5 shrink-0" />
            <p class="text-sm font-medium">Configuration updated successfully!</p>
        </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="lg:col-span-1 space-y-4">
            <Card.Root>
                <Card.Header class="pb-3">
                    <Card.Title class="text-sm font-medium">Quick Stats</Card.Title>
                </Card.Header>
                <Card.Content class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                            <Server class="h-3.5 w-3.5" />
                            <span>Storage</span>
                        </div>
                        <Badge variant="secondary" class="text-[10px]">
                            {configState.config?.storage_dir || 'Default'}
                        </Badge>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                            <Cpu class="h-3.5 w-3.5" />
                            <span>Models</span>
                        </div>
                        <Badge variant="secondary" class="text-[10px]">
                            {Object.keys(configState.config?.models?.providers || {}).length} Configured
                        </Badge>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                            <Bot class="h-3.5 w-3.5" />
                            <span>Max Subagents</span>
                        </div>
                        <Badge variant="secondary" class="text-[10px]">
                            {configState.config?.agents?.subagents || 0}
                        </Badge>
                    </div>
                </Card.Content>
            </Card.Root>

            <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
                <h3 class="text-sm font-semibold flex items-center gap-2">
                    <Network class="h-4 w-4 text-primary" />
                    Channels
                </h3>
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs">WhatsApp</span>
                        <Badge variant={configState.config?.channels?.whatsapp?.enabled ? "default" : "outline"} class="text-[10px]">
                            {configState.config?.channels?.whatsapp?.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-xs">IRC</span>
                        <Badge variant={configState.config?.channels?.irc?.enabled ? "default" : "outline"} class="text-[10px]">
                            {configState.config?.channels?.irc?.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                    </div>
                </div>
            </div>
        </div>

        <div class="lg:col-span-3">
            <Card.Root class="h-full flex flex-col">
                <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <Card.Title class="text-lg">Server Configuration (JSON)</Card.Title>
                        <Card.Description class="text-xs">Full access to all server parameters.</Card.Description>
                    </div>
                    <Database class="h-5 w-5 text-muted-foreground/50" />
                </Card.Header>
                <Card.Content class="flex-1 p-0">
                    <div class="relative h-[600px] border-t">
                        {#if configState.isFetchingConfig && !configJson}
                            <div class="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                                <Loader2 class="h-8 w-8 animate-spin text-primary" />
                            </div>
                        {/if}
                        <ScrollArea class="h-full w-full">
                            <Textarea
                                bind:value={configJson}
                                class="min-h-full w-full font-mono text-xs p-4 resize-none border-0 focus-visible:ring-0"
                                placeholder="Loading configuration..."
                            />
                        </ScrollArea>
                    </div>
                </Card.Content>
            </Card.Root>
        </div>
    </div>
</div>
