<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from "$lib/components/ui/button";
	import { MessageSquare, LayoutDashboard } from "lucide-svelte";
	import { page } from "$app/state";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<nav class="border-b bg-background/95 backdrop-blur">
		<div class="container mx-auto flex h-14 items-center gap-4 px-4">
			<a href="/" class="flex items-center gap-2 font-bold text-xl mr-4">
				<span class="text-primary italic">Miri</span>
			</a>
			<div class="flex items-center gap-2">
				<Button
					variant={page.url.pathname.startsWith('/prompt') ? "default" : "ghost"}
					size="sm"
					class="gap-2"
					href="/prompt"
				>
					<MessageSquare class="h-4 w-4" />
					Prompt
				</Button>
				<Button
					variant={page.url.pathname.startsWith('/admin') ? "default" : "ghost"}
					size="sm"
					class="gap-2"
					href="/admin"
				>
					<LayoutDashboard class="h-4 w-4" />
					Admin
				</Button>
			</div>
		</div>
	</nav>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
