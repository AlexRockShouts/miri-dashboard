<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    onMount(() => {
        goto('/prompt');
    });
</script>

<div class="flex items-center justify-center h-[calc(100vh-3.5rem)]">
    <p class="text-muted-foreground animate-pulse">Redirecting to Prompt...</p>
</div>
