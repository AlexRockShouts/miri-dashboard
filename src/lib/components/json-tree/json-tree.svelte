<script lang="ts">
    import { ChevronDown, ChevronRight } from "lucide-svelte";
    import JsonTree from "./json-tree.svelte";

    let { value, key = undefined, depth = 0, defaultExpandedLevel = 1 } = $props<{
        value: any;
        key?: string;
        depth?: number;
        defaultExpandedLevel?: number;
    }>();

    let expanded = $state(depth < defaultExpandedLevel);

    function toggle() {
        expanded = !expanded;
    }

    const type = $derived(value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
    const isExpandable = $derived(type === 'object' || type === 'array');

    const displayValue = $derived.by(() => {
        if (type === 'string') {
            // Check if it's a date
            if (value.length > 10 && !isNaN(Date.parse(value))) {
                return `"${value}" (Date)`;
            }
            return `"${value}"`;
        }
        if (type === 'null') return 'null';
        if (isExpandable) {
            if (type === 'array') return `Array(${value.length})`;
            return 'Object';
        }
        return String(value);
    });

    const typeClass = $derived.by(() => {
        if (type === 'string') return 'text-green-600 dark:text-green-400';
        if (type === 'number') return 'text-blue-600 dark:text-blue-400';
        if (type === 'boolean') return 'text-purple-600 dark:text-purple-400';
        if (type === 'null') return 'text-gray-500';
        return 'text-muted-foreground';
    });
</script>

<div class="font-mono text-xs leading-5">
    <div class="flex items-start group">
        {#if isExpandable}
            <button 
                onclick={toggle} 
                class="mt-1 p-0.5 hover:bg-muted rounded transition-colors mr-0.5 shrink-0"
            >
                {#if expanded}
                    <ChevronDown class="h-3 w-3" />
                {:else}
                    <ChevronRight class="h-3 w-3" />
                {/if}
            </button>
        {:else}
            <div class="w-4 mr-0.5 shrink-0"></div>
        {/if}

        <div class="flex flex-wrap items-baseline gap-x-1.5">
            {#if key !== undefined}
                <span class="text-indigo-600 dark:text-indigo-400 font-semibold">{key}:</span>
            {/if}
            
            <span class={typeClass}>{displayValue}</span>
        </div>
    </div>

    {#if isExpandable && expanded}
        <div class="ml-4 border-l border-muted-foreground/20 pl-2 mt-0.5">
            {#if type === 'array'}
                {#each value as item, i}
                    <JsonTree value={item} key={String(i)} depth={depth + 1} {defaultExpandedLevel} />
                {/each}
            {:else}
                {#each Object.entries(value) as [k, v]}
                    <JsonTree value={v} key={k} depth={depth + 1} {defaultExpandedLevel} />
                {/each}
            {/if}
        </div>
    {/if}
</div>
