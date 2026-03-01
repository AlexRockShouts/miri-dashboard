<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Card from "$lib/components/ui/card";
    import { Send, User, Bot, AlertCircle, Loader2, History, ListTodo, Paperclip, X } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { chatState } from "$lib/state/chat.svelte";
    import Markdown from "$lib/components/chat/markdown.svelte";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
    import { buttonVariants } from "$lib/components/ui/button/index.js";

    let scrollAreaElement = $state<HTMLElement | null>(null);
    let isHistoryOpen = $state(false);
    let isTasksOpen = $state(false);
    let fileInput = $state<HTMLInputElement | null>(null);

    function scrollToBottom() {
        if (scrollAreaElement) {
            scrollAreaElement.scrollTop = scrollAreaElement.scrollHeight;
        }
    }

    onMount(() => {
        chatState.loadFromStorage();
        console.log('Prompt page mounted. Prompt history size:', chatState.promptHistory.length);
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

    function handleFileChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
            chatState.uploadFile(files[0]);
            target.value = ""; // Clear for next selection
        }
    }
</script>

<div class="container mx-auto py-6 px-4 w-[70vw] max-w-full h-[calc(100vh-3.5rem)] flex flex-col">
    <header class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight text-foreground">Prompt</h1>
            <p class="text-muted-foreground">Interactive session with Miri via WebSockets.</p>
        </div>
        <div class="flex items-center gap-2">
            {#if chatState.taskMessages.length > 0}
                <Popover.Root bind:open={isTasksOpen}>
                    <Popover.Trigger
                        class={buttonVariants({ variant: "outline", size: "sm" }) + " gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition-colors"}
                        title="Async Tasks"
                    >
                        <ListTodo class="h-4 w-4" />
                        <span class="font-medium">{chatState.taskMessages.length}</span>
                        <span class="text-xs opacity-70">Tasks</span>
                    </Popover.Trigger>
                    <Popover.Content class="w-96 p-0" align="end">
                        <div class="p-3 border-b bg-muted/50 flex items-center justify-between">
                            <div>
                                <h4 class="font-medium text-sm">Async Tasks</h4>
                                <p class="text-xs text-muted-foreground">Received background task reports</p>
                            </div>
                            <Badge variant="secondary" class="bg-blue-100 text-blue-700">{chatState.taskMessages.length}</Badge>
                        </div>
                        <ScrollArea class="h-[400px]">
                            <div class="p-2 space-y-2">
                                {#each chatState.taskMessages.slice().reverse() as task}
                                    <div class="p-3 rounded-lg border bg-card text-card-foreground shadow-sm space-y-1">
                                        <div class="flex items-center justify-between">
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-primary">{task.name}</span>
                                            <span class="text-[9px] text-muted-foreground">{task.timestamp.toLocaleTimeString()}</span>
                                        </div>
                                        <div class="text-xs leading-relaxed whitespace-pre-wrap">
                                            {task.message}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </ScrollArea>
                    </Popover.Content>
                </Popover.Root>
            {/if}

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

        <Card.Footer class="p-4 bg-background border-t flex flex-col gap-3">
            {#if chatState.pendingFiles.length > 0}
                <div class="flex flex-wrap gap-2 w-full">
                    {#each chatState.pendingFiles as filename, i}
                        <Badge variant="secondary" class="gap-1 pl-2 pr-1 py-1">
                            <span class="text-xs">{filename}</span>
                            <button 
                                class="hover:bg-muted rounded-full p-0.5"
                                onclick={() => chatState.pendingFiles.splice(i, 1)}
                            >
                                <X class="h-3 w-3" />
                            </button>
                        </Badge>
                    {/each}
                </div>
            {/if}

            <form 
                onsubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                class="flex w-full items-center space-x-2"
            >
                <div class="flex-1 flex gap-2">
                    <input 
                        type="file" 
                        class="hidden" 
                        bind:this={fileInput} 
                        onchange={handleFileChange}
                    />
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        class="shrink-0"
                        title="Upload File"
                        disabled={chatState.isUploading || chatState.isWaiting}
                        onclick={() => fileInput?.click()}
                    >
                        {#if chatState.isUploading}
                            <Loader2 class="h-4 w-4 animate-spin" />
                        {:else}
                            <Paperclip class="h-4 w-4" />
                        {/if}
                    </Button>

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
                <Button type="submit" size="icon" disabled={chatState.isWaiting || (!chatState.inputMessage.trim() && chatState.pendingFiles.length === 0)}>
                    <Send class="h-4 w-4" />
                    <span class="sr-only">Send</span>
                </Button>
            </form>
        </Card.Footer>
    </Card.Root>
</div>
