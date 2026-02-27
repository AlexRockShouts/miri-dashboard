<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { AlertCircle, Loader2, Trash2, Download } from "lucide-svelte";
    import { deserialize } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import type { PageData as SkillsData } from "./$types";
    
    let { data } = $props() as { data: SkillsData };

    let isInstalling = $state<string | null>(null);
    let isRemoving = $state<string | null>(null);

    async function installSkill(skillName: string) {
        isInstalling = skillName;
        const formData = new FormData();
        formData.append('skillName', skillName);

        try {
            const response = await fetch('?/installSkill', {
                method: 'POST',
                body: formData
            });
            const result = deserialize(await response.text());
            if (result.type === 'success') {
                await invalidateAll();
            } else {
                alert("Failed to install skill");
            }
        } catch (e) {
            console.error(e);
        } finally {
            isInstalling = null;
        }
    }

    async function removeSkill(skillName: string) {
        if (!confirm(`Are you sure you want to remove the skill "${skillName}"?`)) return;
        
        isRemoving = skillName;
        const formData = new FormData();
        formData.append('skillName', skillName);

        try {
            const response = await fetch('?/removeSkill', {
                method: 'POST',
                body: formData
            });
            const result = deserialize(await response.text());
            if (result.type === 'success') {
                await invalidateAll();
            } else {
                alert("Failed to remove skill");
            }
        } catch (e) {
            console.error(e);
        } finally {
            isRemoving = null;
        }
    }
</script>

<div class="container mx-auto py-8 px-4">
    <header class="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h1 class="text-4xl font-bold tracking-tight">Skills</h1>
            <p class="text-muted-foreground">Manage capabilities and tools available to Miri.</p>
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
                    Failed to fetch skills from the Miri server.
                </Card.Description>
            </Card.Header>
            <Card.Content>
                <p class="text-sm font-mono bg-destructive/10 p-2 rounded">{data.error}</p>
            </Card.Content>
        </Card.Root>
    {/if}

    <div class="grid gap-6">
        <Card.Root class="flex flex-col h-full">
            <Card.Header>
                <Card.Title>Installed Skills</Card.Title>
                <Card.Description>Capabilities currently available to the agent.</Card.Description>
            </Card.Header>
            <Card.Content class="flex-1">
                {#if data.skills && data.skills.length > 0}
                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {#each data.skills as skill}
                            <div class="p-4 border rounded-lg bg-card/50 flex flex-col justify-between gap-4">
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-bold">{skill.name}</h3>
                                        {#if skill.version}
                                            <Badge variant="secondary" class="text-[10px] px-1.5 py-0">v{skill.version}</Badge>
                                        {/if}
                                    </div>
                                    <p class="text-xs text-muted-foreground leading-relaxed">{skill.description || 'No description provided.'}</p>
                                    <div class="flex flex-wrap gap-1 mt-2">
                                        {#each (skill.tags || []) as tag}
                                            <Badge variant="outline" class="text-[10px] px-1.5 py-0 font-normal">{tag}</Badge>
                                        {/each}
                                    </div>
                                </div>
                                <div class="flex justify-end">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        class="text-destructive hover:bg-destructive/10 shrink-0"
                                        disabled={isRemoving === skill.name}
                                        onclick={() => skill.name && removeSkill(skill.name)}
                                    >
                                        {#if isRemoving === skill.name}
                                            <Loader2 class="h-4 w-4 animate-spin" />
                                        {:else}
                                            <Trash2 class="h-4 w-4" />
                                        {/if}
                                    </Button>
                                </div>
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
    </div>
</div>
