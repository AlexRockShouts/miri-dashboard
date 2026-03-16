<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { 
        Send, User, Bot, AlertCircle, Loader2, History, ListTodo, Paperclip, X, Activity, Cpu, 
        Lightbulb, Terminal, Brain, Zap, FileText, Trash2, RefreshCw, FolderOpen, 
        MessageSquare, ChevronLeft, Download, FileJson, FileCode, FileImage, 
        FileAudio, FileVideo, FileArchive, File as FileIcon, FileSpreadsheet, FilePieChart,
        PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen
    } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { chatState } from "$lib/state/chat.svelte";
    import Markdown from "$lib/components/chat/markdown.svelte";
    import * as Popover from "$lib/components/ui/popover";
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { buttonVariants } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Label } from "$lib/components/ui/label";
    import { PUBLIC_ACTIVITY_LEVEL } from '$env/static/public';

    let scrollAreaElement = $state<HTMLElement | null>(null);
    let isHistoryOpen = $state(false);
    let isTasksOpen = $state(false);
    let isAgentsOpen = $state(false);
    let selectedAgentId = $state<string | null>(null);
    let isHumanInfoOpen = $state(false);
    let editingHumanInfo = $state("");
    let isSavingHumanInfo = $state(false);
    let fileInput = $state<HTMLInputElement | null>(null);
   	let lastNotifiedAgentId = $state<string | null>(null);
   	let showAgentNotification = $state(false);
   	let completedAgent = $state<any>(null);
    let isSidebarCollapsed = $state(true);
    let isDebugActivity = PUBLIC_ACTIVITY_LEVEL === 'DEBUG';
    let isStatusSidebarCollapsed = $state(!isDebugActivity);

    // New Agent state
    let isNewAgentOpen = $state(false);
    let newAgentGoal = $state("");
    let newAgentRole = $state<"researcher" | "coder" | "reviewer" | "generic">("generic");
    let newAgentModel = $state("");
    let isCreatingAgent = $state(false);


    function formatBytes(bytes: number = 0) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDate(dateStr?: string) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    function getFileIcon(name: string = '', isDir: boolean = false) {
        if (isDir) return FolderOpen;
        
        const ext = name.split('.').pop()?.toLowerCase();
        
        switch (ext) {
            case 'json':
                return FileJson;
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
            case 'py':
            case 'go':
            case 'rust':
            case 'rs':
            case 'c':
            case 'cpp':
            case 'h':
            case 'hpp':
            case 'java':
            case 'kt':
            case 'sh':
            case 'bash':
            case 'yaml':
            case 'yml':
            case 'toml':
            case 'md':
            case 'html':
            case 'css':
                return FileCode;
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'svg':
            case 'webp':
            case 'bmp':
                return FileImage;
            case 'mp3':
            case 'wav':
            case 'ogg':
            case 'm4a':
            case 'flac':
                return FileAudio;
            case 'mp4':
            case 'mov':
            case 'avi':
            case 'wmv':
            case 'webm':
            case 'mkv':
                return FileVideo;
            case 'zip':
            case 'rar':
            case '7z':
            case 'tar':
            case 'gz':
            case 'bz2':
                return FileArchive;
            case 'csv':
            case 'xlsx':
            case 'xls':
            case 'ods':
                return FileSpreadsheet;
            case 'pdf':
                return FileText;
            default:
                return FileIcon;
        }
    }

    function getIconColor(name: string = '', isDir: boolean = false) {
        if (isDir) return "text-blue-500";
        
        const ext = name.split('.').pop()?.toLowerCase();
        
        switch (ext) {
            case 'json':
                return "text-yellow-500";
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
                return "text-amber-400";
            case 'py':
                return "text-blue-400";
            case 'md':
                return "text-blue-300";
            case 'html':
                return "text-orange-500";
            case 'css':
                return "text-blue-500";
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'svg':
                return "text-purple-500";
            case 'mp3':
            case 'wav':
                return "text-pink-500";
            case 'mp4':
            case 'mov':
                return "text-indigo-500";
            case 'zip':
            case 'rar':
            case 'tar':
            case 'gz':
                return "text-orange-400";
            case 'csv':
            case 'xlsx':
                return "text-green-600";
            case 'pdf':
                return "text-red-500";
            default:
                return "text-muted-foreground";
        }
    }

    async function handleDeleteFile(file: any) {
        if (confirm(`Are you sure you want to delete ${file.name}?`)) {
            try {
                await chatState.deleteFile(file.name);
                
                // If we deleted a folder, we might want to navigate back if that folder was special,
                // but usually we just want to refresh the current view.
                // However, the user specifically asked to "navigate back" when deleting.
                // If they delete a directory, let's navigate back to parent.
                if (file.isDir || file['is_dir']) {
                    chatState.goUp();
                } else {
                    await chatState.fetchFiles();
                }
            } catch (e) {
                console.error('UI: Failed to delete file:', e);
                alert('Failed to delete file. Check console for details.');
            }
        }
    }

    function scrollToBottom() {
        if (scrollAreaElement) {
            scrollAreaElement.scrollTop = scrollAreaElement.scrollHeight;
        }
    }

    onMount(() => {
        console.log('--- PROMPT PAGE ONMOUNT START ---');
        chatState.loadFromStorage();
        console.log('Prompt page mounted. Prompt history size:', chatState.promptHistory.length, 'activeTab:', chatState.activeTab);
        chatState.connect();
        chatState.fetchHumanInfo();
        
        // Always fetch files on mount to ensure we have initial state
        console.log('Prompt page onMount: calling fetchFiles');
        chatState.fetchFiles();
        
        if (chatState.sessionId) {
            chatState.fetchSessionStats();
        }
        console.log('--- PROMPT PAGE ONMOUNT END ---');
    });

    $effect(() => {
        if (isHumanInfoOpen && chatState.humanInfo !== null) {
            editingHumanInfo = chatState.humanInfo;
        }
    });

    async function handleSaveHumanInfo() {
        isSavingHumanInfo = true;
        try {
            await chatState.saveHumanInfo(editingHumanInfo);
            isHumanInfoOpen = false;
        } catch (e) {
            alert('Failed to save human info');
        } finally {
            isSavingHumanInfo = false;
        }
    }

    $effect(() => {
        if (chatState.messages.length) {
            // Scroll whenever messages length changes or the last message content changes (for streaming)
            setTimeout(scrollToBottom, 0);
        }
    });

    $effect(() => {
        if (chatState.lastCompletedAgentId && chatState.lastCompletedAgentId !== lastNotifiedAgentId) {
            const agent = chatState.agentMessages.find(a => a.id === chatState.lastCompletedAgentId);
            if (agent) {
                completedAgent = agent;
                lastNotifiedAgentId = agent.id;
                showAgentNotification = true;
                
                // Auto-hide after 10 seconds
                setTimeout(() => {
                    if (lastNotifiedAgentId === agent.id) {
                        showAgentNotification = false;
                    }
                }, 10000);
            }
        }
    });

    async function handleSendMessage() {
        await chatState.sendMessage();
        setTimeout(scrollToBottom, 100);
    }

    async function handleFileChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
            chatState.uploadFile(files[0]);
            target.value = ""; // Clear for next selection
        }
    }

    async function handleCreateAgent() {
        if (!newAgentGoal.trim()) return;
        isCreatingAgent = true;
        try {
            await chatState.createNewAgent(newAgentRole, newAgentGoal, newAgentModel || undefined);
            isNewAgentOpen = false;
            newAgentGoal = "";
            newAgentRole = "generic";
            newAgentModel = "";
        } catch (e) {
            alert('Failed to create agent');
        } finally {
            isCreatingAgent = false;
        }
    }
