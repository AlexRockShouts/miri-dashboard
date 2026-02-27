<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Card from "$lib/components/ui/card";
    import { Send, User, Bot, AlertCircle, Loader2, History } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { chatState } from "$lib/state/chat.svelte";
    import Markdown from "$lib/components/chat/markdown.svelte";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
    import { buttonVariants } from "$lib/components/ui/button/index.js";

    let scrollAreaElement = $state<HTMLElement | null>(null);
    let isHistoryOpen = $state(false);

    function scrollToBottom() {
        if (scrollAreaElement) {
            scrollAreaElement.scrollTop = scrollAreaElement.scrollHeight;
        }
    }

    onMount(() => {
        console.log('Prompt page mounted');
        chatState.connect();
    });

    $effect(() => {
        if (chatState.messages.length) {
            // Scroll whenever messages length changes or the last message content changes (for streaming)
            const lastMessage = chatState.messages[chatState.messages.length - 1];
            const _trigger = lastMessage.content;
            const _isWaiting = chatState.isWaiting;
            
            setTimeout(scrollToBottom, 0);
        }
    });

    async function handleSendMessage() {
        await chatState.sendMessage();
        setTimeout(scrollToBottom, 100);
    }
</script>

<div class="container mx-auto py-6 px-4 w-[70vw] max-w-full h-[calc(100vh-3.5rem)] flex flex-col">
    <header class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight text-foreground">Prompt</h1>
            <p class="text-muted-foreground">Interactive session with Miri via WebSockets.</p>
        </div>
        <div class="flex items-center gap-2">
            {#if chatState.isConnected}
                <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200 gap-1.5 px-3 py-1">
                    <div class="h-2 w-2 rounded-full bg-green-500"></div>
                    Connected
                </Badge>
            {:else}
                <Badge variant="destructive" class="gap-1.5 px-3 py-1">
                    <AlertCircle class="h-4 w-4" />
                    Disconnected
                </Badge>
            {/if}
        </div>
    </header>

    <Card.Root class="flex-1 overflow-hidden flex flex-col bg-muted/30">
        <div class="flex-1 overflow-y-auto p-4" bind:this={scrollAreaElement}>
            <div class="space-y-4">
                {#if chatState.messages.length === 0}
                    <div class="h-full flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
                        <Bot class="h-12 w-12 mb-4 opacity-20" />
                        <h2 class="text-xl font-semibold text-foreground mb-2">Miri</h2>
                        <p class="max-w-xs">Hey. Search skills (/learn), create one, or project help?</p>
                    </div>
                {/if}

                {#each chatState.messages as message}
                    <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                        <div class="flex gap-3 max-w-[80%] {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}">
                            <div class="h-8 w-8 rounded-full flex items-center justify-center shrink-0 
                                {message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border'}">
                                {#if message.role === 'user'}
                                    <User class="h-4 w-4" />
                                {:else}
                                    <Bot class="h-4 w-4" />
                                {/if}
                            </div>
                            <div class="rounded-2xl px-4 py-2 text-sm shadow-sm
                                {message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'}">
                                {#if message.role === 'user'}
                                    <p class="whitespace-pre-wrap">{message.content}</p>
                                {:else}
                                    <Markdown content={message.content} />
                                {/if}
                            </div>
                        </div>
                    </div>
                {/each}

                {#if chatState.isWaiting}
                    <div class="flex justify-start">
                        <div class="flex gap-3 max-w-[80%]">
                            <div class="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-muted border">
                                <Bot class="h-4 w-4" />
                            </div>
                            <div class="rounded-2xl px-4 py-2 text-sm shadow-sm bg-card border flex flex-col gap-1.5">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-medium text-muted-foreground animate-pulse">Miri is thinking</span>
                                    <div class="flex gap-1">
                                        <div class="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                        <div class="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                        <div class="h-1 w-1 rounded-full bg-primary animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <Card.Footer class="p-4 bg-background border-t">
            <form 
                onsubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                class="flex w-full items-center space-x-2"
            >
                <div class="flex-1 flex gap-2">
                    <Input 
                        type="text" 
                        placeholder={chatState.isConnected ? "Type your prompt here..." : chatState.useSSE ? "Type your prompt here (via SSE)..." : "Connecting..."}
                        bind:value={chatState.inputMessage}
                        disabled={chatState.isWaiting}
                        autocomplete="off"
                    />

                    <Popover.Root bind:open={isHistoryOpen}>
                        <Popover.Trigger
                            class={buttonVariants({ variant: "outline", size: "icon" }) + " shrink-0"}
                            title="Prompt History"
                            disabled={chatState.promptHistory.length === 0}
                        >
                            <History class="h-4 w-4" />
                        </Popover.Trigger>
                        <Popover.Content class="w-80 p-0" align="end">
                            <div class="p-3 border-b bg-muted/50">
                                <h4 class="font-medium text-sm">Prompt History</h4>
                                <p class="text-xs text-muted-foreground">Select a previous prompt</p>
                            </div>
                            <ScrollArea class="h-64">
                                <div class="p-1">
                                    {#each chatState.promptHistory as prompt}
                                        <button 
                                            class="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors line-clamp-2"
                                            onclick={() => {
                                                chatState.inputMessage = prompt;
                                                isHistoryOpen = false;
                                            }}
                                            title={prompt}
                                        >
                                            {prompt}
                                        </button>
                                    {/each}
                                </div>
                            </ScrollArea>
                        </Popover.Content>
                    </Popover.Root>
                </div>
                <Button type="submit" size="icon" disabled={chatState.isWaiting || !chatState.inputMessage.trim()}>
                    <Send class="h-4 w-4" />
                    <span class="sr-only">Send</span>
                </Button>
            </form>
        </Card.Footer>
    </Card.Root>
</div>
