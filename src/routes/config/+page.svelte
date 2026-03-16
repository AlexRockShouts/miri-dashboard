<script lang="ts">
    import { onMount } from 'svelte';
    import { configState } from "$lib/state/config.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import { Label } from "$lib/components/ui/label";
    import * as Card from "$lib/components/ui/card";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { Loader2, Save, RefreshCw, AlertCircle, CheckCircle2, Server, Cpu, Bot, Network, Database, Plus, Edit3, X, Code } from "lucide-svelte";

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
        let isJsonEditMode = $state(false);
        let highlightedJson = $state('');
    
    $effect(() => {
        if (configState.config) {
            configJson = JSON.stringify(configState.config, null, 4);
        }
    });

    $effect(() => {
        if (configState.config && !isJsonEditMode) {
            highlightedJson = renderJson(configState.config);
        } else {
            highlightedJson = '';
        }
    });
    
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
            isJsonEditMode = false;
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


    async function handleAddProvider() {
        try {
            const modelIds = newProviderModelsStr.split('\n').map(s => s.trim()).filter(Boolean);
            await configState.addProvider(newProviderName, newProviderBaseUrl, newProviderApiType, modelIds);
            newProviderName = '';
            newProviderBaseUrl = '';
            newProviderApiType = 'openai';
            newProviderModelsStr = '';
        } catch (e) {
            saveError = (e as Error).message || 'Failed to add provider';
        }
    }

    async function handleUpdateProviderModels() {
        try {
            const modelIds = editModelsStr.split('\n').map(s => s.trim()).filter(Boolean);
            await configState.updateProviderModels(editingProvider!, modelIds);
            handleCancelEdit();
        } catch (e) {
            saveError = (e as Error).message || 'Failed to update provider models';
        }
    }

    function handleCancelEdit() {
        editingProvider = null;
        editModelsStr = '';
    }

    function handleFormat() {
        try {
            const parsed = JSON.parse(configJson);
            configJson = JSON.stringify(parsed, null, 4);
            saveSuccess = true;
            setTimeout(() => saveSuccess = false, 3000);
        } catch (e) {
            saveError = 'Invalid JSON';
        }
    }

    function renderJson(value: any, indent: string = ''): string {
        const nextIndent = indent + '  ';

        if (value === null) {
            return '<span class="text-gray-500">null</span>';
        }
        if (typeof value === 'boolean') {
            return `<span class="text-green-500">${String(value)}</span>`;
        }
        if (typeof value === 'number') {
            return `<span class="text-orange-500">${value}</span>`;
        }
        if (typeof value === 'string') {
            return `<span class="text-cyan-400">${JSON.stringify(value)}</span>`;
        }
        if (Array.isArray(value)) {
            let out = '<span class="text-pink-400">[</span>\n';
            for (let i = 0; i < value.length; i++) {
                out += `${nextIndent}${renderJson(value[i], nextIndent)}${i < value.length - 1 ? ',' : ''}\n`;
            }
            out += `${indent}<span class="text-pink-400">]</span>`;
            return out;
        }
        if (value !== null && typeof value === 'object') {
            let out = '<span class="text-pink-400">{</span>\n';
            const entries = Object.entries(value);
            for (let i = 0; i < entries.length; i++) {
                const [key, val] = entries[i];
                out += `${nextIndent}<span class="text-blue-400 font-semibold">${JSON.stringify(key)}</span><span class="text-gray-400">: </span>${renderJson(val, nextIndent)}${i < entries.length - 1 ? ',' : ''}\n`;
            }
            out += `${indent}<span class="text-pink-400">}</span>`;
            return out;
        }
        return '';
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
            <Button variant="outline" size="sm" onclick={() => isJsonEditMode = !isJsonEditMode}>
                <Code class="h-4 w-4 mr-2" />
                {isJsonEditMode ? 'View JSON' : 'Edit JSON'}
            </Button>
            {#if isJsonEditMode}
            <Button variant="outline" size="sm" onclick={handleFormat}>
                <Code class="h-4 w-4 mr-2" />
                Format
            </Button>
            <Button size="sm" onclick={handleSave} disabled={isSaving || configState.isFetchingConfig} >
                {#if isSaving}
                    <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                {:else}
                    <Save class="h-4 w-4 mr-2" />
                {/if}
                Save Changes
            </Button>
            {/if}
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

            <Card.Root>
                <Card.Header class="pb-3">
                    <Card.Title class="text-sm font-medium">Providers</Card.Title>
                </Card.Header>
                <Card.Content class="space-y-4 p-4">
                    <ScrollArea class="max-h-72 pr-4 mb-4">
                        <div class="space-y-2 pb-2">
                            {#if configState.config?.models?.providers}
                                {#each Object.entries(configState.config.models.providers) as [name, provider]}
                                    <div class="flex justify-between items-center p-3 border rounded-md gap-4">
                                        <div class="flex flex-col gap-1">
                                            <span class="font-medium">{name}</span>
                                            <span class="text-xs text-muted-foreground">{provider.api} {provider.baseUrl ? ` | ${provider.baseUrl}` : ''}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <Badge variant="secondary">{provider.models.length} models</Badge>
                                            <Button size="sm" variant="outline" onclick={() => {
                                                editingProvider = name;
                                                editModelsStr = provider.models.map(m => m.id).join('\n');
                                            }}>
                                                <Edit3 class="h-4 w-4 mr-1" />
                                                Edit
                                            </Button>
                                        </div>
                                    </div>
                                {/each}
                            {:else}
                                <p class="text-muted-foreground text-sm">No providers configured.</p>
                            {/if}
                        </div>
                    </ScrollArea>

                    <div class="pt-4 border-t space-y-3">
                        <Label class="text-sm font-medium">Add New Provider</Label>
                        <Input bind:value={newProviderName} placeholder="Provider name (required)" />
                        <Input bind:value={newProviderBaseUrl} placeholder="Base URL (optional)" />
                        <Input bind:value={newProviderApiType} placeholder="API type (e.g. openai)" />
                        <Textarea bind:value={newProviderModelsStr} placeholder="Model IDs, one per line e.g. gpt-4o\ngpt-4-turbo" rows="4" />
                        <Button onclick={handleAddProvider} disabled={!newProviderName.trim()} size="sm" class="w-full">
                            <Plus class="h-4 w-4 mr-2" />
                            Add Provider
                        </Button>
                    </div>

                    {#if editingProvider}
                        <div class="p-4 border rounded-md bg-accent/50 space-y-3">
                            <div class="flex justify-between items-center">
                                <h4 class="font-medium">Edit Models for <span class="font-bold">{editingProvider}</span></h4>
                                <Button size="sm" variant="ghost" onclick={handleCancelEdit} class="h-6 w-6 p-0">
                                    <X class="h-4 w-4" />
                                </Button>
                            </div>
                            <Textarea bind:value={editModelsStr} placeholder="Update model IDs, one per line" rows="6" />
                            <Button onclick={handleUpdateProviderModels} disabled={!editModelsStr.trim()} size="sm" class="w-full">
                                <Edit3 class="h-4 w-4 mr-2" />
                                Update Models
                            </Button>
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>
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
                    <div class="relative h-[90vh] border-t">
                        {#if configState.isFetchingConfig && !configJson}
                            <div class="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                                <Loader2 class="h-8 w-8 animate-spin text-primary" />
                            </div>
                        {/if}
                        <ScrollArea class="h-full w-full">
                            {#if isJsonEditMode}
                            <Textarea
                                bind:value={configJson}
                                class="min-h-full w-full font-mono text-xs p-4 resize-none border-0 focus-visible:ring-0"
                                placeholder="Loading configuration..."
                            />
                            {:else}
                            <div class="min-h-full p-4 font-mono text-xs overflow-auto whitespace-pre-wrap">
                                {#if configState.isFetchingConfig}
                                    <div class="flex items-center justify-center h-full text-muted-foreground">
                                        Loading...
                                    </div>
                                {:else if highlightedJson}
                                    {@html highlightedJson}
                                {:else}
                                    <div class="flex items-center justify-center h-full text-muted-foreground">
                                        No configuration loaded.
                                    </div>
                                {/if}
                            </div>
                            {/if}
                        </ScrollArea>
                    </div>
                </Card.Content>
            </Card.Root>
        </div>
    </div>
</div>