</script>

<style>
    :global(.user-markdown p, .assistant-markdown p) {
        margin-bottom: 0.25rem !important;
    }
    :global(.status-markdown p, .task-markdown p, .agent-markdown p) {
        margin-bottom: 0.15rem !important;
        line-height: 1.2 !important;
    }
    :global(.status-markdown .my-4, .task-markdown .my-4, .agent-markdown .my-4) {
        margin-top: 0.25rem !important;
        margin-bottom: 0.25rem !important;
    }
    :global(.status-markdown pre, .task-markdown pre, .agent-markdown pre) {
        margin-bottom: 0.25rem !important;
        padding: 0.25rem !important;
    }
</style>

<div class="container mx-auto py-6 px-4 max-w-7xl h-[calc(100vh-3.5rem)] flex flex-col">
    <header class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold tracking-tight text-foreground">Prompt</h1>
            <p class="text-muted-foreground">Interactive session with Miri via WebSockets.</p>
        </div>
        {#if chatState.sessionStats}
            <div class="hidden md:flex items-center gap-4 px-4 py-1.5 bg-muted/30 rounded-full border border-border/50">
                <div class="flex flex-col items-center">
                    <span class="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground leading-none">Tokens</span>
                    <span class="text-xs font-medium tabular-nums text-foreground">{(chatState.sessionStats.total_tokens || 0).toLocaleString()}</span>
                </div>
                <div class="w-px h-6 bg-border/50"></div>
                <div class="flex flex-col items-center">
                    <span class="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground leading-none">Cost</span>
                    <span class="text-xs font-medium tabular-nums text-foreground">${(chatState.sessionStats.total_cost || 0).toFixed(4)}</span>
                </div>
                {#if chatState.isFetchingStats}
                    <Loader2 class="h-3 w-3 animate-spin text-muted-foreground ml-1" />
                {/if}
            </div>
        {/if}
        <div class="flex items-center gap-2">
            <Popover.Root bind:open={isNewAgentOpen}>
                <Popover.Trigger class={buttonVariants({ variant: "outline", size: "sm" }) + " gap-2 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors"}>
                    <Zap class="h-4 w-4" />
                    + Agent
                </Popover.Trigger>
                <Popover.Content class="w-80 p-4" align="end">
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <h4 class="font-medium leading-none text-sm">Create New Agent</h4>
                            <p class="text-xs text-muted-foreground">Define a specialist role and a goal for the new agent.</p>
                        </div>
                        <div class="space-y-3">
                            <div class="grid grid-cols-2 gap-2">
                                <div class="space-y-1">
                                    <Label for="agent-role" class="text-xs">Role / Title</Label>
                                    <select 
                                        id="agent-role" 
                                        class="w-full flex h-8 items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        bind:value={newAgentRole}
                                    >
                                        <option value="generic">Generic</option>
                                        <option value="researcher">Researcher</option>
                                        <option value="coder">Coder</option>
                                        <option value="reviewer">Reviewer</option>
                                    </select>
                                </div>
                                <div class="space-y-1">
                                    <Label for="agent-model" class="text-xs">Model (Optional)</Label>
                                    <Input 
                                        id="agent-model"
                                        placeholder="e.g. gpt-4o"
                                        class="h-8 text-xs px-2"
                                        bind:value={newAgentModel}
                                    />
                                </div>
                            </div>
                            <div class="space-y-1">
                                <Label for="agent-goal" class="text-xs">Goal / Description</Label>
                                <Textarea 
                                    id="agent-goal" 
                                    placeholder="What should this agent do?" 
                                    class="min-h-[100px] text-xs resize-none"
                                    bind:value={newAgentGoal}
                                />
                            </div>
                            <Button 
                                class="w-full text-xs h-8" 
                                disabled={isCreatingAgent || !newAgentGoal.trim()}
                                onclick={handleCreateAgent}
                            >
                                {#if isCreatingAgent}
                                    <Loader2 class="mr-2 h-3 w-3 animate-spin" />
                                    Creating...
                                {:else}
                                    Submit
                                {/if}
                            </Button>
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Root>

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
                    <Popover.Content class="w-80 p-0" align="end">
                        <div class="px-2 py-1.5 border-b bg-muted/50 flex items-center justify-between">
                            <div>
                                <h4 class="font-medium text-[10px]">Async Tasks</h4>
                            </div>
                            <Badge variant="secondary" class="bg-blue-100 text-blue-700 text-[8px] px-1 h-3.5">{chatState.taskMessages.length}</Badge>
                        </div>
                        <ScrollArea class="h-[250px]">
                            <div class="p-0.5 space-y-0.5">
                                {#each chatState.taskMessages.slice().reverse() as task}
                                    <div class="px-1.5 py-1 rounded-[2px] border bg-card text-card-foreground shadow-sm">
                                        <div class="flex items-center justify-between mb-0.5">
                                            <span class="text-[6px] font-bold uppercase tracking-wider text-primary truncate max-w-[150px]">{task.name}</span>
                                            <span class="text-[5px] text-muted-foreground tabular-nums">{task.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    <div class="text-[8px] leading-[1.1] opacity-90 task-markdown">
                                            <Markdown content={task.message} />
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </ScrollArea>
                    </Popover.Content>
                </Popover.Root>
            {/if}

            {#if showAgentNotification && completedAgent}
                <div class="fixed bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Card.Root class="w-72 shadow-lg border-purple-200 bg-purple-50/95 backdrop-blur-sm">
                        <Card.Header class="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
                            <Card.Title class="text-xs font-bold text-purple-700 flex items-center gap-1.5">
                                <Zap class="h-3 w-3" />
                                Agent Completed
                            </Card.Title>
                            <Button variant="ghost" size="icon" class="h-5 w-5 text-purple-400 hover:text-purple-600 hover:bg-purple-100" onclick={() => showAgentNotification = false}>
                                <X class="h-3 w-3" />
                            </Button>
                        </Card.Header>
                        <Card.Content class="p-3 pt-1">
                            <p class="text-[10px] font-medium text-foreground mb-1 truncate">{completedAgent.name}</p>
                            <p class="text-[9px] text-muted-foreground line-clamp-2 mb-2 italic">"{completedAgent.message}"</p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                class="w-full h-7 text-[10px] bg-white border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors"
                                onclick={() => {
                                    isAgentsOpen = true;
                                    selectedAgentId = completedAgent.id;
                                    showAgentNotification = false;
                                }}
                            >
                                View Results
                            </Button>
                        </Card.Content>
                    </Card.Root>
                </div>
            {/if}

            {#if chatState.agentMessages.length > 0}
                <Popover.Root bind:open={isAgentsOpen}>
                    <Popover.Trigger
                        class={buttonVariants({ variant: "outline", size: "sm" }) + " gap-2 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:text-purple-800 transition-colors"}
                        title="Subagents"
                    >
                        <Cpu class="h-4 w-4" />
                        <span class="font-medium">{chatState.agentMessages.filter(a => a.status === 'running').length}</span>
                        <span class="text-xs opacity-70">Agents</span>
                    </Popover.Trigger>
                    <Popover.Content class="w-80 p-0" align="end">
                        <div class="px-2 py-1.5 border-b bg-muted/50 flex items-center justify-between">
                            <div>
                                <h4 class="font-medium text-[10px]">Subagents</h4>
                            </div>
                            <Badge variant="secondary" class="bg-purple-100 text-purple-700 text-[8px] px-1 h-3.5">{chatState.agentMessages.length}</Badge>
                        </div>
                        <ScrollArea class="h-[250px]">
                            <div class="p-0.5 space-y-0.5">
                                {#each chatState.agentMessages.slice().reverse() as agent}
                                    <button 
                                        class="w-full text-left px-1.5 py-1 rounded-[2px] border {agent.color || 'bg-card text-card-foreground'} shadow-sm hover:opacity-80 transition-opacity"
                                        onclick={() => selectedAgentId = selectedAgentId === agent.id ? null : agent.id}
                                    >
                                        <span class="flex items-center justify-between pointer-events-none mb-0.5">
                                            <span class="flex items-center gap-1">
                                                <span class="text-[6px] font-bold uppercase tracking-wider truncate max-w-[150px] {agent.color ? 'text-inherit' : 'text-primary'}">
                                                    {agent.name}
                                                    {#if agent.role && agent.role !== 'generic'}
                                                        <span class="opacity-60 font-normal normal-case ml-1">({agent.role})</span>
                                                    {/if}
                                                </span>
                                                {#if agent.status === 'running'}
                                                    <Loader2 class="h-1 w-1 animate-spin {agent.color ? 'text-inherit' : 'text-purple-600'}" />
                                                {:else if agent.status === 'completed'}
                                                    <span class="h-0.5 w-0.5 rounded-full bg-green-500"></span>
                                                {:else}
                                                    <span class="h-0.5 w-0.5 rounded-full bg-red-500"></span>
                                                {/if}
                                            </span>
                                            <span class="text-[5px] tabular-nums {agent.color ? 'text-inherit opacity-70' : 'text-muted-foreground'}">{agent.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </span>
                                        <span class="text-[8px] block leading-[1.1] truncate pointer-events-none opacity-80 {agent.color ? 'text-inherit' : 'text-muted-foreground'}">
                                            {agent.message}
                                        </span>
                                        {#if selectedAgentId === agent.id}
                                            <span class="mt-0.5 pt-0.5 block border-t text-[8px] bg-muted/30 p-0.5 rounded-[1px] overflow-x-auto agent-markdown">
                                                <Markdown content={agent.result || agent.message} />
                                            </span>
                                        {/if}
                                    </button>
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

    <div class="flex-1 flex gap-6 overflow-hidden">
        <div class="flex flex-col gap-2 pt-2 transition-all duration-300 ease-in-out {isSidebarCollapsed ? 'w-12' : 'w-48'} overflow-hidden border-r pr-4">
            <Button 
                variant={chatState.activeTab === 'chat' ? 'default' : 'ghost'} 
                size={isSidebarCollapsed ? "icon" : "sm"}
                class={isSidebarCollapsed ? "" : "justify-start gap-3 w-full"}
                onclick={() => chatState.activeTab = 'chat'}
                title="Chat"
            >
                <MessageSquare class="h-5 w-5 shrink-0" />
                {#if !isSidebarCollapsed}
                    <span class="font-medium">Chat</span>
                {/if}
            </Button>
            <Button 
                variant={chatState.activeTab === 'files' ? 'default' : 'ghost'} 
                size={isSidebarCollapsed ? "icon" : "sm"}
                class={isSidebarCollapsed ? "" : "justify-start gap-3 w-full"}
                onclick={() => {
                    chatState.activeTab = 'files';
                    chatState.fetchFiles();
                }}
                title="File Manager"
            >
                <FolderOpen class="h-5 w-5 shrink-0" />
                {#if !isSidebarCollapsed}
                    <span class="font-medium whitespace-nowrap">Files</span>
                {/if}
            </Button>

            <div class="mt-auto pb-4">
                <Button 
                    variant="ghost" 
                    size={isSidebarCollapsed ? "icon" : "sm"}
                    class={isSidebarCollapsed ? "w-10 h-10" : "justify-start gap-3 w-full"}
                    onclick={() => isSidebarCollapsed = !isSidebarCollapsed}
                    title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {#if isSidebarCollapsed}
                        <PanelLeftOpen class="h-5 w-5" />
                    {:else}
                        <PanelLeftClose class="h-5 w-5 shrink-0" />
                        <span class="font-medium">Collapse</span>
                    {/if}
                </Button>
            </div>
        </div>

        {#if chatState.activeTab === 'chat'}
            <!-- Main Chat Card (Left now) -->
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
                        <div class="flex flex-col w-full {message.role === 'user' ? 'max-w-[85%] ml-auto items-end' : 'max-w-[95%] mr-auto items-start'}">
                            <div class="flex items-center gap-2 mb-1 px-1">
                                {#if message.role === 'user'}
                                    <span class="text-[10px] font-bold uppercase tracking-tight text-primary/70 italic">You</span>
                                    <User class="h-3 w-3 text-primary/70" />
                                {:else}
                                    <Bot class="h-3 w-3 text-slate-500" />
                                    <span class="text-[10px] font-bold uppercase tracking-tight text-slate-600 italic">Miri</span>
                                {/if}
                            </div>
                            
                            <div class="w-full rounded-lg px-4 py-3 text-xs shadow-sm border-l-2
                                {message.role === 'user' 
                                    ? 'bg-primary/5 border-primary/40 user-markdown' 
                                    : 'bg-card border-slate-300 assistant-markdown'}">
                                <Markdown content={message.content} />
                            </div>
                        </div>
                    </div>
                {/each}

                {#if chatState.isWaiting}
                    <div class="flex justify-start">
                        <div class="flex flex-col w-full max-w-[95%] mr-auto items-start">
                            <div class="flex items-center gap-2 mb-1 px-1">
                                <Bot class="h-3 w-3 text-slate-500" />
                                <span class="text-[10px] font-bold uppercase tracking-tight text-slate-600 italic">Miri</span>
                            </div>
                            
                            <div class="w-full rounded-lg px-4 py-3 bg-card border border-l-2 border-slate-300 shadow-sm text-xs">
                                <div class="flex gap-1 py-1">
                                    <div class="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce"></div>
                                    <div class="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div class="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.4s]"></div>
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
                        class="text-xs"
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

                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        class="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Clear Chat"
                        onclick={() => {
                            if (window.confirm("Are you sure you want to clear the chat? This will reset the current session.")) {
                                chatState.resetState();
                            }
                        }}
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>
                </div>
                <Button type="submit" size="icon" disabled={chatState.isWaiting || (!chatState.inputMessage.trim() && chatState.pendingFiles.length === 0)}>
                    <Send class="h-4 w-4" />
                    <span class="sr-only">Send</span>
                </Button>
            </form>
        </Card.Footer>
            </Card.Root>
        {:else}
            <!-- File Manager Card -->
            <Card.Root class="flex-1 overflow-hidden flex flex-col bg-background border shadow-sm">
                <Card.Header class="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <Card.Title class="text-lg font-semibold flex items-center gap-2">
                            <FileText class="h-5 w-5 text-primary" />
                            File Manager
                            {#if chatState.currentPath}
                                <div class="flex items-center gap-1 text-muted-foreground text-sm font-normal">
                                    <span class="opacity-50">/</span>
                                    <span class="max-w-[150px] truncate">{chatState.currentPath}</span>
                                    <Button variant="ghost" size="icon" class="h-6 w-6 ml-1" onclick={() => chatState.goUp()} title="Go up">
                                        <ChevronLeft class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => chatState.fetchFiles(null)} title="Go to root">
                                        <X class="h-3 w-3" />
                                    </Button>
                                </div>
                            {/if}
                        </Card.Title>
                        <Card.Description class="text-xs">Manage files stored in Miri's local storage.</Card.Description>
                    </div>
                    <Button variant="outline" size="icon" class="h-8 w-8" onclick={() => chatState.fetchFiles()}>
                        <RefreshCw class="h-4 w-4 {chatState.isFetchingFiles ? 'animate-spin' : ''}" />
                    </Button>
                </Card.Header>
                <Card.Content class="p-0 flex-1 min-h-0 overflow-hidden flex flex-col">
                    <ScrollArea class="flex-1 h-full">
                        <Table.Root>
                            <Table.Header class="bg-muted/50 sticky top-0 z-10">
                                <Table.Row>
                                    <Table.Head class="w-[40%] text-xs font-bold">Name</Table.Head>
                                    <Table.Head class="text-xs font-bold text-right">Size</Table.Head>
                                    <Table.Head class="text-xs font-bold text-right">Modified</Table.Head>
                                    <Table.Head class="w-[80px]"></Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {#if chatState.isFetchingFiles && chatState.files.length === 0}
                                    <Table.Row>
                                        <Table.Cell colspan={4} class="h-24 text-center">
                                            <Loader2 class="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </Table.Cell>
                                    </Table.Row>
                                {:else if chatState.files.length === 0}
                                    <Table.Row>
                                        <Table.Cell colspan={4} class="h-24 text-center text-muted-foreground text-xs italic">
                                            <div class="flex flex-col items-center gap-2">
                                                <span>No files found in storage.</span>
                                                <Button variant="ghost" size="sm" class="text-[10px] h-7" onclick={() => chatState.fetchFiles()}>
                                                    <RefreshCw class="h-3 w-3 mr-1" /> Try again
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                {:else}
                                    {#each chatState.files as file (file.name || 'unnamed')}
                                        {@const Icon = getFileIcon(file.name, !!file.isDir)}
                                        {@const iconColor = getIconColor(file.name, !!file.isDir)}
                                        <Table.Row class="hover:bg-muted/30 transition-colors group">
                                            <Table.Cell class="font-medium text-xs">
                                                <div class="flex items-center gap-2">
                                                    <Icon class="h-3.5 w-3.5 {iconColor}" />
                                                    {#if file.isDir}
                                                        <button 
                                                            class="truncate hover:underline text-left" 
                                                            title={file.name}
                                                            onclick={() => {
                                                                const newPath = chatState.currentPath ? `${chatState.currentPath}/${file.name}` : file.name;
                                                                console.log(`UI: Folder clicked. currentPath=${chatState.currentPath}, file.name=${file.name}, newPath=${newPath}`);
                                                                chatState.fetchFiles(newPath);
                                                            }}
                                                        >
                                                            {file.name}
                                                        </button>
                                                    {:else}
                                                        <button 
                                                            class="truncate hover:underline text-left text-primary" 
                                                            title={file.name}
                                                            onclick={() => chatState.downloadFile(file.name || 'unnamed', false)}
                                                        >
                                                            {file.name}
                                                        </button>
                                                    {/if}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell class="text-xs text-right tabular-nums text-muted-foreground">
                                                {formatBytes(file.size)}
                                            </Table.Cell>
                                            <Table.Cell class="text-xs text-right tabular-nums text-muted-foreground">
                                                {formatDate(file.modified)}
                                            </Table.Cell>
                                            <Table.Cell class="text-right">
                                                <div class="flex items-center justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        class="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onclick={() => chatState.downloadFile(file.name || 'unnamed', !!file.isDir)}
                                                        title={file.isDir ? "Zip & Download" : "Download"}
                                                    >
                                                        <Download class="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onclick={() => handleDeleteFile(file)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 class="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    {/each}
                                {/if}
                            </Table.Body>
                        </Table.Root>
                    </ScrollArea>
                </Card.Content>
                <Card.Footer class="py-2 px-4 border-t bg-muted/10">
                    <p class="text-[10px] text-muted-foreground italic">
                        Files can be attached to prompts using the paperclip icon in the chat tab.
                    </p>
                </Card.Footer>
            </Card.Root>
        {/if}

        <!-- Status Card (Right now) -->
        <Card.Root class="transition-all duration-300 ease-in-out {isStatusSidebarCollapsed ? 'w-12' : 'w-80'} flex flex-col bg-muted/20 overflow-hidden border-dashed">
            <div class="flex items-center justify-between p-2 border-b bg-muted/10">
                {#if !isStatusSidebarCollapsed}
                    <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-2">Activity</span>
                {/if}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    class="h-8 w-8 {isStatusSidebarCollapsed ? 'mx-auto' : ''}"
                    onclick={() => isStatusSidebarCollapsed = !isStatusSidebarCollapsed}
                    title={isStatusSidebarCollapsed ? "Expand Activity" : "Collapse Activity"}
                >
                    {#if isStatusSidebarCollapsed}
                        <PanelRightOpen class="h-4 w-4" />
                    {:else}
                        <PanelRightClose class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
            
            <Card.Content class="flex-1 overflow-hidden p-0">
                {#if !isStatusSidebarCollapsed}
                    <ScrollArea class="h-full">
                        <div class="p-4 space-y-4">
                            {#if chatState.statusMessages.length === 0}
                                <div class="flex flex-col items-center justify-center py-10 text-center opacity-40">
                                    <Cpu class="h-8 w-8 mb-2" />
                                    <p class="text-xs">No activity yet</p>
                                </div>
                            {:else}
                                {#each chatState.statusMessages.slice().reverse() as status}
                                    <div class="space-y-1.5 border-l-2 pl-3 py-0.5 
                                        {status.type === 'thought' ? 'border-amber-400' : 
                                         status.type === 'tool' ? 'border-blue-400' : 
                                         status.type === 'tool_result' ? 'border-green-400' : 
                                         status.type === 'skill' ? 'border-purple-400' : 
                                         status.type === 'human' ? 'border-pink-400' : 
                                         status.type === 'action' ? 'border-indigo-400' : 
                                         status.type === 'error' ? 'border-red-500' : 
                                         'border-slate-300'}">
                                      <div class="flex items-center justify-between gap-2">
                                          <div class="flex items-center gap-1.5">
                                              {#if status.type === 'thought'}
                                                  <Lightbulb class="h-3 w-3 text-amber-500" />
                                                  <span class="text-[10px] font-bold uppercase tracking-tight text-amber-600">Thinking</span>
                                              {:else if status.type === 'tool'}
                                                  <Terminal class="h-3 w-3 text-blue-500" />
                                                  <span class="text-[10px] font-bold uppercase tracking-tight text-blue-600">Using Tool</span>
                                              {:else if status.type === 'tool_result'}
                                                  <Activity class="h-3 w-3 text-green-500" />
                                                  <span class="text-[10px] font-bold uppercase tracking-tight text-green-600">Tool Result</span>
                                              {:else if status.type === 'skill'}
                                                  <Cpu class="h-3 w-3 text-purple-500" />
                                                  <span class="text-[10px] font-bold uppercase tracking-tight text-purple-600">Skill</span>
                                              {:else if status.type === 'human'}
                                                  <User class="h-3 w-3 text-pink-500" />
                                                  <span class="text-[10px] font-bold uppercase tracking-tight text-pink-600">Human info</span>
                                              {:else if status.type === 'action'}
                                                   <Zap class="h-3 w-3 text-indigo-500" />
                                                   <span class="text-[10px] font-bold uppercase tracking-tight text-indigo-600">Action</span>
                                               {:else if status.type === 'usage'}
                                                   <Activity class="h-3 w-3 text-slate-500" />
                                                   <span class="text-[10px] font-bold uppercase tracking-tight text-slate-600">Usage</span>
                                               {:else if status.type === 'error'}
                                                   <AlertCircle class="h-3 w-3 text-red-500" />
                                                   <span class="text-[10px] font-bold uppercase tracking-tight text-red-600">Error</span>
                                               {:else}
                                                   <Activity class="h-3 w-3 text-slate-500" />
                                                   <span class="text-[10px] font-bold uppercase tracking-tight text-slate-600">Info</span>
                                               {/if}
                                           </div>
                                           <span class="text-[9px] text-muted-foreground whitespace-nowrap">{status.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                       </div>
                                       {#if isDebugActivity}
                                           <div class="text-xs leading-relaxed text-foreground/80 break-words status-markdown">
                                               <Markdown content={status.content} />
                                           </div>
                                       {/if}
                                   </div>
                                {/each}
                            {/if}
                        </div>
                    </ScrollArea>
                {:else}
                    <div class="h-full flex flex-col items-center pt-8 gap-4 opacity-40">
                        <Activity class="h-5 w-5" />
                        <div class="flex flex-col gap-3">
                            {#if chatState.statusMessages.length > 0}
                                {@const lastStatus = chatState.statusMessages[chatState.statusMessages.length - 1]}
                                {#if lastStatus.type === 'thought'}<Lightbulb class="h-4 w-4 text-amber-500" />
                                {:else if lastStatus.type === 'tool'}<Terminal class="h-4 w-4 text-blue-500" />
                                {:else if lastStatus.type === 'tool_result'}<Activity class="h-4 w-4 text-green-500" />
                                {:else if lastStatus.type === 'error'}<AlertCircle class="h-4 w-4 text-red-500" />
                                {:else}<Cpu class="h-4 w-4 text-slate-500" />{/if}
                            {/if}
                        </div>
                    </div>
                {/if}
            </Card.Content>
            {#if chatState.isWaiting && !isStatusSidebarCollapsed}
                <div class="p-3 bg-primary/5 border-t flex items-center gap-2">
                    <Loader2 class="h-3 w-3 animate-spin text-primary" />
                    <span class="text-[10px] font-medium animate-pulse">Processing...</span>
                </div>
            {:else if chatState.isWaiting && isStatusSidebarCollapsed}
                <div class="p-3 bg-primary/5 border-t flex justify-center">
                    <Loader2 class="h-3 w-3 animate-spin text-primary" />
                </div>
            {/if}
        </Card.Root>
    </div>
</div>
