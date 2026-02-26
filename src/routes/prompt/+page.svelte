<script lang="ts">
	import { onMount } from 'svelte';
 import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
	import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Card from "$lib/components/ui/card";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { Send, User, Bot, AlertCircle, Loader2 } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";

    let { data } = $props();
    let socket: WebSocket | null = null;
    let clientId = $state("");
    let inputMessage = $state("");
    let messages = $state<{ role: 'user' | 'assistant', content: string }[]>([]);
    let isConnected = $state(false);
    let isWaiting = $state(false);
    let scrollAreaElement = $state<HTMLElement | null>(null);
    let currentAssistantMessage = $state("");

    // Fallback flag when WS is unavailable or rejected by auth
    let useSSE = $state(false);

    function processMessage(data: string) {
        if (!data) return;
        
        // Miri's WebSocket/SSE might send JSON or raw text.
        let content = "";
        try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
                content = parsed.content;
            } else if (parsed.response) {
                content = parsed.response;
            } else if (typeof parsed === 'string') {
                content = parsed;
            } else if (parsed.error) {
                console.error('Server error:', parsed.error);
                content = `Error: ${parsed.error}`;
            }
        } catch (e) {
            // If not JSON, it might be raw string fragment
            content = data;
        }

        if (content) {
            currentAssistantMessage += content;
            
            // Update the last assistant message or push a new one
            if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                messages[messages.length - 1].content = currentAssistantMessage;
            } else {
                messages.push({ role: 'assistant', content: currentAssistantMessage });
            }
            
            // Scroll to bottom on new content
            setTimeout(scrollToBottom, 0);
        }
    }

	async function connect() {
		let serverUrl = PUBLIC_MIRI_SERVER_URL;
		if (serverUrl.endsWith('/')) {
			serverUrl = serverUrl.slice(0, -1);
		}
		const wsProtocol = serverUrl.startsWith('https:') ? 'wss:' : 'ws:';
		const wsBase = serverUrl.replace(/^https?:\/\//, '');

		const wsUrl = `${wsProtocol}//${wsBase}/ws?client_id=${clientId}&stream=true`;

		// 1. Connect with sub-protocols as a way to pass the header in the Upgrade request.
		// Browsers do not allow custom headers on native WebSockets, so we use
		// the standard 'Sec-WebSocket-Protocol' header as a workaround.
		// The middleware expects two sub-protocols: "miri-key" and the key itself.
		// We ensure the key is passed as a separate token.
		const protocols = ["miri-key", PUBLIC_MIRI_SERVER_KEY];
		console.log('Connecting WebSocket:', {
            url: wsUrl,
            protocols: protocols,
            serverUrl: PUBLIC_MIRI_SERVER_URL,
            serverKey: PUBLIC_MIRI_SERVER_KEY ? 'present' : 'missing'
        });
		const fullWsUrl = `${wsUrl}&token=${encodeURIComponent(PUBLIC_MIRI_SERVER_KEY || '')}`;
		socket = new WebSocket(fullWsUrl, protocols);

		socket.onopen = () => {
            console.log('WebSocket connected');
            isConnected = true;
        };

        socket.onmessage = (event) => {
            let data = event.data;
            console.log('WS message received:', data);
            isWaiting = false;
            
            // Handle binary data if it's sent as Blob/ArrayBuffer
            if (data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                    processMessage(reader.result as string);
                };
                reader.readAsText(data);
            } else {
                processMessage(data);
            }
        };


        socket.onclose = (ev) => {
            console.log('WebSocket disconnected', { code: ev?.code, reason: ev?.reason, wasClean: ev?.wasClean });
            isConnected = false;
            // If we never connected successfully, enable SSE fallback
            if (!useSSE && (!ev || ev.code >= 400 || ev.code === 1006)) {
                console.warn('Enabling SSE fallback for prompt streaming');
                useSSE = true;
            }
            setTimeout(connect, 3000); // Reconnect after 3 seconds
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            isConnected = false;
            if (!useSSE) {
                console.warn('Enabling SSE fallback due to WS error');
                useSSE = true;
            }
        };
    }

    onMount(() => {
        // Initialize or retrieve clientId from localStorage
        clientId = localStorage.getItem('miri_client_id') || "";
        if (!clientId) {
            clientId = crypto.randomUUID();
            localStorage.setItem('miri_client_id', clientId);
        }

        connect();
        return () => {
            socket?.close();
        };
    });

    async function sendMessage() {
        if (!inputMessage.trim()) return;

        const userMsg = inputMessage;
        messages.push({ role: 'user', content: userMsg });
        
        // Reset assistant state for new response
        currentAssistantMessage = "";
        isWaiting = true;

        // Prefer WebSocket when available and open, otherwise fallback to SSE via fetch streaming
        if (!useSSE && socket && socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ prompt: userMsg });
            console.log('Sending WS message:', message);
            socket.send(message);
        } else {
            console.log('Sending via SSE fallback');
            await streamViaSSE(userMsg);
        }
        
        inputMessage = "";
        
        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
    }

    async function streamViaSSE(prompt: string) {
        try {
            let serverUrl = PUBLIC_MIRI_SERVER_URL;
            if (serverUrl.endsWith('/')) serverUrl = serverUrl.slice(0, -1);
            const url = new URL(`${serverUrl}/api/v1/prompt/stream`);
            url.searchParams.set('prompt', prompt);

            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream',
                    'X-Server-Key': PUBLIC_MIRI_SERVER_KEY
                }
            });

            if (!res.ok || !res.body) {
                throw new Error(`SSE request failed: ${res.status} ${res.statusText}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // Parse SSE lines: events usually of form "data: <chunk>\n\n"
                let idx;
                while ((idx = buffer.indexOf('\n\n')) !== -1) {
                    const chunk = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    for (const line of chunk.split('\n')) {
                        if (line.startsWith('data:')) {
                            const payload = line.slice(5).trimStart();
                            // Reuse processMessage to unify handling
                            processMessage(payload);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('SSE streaming error:', err);
        } finally {
            isWaiting = false;
        }
    }

    function scrollToBottom() {
        if (scrollAreaElement) {
            scrollAreaElement.scrollTop = scrollAreaElement.scrollHeight;
        }
    }

    $effect(() => {
        if (messages.length) {
            scrollToBottom();
        }
    });
</script>

<div class="container mx-auto py-6 px-4 max-w-4xl h-[calc(100vh-3.5rem)] flex flex-col">
    <header class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight">Prompt</h1>
            <p class="text-muted-foreground">Interactive session with Miri via WebSockets.</p>
        </div>
        <div class="flex items-center gap-2">
            {#if isConnected}
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
                {#if messages.length === 0}
                    <div class="h-full flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
                        <Bot class="h-12 w-12 mb-4 opacity-20" />
                        <p>No messages yet. Start a conversation!</p>
                    </div>
                {/if}

                {#each messages as message}
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
                                <p class="whitespace-pre-wrap">{message.content}</p>
                            </div>
                        </div>
                    </div>
                {/each}

                {#if isWaiting}
                    <div class="flex justify-start">
                        <div class="flex gap-3 max-w-[80%]">
                            <div class="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-muted border">
                                <Bot class="h-4 w-4" />
                            </div>
                            <div class="rounded-2xl px-4 py-2 text-sm shadow-sm bg-card border flex items-center gap-2">
                                <Loader2 class="h-3 w-3 animate-spin" />
                                <span class="animate-pulse">Miri is thinking...</span>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <Card.Footer class="p-4 bg-background border-t">
            <form 
                onsubmit={(e) => { e.preventDefault(); sendMessage(); }}
                class="flex w-full items-center space-x-2"
            >
                <Input 
                    type="text" 
                    placeholder={isConnected ? "Type your prompt here..." : useSSE ? "Type your prompt here (via SSE)..." : "Connecting..."}
                    bind:value={inputMessage}
                    disabled={isWaiting}
                    autocomplete="off"
                />
                <Button type="submit" size="icon" disabled={isWaiting || !inputMessage.trim()}>
                    <Send class="h-4 w-4" />
                    <span class="sr-only">Send</span>
                </Button>
            </form>
        </Card.Footer>
    </Card.Root>
</div>
