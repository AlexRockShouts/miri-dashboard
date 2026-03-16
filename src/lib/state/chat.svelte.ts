import { DefaultApi, Configuration, ApiV1InteractionPostRequestActionEnum, SpawnSubAgentRequestRoleEnum, type Config, type FileInfo, type ApiAdminV1SessionsIdStatsGet200Response, type Message as MiriMessage, type Session as MiriSession, type PaginatedHistory, type Human } from '@alexrockshouts/miri-sdk';

const PUBLIC_MIRI_SERVER_URL = import.meta.env.PUBLIC_MIRI_SERVER_URL ?? 'http://localhost:8080';
const PUBLIC_MIRI_SERVER_KEY = import.meta.env.PUBLIC_MIRI_SERVER_KEY ?? 'local-dev-key';

console.log('ChatState file loaded at:', new Date().toISOString(), 'with PUBLIC_MIRI_SERVER_URL:', PUBLIC_MIRI_SERVER_URL);

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface TaskMessage {
    id: string;
    name: string;
    message: string;
    timestamp: Date;
}

export interface AgentMessage {
    id: string;
    name: string;
    role?: string;
    status: 'running' | 'completed' | 'failed';
    message: string;
    result?: string;
    timestamp: Date;
    color?: string;
}

class ChatState {
    socket: WebSocket | null = $state(null);
    sessionId = $state("");
    inputMessage = $state("");
    messages = $state<Message[]>([]);
    taskMessages = $state<TaskMessage[]>([]);
    agentMessages = $state<AgentMessage[]>([]);
    isConnected = $state(false);
    isWaiting = $state(false);
    isStreaming = $state(false);
    isNewCommandPending = $state(false);
    currentAssistantMessage = $state("");
    useSSE = $state(false);
    promptHistory = $state<string[]>([]);
    pendingFiles = $state<string[]>([]);
    isUploading = $state(false);
    statusMessages = $state<{type: string, content: string, timestamp: Date}[]>([]);
    lastCompletedAgentId = $state<string | null>(null);
    humanInfo = $state<string | null>(null);
    isFetchingHumanInfo = $state(false);
    files = $state<FileInfo[]>([]);
    currentPath = $state<string | null>(null);
    isFetchingFiles = $state(false);
    sessionStats = $state<ApiAdminV1SessionsIdStatsGet200Response | null>(null);
    isFetchingStats = $state(false);
    _activeTab = $state<"chat" | "files">("chat");

    get activeTab() {
        return this._activeTab;
    }

    set activeTab(val: "chat" | "files") {
        this._activeTab = val;
        if (typeof window !== 'undefined') {
            localStorage.setItem('miri_active_tab', val);
        }
    }

    constructor() {
        if (typeof window !== 'undefined') {
            this.loadFromStorage();
        }
    }

    private getApi() {
        try {
            // In development, prioritize .env credentials if available via SvelteKit's public variables
            // or use standard fallbacks.
            const user = 'admin';
            const pass = PUBLIC_MIRI_SERVER_KEY;

            // Encode basic auth credentials
            const basicAuth = btoa(`${user}:${pass}`);
            console.log(`[ChatState] getApi: using user=${user}, pass=${pass.substring(0, 3)}..., auth=${basicAuth.substring(0, 10)}...`);
            console.log(`[ChatState] getApi: URL=${PUBLIC_MIRI_SERVER_URL}, ServerKey=${PUBLIC_MIRI_SERVER_KEY}`);
            
            const config = new Configuration({
                basePath: PUBLIC_MIRI_SERVER_URL,
                apiKey: PUBLIC_MIRI_SERVER_KEY,
                username: user,
                password: pass,
                baseOptions: {
                    headers: {
                        'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
                        'Authorization': `Basic ${basicAuth}`
                    }
                }
            });
            const api = new DefaultApi(config);
            
            // Log outgoing requests for visibility
            const axiosInstance = (api as any).axios || (api as any).axiosInstance;
            if (axiosInstance && !axiosInstance.interceptors.request.handlers.length) {
                axiosInstance.interceptors.request.use((config: any) => {
                    console.log(`API [${config.method?.toUpperCase()}] ${config.url}`, {
                        params: config.params,
                        data: config.data,
                        headers: config.headers
                    });
                    return config;
                });
            }

            return api;
        } catch (err) {
            console.error('Failed to initialize API client:', err);
            throw err;
        }
    }

    async fetchHumanInfo() {
        this.isFetchingHumanInfo = true;
        try {
            const api = this.getApi();
            const res = await api.apiAdminV1HumanGet();
            this.humanInfo = res.data.content || "";
        } catch (e) {
            // Silently handle 404 as the endpoint might be removed in some server versions
            // but we keep the logic as requested.
            if ((e as any)?.response?.status !== 404) {
                console.error('Failed to fetch human info:', e);
            }
        } finally {
            this.isFetchingHumanInfo = false;
        }
    }


    async saveHumanInfo(content: string) {
        try {
            const api = this.getApi();
            await api.apiAdminV1HumanPost({ content });
            this.humanInfo = content;
        } catch (e) {
            console.error('Failed to save human info:', e);
            throw e;
        }
    }

    async fetchFiles(path?: string | null) {
        this.isFetchingFiles = true;
        // If path is explicitly null or a string, update currentPath.
        // If path is undefined (e.g. refresh or onMount), keep existing currentPath.
        if (path !== undefined) {
            this.currentPath = path || null;
        }
        
        try {
            // Normalize path: avoid leading slash as it might cause 403 or 404 on some servers
            let fetchPath = this.currentPath || undefined;
            if (fetchPath && fetchPath.startsWith('/')) {
                fetchPath = fetchPath.substring(1);
            }
            
            console.log('ChatState: fetchFiles calling apiV1FilesGet with path:', fetchPath || 'root');
            const api = this.getApi();
            const res = await api.apiV1FilesGet(fetchPath);
            console.log('ChatState: apiV1FilesGet returned:', res.status, res.data);
            
            if (res.data && Array.isArray(res.data.files)) {
                this.files = res.data.files;
            } else if (Array.isArray(res.data)) {
                // Fallback if SDK type is wrong and it returns array directly
                this.files = res.data;
            } else if (res.data && (res.data as any).file_info) {
                // Single file info returned
                this.files = [(res.data as any).file_info];
            } else if (res.data && (res.data as any).data && Array.isArray((res.data as any).data)) {
                // Another common pattern: { data: [...] }
                this.files = (res.data as any).data;
            } else {
                console.warn('ChatState: apiV1FilesGet returned unexpected data structure:', res.data);
                this.files = [];
            }
            
            // Normalize file objects to ensure isDir and name exist
            this.files = this.files.map(f => {
                if (f && typeof f === 'object') {
                    // Normalize path: some APIs return full path, some only name.
                    // We want name to be the basename.
                    const originalName = f.name || (f as any).filename || (f as any).path?.split('/').pop() || 'unnamed';
                    f.name = originalName;

                    // Property fallbacks for isDir
                    if (f.isDir === undefined) {
                        (f as any).isDir = (f as any).is_dir || (f as any).is_directory || (f as any).type === 'directory';
                    }
                }
                return f;
            });
            
            console.log('ChatState: this.files updated with:', this.files.length, 'items');
            
            if (typeof window !== 'undefined') {
                localStorage.setItem('miri_files', JSON.stringify(this.files));
                if (this.currentPath) {
                    localStorage.setItem('miri_current_path', this.currentPath);
                } else {
                    localStorage.removeItem('miri_current_path');
                }
            }
            
            if (this.sessionId) {
                this.fetchSessionStats();
            }
        } catch (e: any) {
            console.error('ChatState: Failed to fetch files:', e);
        } finally {
            this.isFetchingFiles = false;
        }
    }

    goUp() {
        if (!this.currentPath) return;
        
        const parts = this.currentPath.split('/').filter(Boolean);
        if (parts.length <= 1) {
            this.fetchFiles(null);
        } else {
            parts.pop();
            this.fetchFiles(parts.join('/'));
        }
    }

    async fetchSessionStats() {
        if (!this.sessionId) return;
        this.isFetchingStats = true;
        try {
            const api = this.getApi();
            const res = await api.apiAdminV1SessionsIdStatsGet(this.sessionId);
            this.sessionStats = res.data;
        } catch (e: any) {
            console.error('Failed to fetch session stats:', e);
            if (e.response) {
                console.error("[ChatState] Stats error response data:", e.response.data);
                console.error("[ChatState] Stats error response status:", e.response.status);
            }
        } finally {
            this.isFetchingStats = false;
        }
    }

    async sendStatusInteraction() {
        try {
            const api = this.getApi();
            await api.apiV1InteractionPost({
                action: ApiV1InteractionPostRequestActionEnum.Status
            });
        } catch (e) {
            console.error('Failed to send status interaction:', e);
        }
    }

    async downloadFile(name: string, isDir: boolean = false) {
        try {
            const api = this.getApi();
            // Ensure path is clean (no double slashes, no leading slash)
            let fullPath = this.currentPath ? `${this.currentPath}/${name}` : name;
            fullPath = fullPath.replace(/\/+/g, '/').replace(/^\//, '');
            
            console.log(`[ChatState] Downloading ${isDir ? 'directory' : 'file'}: ${fullPath}`);
            
            // Note: SDK's apiV1FilesFilepathGet uses encodeURIComponent for the filepath,
            // which encodes slashes as %2F. If the server expects raw slashes, 
            // this might fail for nested files.
            const response = await api.apiV1FilesFilepathGet(fullPath, false, isDir, {
                responseType: 'blob'
            } as any);

            const responseData = response.data as any;
            console.log(`[ChatState] Received ${isDir ? 'directory' : 'file'} data, size: ${responseData.size || responseData.length || 'unknown'}, type: ${responseData.type || typeof responseData}`);
            
            const blob = new Blob([responseData], { type: isDir ? 'application/zip' : 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            let downloadName = name;
            if (isDir && !downloadName.toLowerCase().endsWith('.zip')) {
                downloadName = `${downloadName}.zip`;
            }
            link.setAttribute('download', downloadName);
            
            document.body.appendChild(link);
            link.click();
            
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            console.log(`[ChatState] Download started for: ${fullPath}${isDir ? ' as ZIP' : ''}`);
        } catch (error: any) {
            console.error(`[ChatState] Error downloading ${isDir ? 'directory' : 'file'}:`, error);
            if (error.response) {
                console.error("[ChatState] Error response data:", error.response.data);
                console.error("[ChatState] Error response status:", error.response.status);
            }
        }
    }

    async deleteFile(name: string) {
        try {
            const api = this.getApi();
            // Ensure path is clean
            let fullPath = this.currentPath ? `${this.currentPath}/${name}` : name;
            fullPath = fullPath.replace(/\/+/g, '/').replace(/^\//, '');
            
            console.log(`[ChatState] Deleting file: ${fullPath}`);
            
            await api.apiV1FilesDelete({ path: fullPath });
            this.files = this.files.filter(f => f.name !== name);
            if (typeof window !== 'undefined') {
                localStorage.setItem('miri_files', JSON.stringify(this.files));
            }
            console.log(`[ChatState] File deleted successfully: ${fullPath}`);
        } catch (e: any) {
            console.error('Failed to delete file:', e, name);
            if (e.response) {
                console.error("[ChatState] Delete error response data:", e.response.data);
                console.error("[ChatState] Delete error response status:", e.response.status);
            }
            throw e;
        }
    }

    async createNewAgent(role: SpawnSubAgentRequestRoleEnum, goal: string, model?: string) {
        try {
            const api = this.getApi();
            const res = await api.apiV1SubagentsPost({
                role,
                goal,
                model,
                parent_session: this.sessionId || undefined
            });
            console.log('Created new agent:', res.data);
            return res.data;
        } catch (e) {
            console.error('Failed to create new agent:', e);
            throw e;
        }
    }

    loadFromStorage() {
        if (typeof window === 'undefined') {
            console.log('ChatState: loadFromStorage called on server - skipping');
            return;
        }
        
        console.log('ChatState: Loading from storage');
        this.sessionId = localStorage.getItem('miri_session_id') || "";
        this._activeTab = (localStorage.getItem('miri_active_tab') as "chat" | "files") || "chat";
        this.currentPath = localStorage.getItem('miri_current_path');
        console.log('ChatState: Loaded sessionId:', this.sessionId, 'activeTab:', this._activeTab, 'currentPath:', this.currentPath);

        try {
            const savedMessages = localStorage.getItem('miri_chat_messages');
            if (savedMessages) {
                const parsed = JSON.parse(savedMessages);
                if (Array.isArray(parsed)) {
                    this.messages = parsed;
                    console.log('ChatState: Loaded messages:', this.messages.length, 'items');
                    
                    // Update currentAssistantMessage if last message is from assistant
                    if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'assistant') {
                        this.currentAssistantMessage = this.messages[this.messages.length - 1].content;
                    }
                } else {
                    console.warn('ChatState: savedMessages is not an array:', parsed);
                }
            } else {
                console.log('ChatState: No saved messages found in localStorage');
            }
        } catch (e) {
            console.error('ChatState: Failed to load chat messages:', e);
        }

        try {
            const savedFiles = localStorage.getItem('miri_files');
            if (savedFiles) {
                const parsed = JSON.parse(savedFiles);
                if (Array.isArray(parsed)) {
                    this.files = parsed;
                    console.log('ChatState: Loaded files from storage:', this.files.length, 'items');
                }
            }
        } catch (e) {
            console.error('ChatState: Failed to load files from storage:', e);
        }

        try {
            const savedHistory = localStorage.getItem('miri_prompt_history');
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                if (Array.isArray(parsed)) {
                    this.promptHistory = parsed;
                    console.log('ChatState: Loaded promptHistory:', this.promptHistory.length, 'items');
                }
            }
        } catch (e) {
            console.error('ChatState: Failed to load prompt history:', e);
        }

        try {
            const savedTasks = localStorage.getItem('miri_task_messages');
            if (savedTasks) {
                const parsed = JSON.parse(savedTasks);
                if (Array.isArray(parsed)) {
                    this.taskMessages = parsed.map((t: any) => ({
                        ...t,
                        timestamp: new Date(t.timestamp)
                    }));
                    console.log('ChatState: Loaded taskMessages:', this.taskMessages.length, 'items');
                }
            }
        } catch (e) {
            console.error('ChatState: Failed to load task messages:', e);
        }

        try {
            const savedAgents = localStorage.getItem('miri_agent_messages');
            if (savedAgents) {
                const parsed = JSON.parse(savedAgents);
                if (Array.isArray(parsed)) {
                    this.agentMessages = parsed.map((t: any) => ({
                        ...t,
                        timestamp: new Date(t.timestamp)
                    }));
                    console.log('ChatState: Loaded agentMessages:', this.agentMessages.length, 'items');
                }
            }
        } catch (e) {
            console.error('ChatState: Failed to load agent messages:', e);
        }
    }

    savePromptToHistory(prompt: string) {
        if (!prompt || !prompt.trim()) return;
        
        console.log('ChatState: Saving prompt to history:', prompt);
        // Remove duplicate if it exists (bring to top)
        const filtered = this.promptHistory.filter(p => p !== prompt);
        const newHistory = [prompt, ...filtered].slice(0, 20);
        this.promptHistory = newHistory;
        
        if (typeof window !== 'undefined') {
            localStorage.setItem('miri_prompt_history', JSON.stringify(newHistory));
            console.log('ChatState: Saved promptHistory to localStorage. Size:', newHistory.length);
        }
    }

    handleIncomingChunk(data: string) {
        // Let processMessage decide whether this is meta or real content
        // to correctly toggle the thinking indicator.
        this.processMessage(data);
    }

    saveMessagesToStorage() {
        if (typeof window !== 'undefined') {
            console.log('ChatState: Saving messages to localStorage. Count:', this.messages.length);
            localStorage.setItem('miri_chat_messages', JSON.stringify(this.messages));
        } else {
            console.log('ChatState: saveMessagesToStorage called on server - skipping');
        }
    }

    processMessage(data: string) {
        if (!data) return;
        
        // Handle raw [DONE] signal from some streaming implementations
        if (data === "[DONE]") {
            console.log('ChatState: Received [DONE] signal');
            this.isStreaming = false;
            if (this.isNewCommandPending) {
                this.resetState();
            }
            return;
        }

        let content = "";
        try {
            const parsed = typeof data === 'string' && (data.startsWith('{') || data.startsWith('[')) 
                ? JSON.parse(data) 
                : null;
            
            if (parsed) {
                // Persist session ID if provided by server
                if (parsed.session_id && parsed.session_id !== this.sessionId) {
                    console.log('ChatState: Updating sessionId from server:', parsed.session_id);
                    this.sessionId = parsed.session_id;
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('miri_session_id', this.sessionId);
                    }
                    // Fetch stats for the newly received session ID
                    this.fetchSessionStats();
                }

                // Check for task reports
                if (parsed.source === "task") {
                    const newTask: TaskMessage = {
                        id: parsed.task_id || Math.random().toString(36).substring(7),
                        name: parsed.task_name || "Unknown Task",
                        message: parsed.response || "",
                        timestamp: new Date()
                    };
                    
                    // Add to list and keep only last 20
                    this.taskMessages = [...this.taskMessages, newTask].slice(-20);
                    
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('miri_task_messages', JSON.stringify(this.taskMessages));
                    }
                    return;
                }

                // Check for agent reports
                if (parsed.source === "agent") {
                    const message = parsed.response || parsed.content || "";
                    const result = parsed.result || "";
                    const role = parsed.role || "generic";
                    
                    const roleColors: Record<string, string> = {
                        'researcher': 'text-blue-600 bg-blue-50 border-blue-100',
                        'coder': 'text-purple-600 bg-purple-50 border-purple-100',
                        'reviewer': 'text-teal-600 bg-teal-50 border-teal-100',
                        'generic': 'text-indigo-600 bg-indigo-50 border-indigo-100',
                        'manager': 'text-orange-600 bg-orange-50 border-orange-100',
                        'architect': 'text-pink-600 bg-pink-50 border-pink-100'
                    };

                    const colors = [
                        'text-blue-600 bg-blue-50 border-blue-100',
                        'text-purple-600 bg-purple-50 border-purple-100',
                        'text-indigo-600 bg-indigo-50 border-indigo-100',
                        'text-pink-600 bg-pink-50 border-pink-100',
                        'text-orange-600 bg-orange-50 border-orange-100',
                        'text-teal-600 bg-teal-50 border-teal-100',
                        'text-cyan-600 bg-cyan-50 border-cyan-100'
                    ];

                    const agentId = parsed.agent_id || Math.random().toString(36).substring(7);
                    
                    // Add or update agent message
                    const existingIndex = this.agentMessages.findIndex(a => a.id === agentId);
                    
                    let color = roleColors[role.toLowerCase()] || colors[this.agentMessages.length % colors.length];
                    if (existingIndex >= 0) {
                        color = this.agentMessages[existingIndex].color || color;
                    }

                    const newAgent: AgentMessage = {
                        id: agentId,
                        name: parsed.agent_name || "Unknown Agent",
                        role: role,
                        status: parsed.status || 'running',
                        message: message,
                        result: result,
                        timestamp: new Date(),
                        color: color
                    };
                    
                    if (existingIndex >= 0) {
                        const previousStatus = this.agentMessages[existingIndex].status;
                        // Update: if newAgent.result is empty, keep existing result
                        const updatedAgent = { ...newAgent };
                        if (!updatedAgent.result && this.agentMessages[existingIndex].result) {
                            updatedAgent.result = this.agentMessages[existingIndex].result;
                        }
                        this.agentMessages[existingIndex] = updatedAgent;

                        // Trigger notification if status changed to completed
                        if (previousStatus === 'running' && updatedAgent.status === 'completed') {
                            console.log('ChatState: Agent completed:', updatedAgent.id);
                            this.lastCompletedAgentId = updatedAgent.id;
                        }
                    } else {
                        this.agentMessages = [...this.agentMessages, newAgent].slice(-20);
                        if (newAgent.status === 'completed') {
                             this.lastCompletedAgentId = newAgent.id;
                        }
                    }
                    
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('miri_agent_messages', JSON.stringify(this.agentMessages));
                    }
                    return;
                }
                
                if (parsed.content) {
                    content = parsed.content;
                } else if (parsed.response) {
                    content = parsed.response;
                } else if (parsed.done || parsed.status === "done") {
                    this.isStreaming = false;
                    if (this.isNewCommandPending) {
                        this.resetState();
                    }
                    // Fetch stats after completion
                    this.fetchSessionStats();
                    return;
                } else if (parsed.error) {
                    console.error('Server error:', parsed.error);
                    content = `Error: ${parsed.error}`;
                } else if (typeof parsed === 'string') {
                    content = parsed;
                }
            } else {
                // Not JSON, use as raw content
                content = data;
            }
        } catch (e) {
            // Fallback for non-JSON or malformed data
            content = data;
        }

        if (content) {
            // Check if this is a meta-tag/thought that should be hidden from the UI
            const isMeta = content.startsWith('[Thought:') || 
                          content.startsWith('[Tool:') || 
                          content.startsWith('[ToolResult:') ||
                          content.startsWith('[Skill:') ||
                          content.startsWith('[Human:') ||
                          content.startsWith('[Action:');
            
            if (isMeta) {
                // Parse the meta type and content
                let type = "info";
                let cleanContent = content;
                
                if (content.startsWith('[Thought:')) {
                    type = "thought";
                    cleanContent = content.replace('[Thought:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[ToolResult:')) {
                    type = "tool_result";
                    cleanContent = content.replace('[ToolResult:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[Tool:')) {
                    type = "tool";
                    cleanContent = content.replace('[Tool:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[Skill:')) {
                    type = "skill";
                    cleanContent = content.replace('[Skill:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[Human:')) {
                    type = "human";
                    cleanContent = content.replace('[Human:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[Action:')) {
                    type = "action";
                    cleanContent = content.replace('[Action:', '').replace(/\]$/, '').trim();
                }

                this.statusMessages.push({
                    type,
                    content: cleanContent,
                    timestamp: new Date()
                });
                
                // Keep only last 50 status messages
                if (this.statusMessages.length > 50) {
                    this.statusMessages = this.statusMessages.slice(-50);
                }

                // Keep thinking animation on meta; do not append to UI
                return;
            }

            // Also check for other technical tags that should be hidden from the UI
            const isOtherMeta = content.startsWith('[Usage:') || 
                          content.startsWith('[Error:') || 
                          content.startsWith('[Panic:') ||
                          content.startsWith('[Stream Error:');
            
            if (isOtherMeta) {
                // Parse the meta type and content
                let type = "info";
                let cleanContent = content;

                if (content.startsWith('[Usage:')) {
                    type = "usage";
                    cleanContent = content.replace('[Usage:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[Error:')) {
                    type = "error";
                    cleanContent = content.replace('[Error:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[Panic:')) {
                    type = "error";
                    cleanContent = content.replace('[Panic:', '').replace(/\]$/, '').trim();
                } else if (content.startsWith('[Stream Error:')) {
                    type = "error";
                    cleanContent = content.replace('[Stream Error:', '').replace(/\]$/, '').trim();
                }

                this.statusMessages.push({
                    type,
                    content: cleanContent,
                    timestamp: new Date()
                });
                
                // Keep only last 50 status messages
                if (this.statusMessages.length > 50) {
                    this.statusMessages = this.statusMessages.slice(-50);
                }
                return;
            }

            // We received real content; stop showing the thinking indicator
            this.isWaiting = false;
            this.isStreaming = true;

            this.currentAssistantMessage += content;
            
            if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'assistant') {
                // Svelte 5: Re-assign to trigger reactivity if the object isn't already a proxy
                this.messages[this.messages.length - 1] = {
                    ...this.messages[this.messages.length - 1],
                    content: this.currentAssistantMessage
                };
            } else {
                this.messages.push({ role: 'assistant', content: this.currentAssistantMessage });
            }
            this.saveMessagesToStorage();
        }
    }

    async connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        let serverUrl = PUBLIC_MIRI_SERVER_URL;
        if (serverUrl.endsWith('/')) {
            serverUrl = serverUrl.slice(0, -1);
        }
        const wsProtocol = serverUrl.startsWith('https:') ? 'wss:' : 'ws:';
        const wsBase = serverUrl.replace(/^https?:\/\//, '');

        let wsUrl = `${wsProtocol}//${wsBase}/ws?stream=true`;
        if (this.sessionId) {
            wsUrl += `&session_id=${this.sessionId}`;
        }
        const protocols = ["miri-key", PUBLIC_MIRI_SERVER_KEY];
        
        console.log('Connecting WebSocket:', {
            url: wsUrl,
            protocols: protocols,
            serverUrl: PUBLIC_MIRI_SERVER_URL,
            serverKey: PUBLIC_MIRI_SERVER_KEY ? 'present' : 'missing'
        });

        const fullWsUrl = `${wsUrl}&token=${encodeURIComponent(PUBLIC_MIRI_SERVER_KEY || '')}`;
        this.socket = new WebSocket(fullWsUrl, protocols);

        this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
        };

        this.socket.onmessage = (event) => {
            let data = event.data;
            console.log('WS message received:', data);

            // Handle end-of-stream signal if provided as a raw string or JSON property
            if (data === "[DONE]") {
                this.isStreaming = false;
                if (this.isNewCommandPending) {
                    this.resetState();
                }
                return;
            }
            
            if (data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                    this.handleIncomingChunk(reader.result as string);
                };
                reader.readAsText(data);
            } else {
                this.handleIncomingChunk(data);
            }
        };

        this.socket.onclose = (ev) => {
            console.log('WebSocket disconnected', { code: ev?.code, reason: ev?.reason, wasClean: ev?.wasClean });
            this.isConnected = false;
            
            // Do not auto-reconnect if it was a clean close (like when we reset for /new)
            // or if we're explicitly switching to SSE.
            if (ev?.code === 1000 || ev?.code === 1001) {
                return;
            }

            if (!this.useSSE && (!ev || ev.code >= 400 || ev.code === 1006)) {
                console.warn('Enabling SSE fallback for prompt streaming');
                this.useSSE = true;
            }
            setTimeout(() => this.connect(), 3000);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnected = false;
            if (!this.useSSE) {
                console.warn('Enabling SSE fallback due to WS error');
                this.useSSE = true;
            }
        };
    }

    async uploadFile(file: File) {
        if (!file) return;
        
        this.isUploading = true;
        try {
            const api = this.getApi();
            const res = await api.apiV1FilesUploadPost(file);
            const data = res.data;
            
            if (data.filename) {
                this.pendingFiles.push(data.filename);
                console.log('File uploaded and added to pending list:', data.filename, 'as path:', data.path);
                
                // Automatically refresh the files list after a successful upload
                // to ensure the File Manager view is up-to-date.
                this.fetchFiles();
            } else {
                console.error('File upload succeeded but no filename was returned in response:', data);
            }
        } catch (e) {
            console.error('File upload failed:', e);
            alert('File upload failed. Check the console for details.');
        } finally {
            this.isUploading = false;
        }
    }

    async sendMessage() {
        if (!this.inputMessage.trim() && this.pendingFiles.length === 0) return;

        // Clear status messages for new request
        this.statusMessages = [];

        const originalInput = this.inputMessage.trim();
        const isNewCommand = originalInput === "/new";
        let userMsg = this.inputMessage;
        
        // Append pending files to the message if any
        if (this.pendingFiles.length > 0) {
            const filesList = this.pendingFiles.join(', ');
            userMsg = `${userMsg}\n\nAttached files: ${filesList}`.trim();
            this.pendingFiles = []; // Clear pending files after sending
        }

        this.messages.push({ role: 'user', content: userMsg });
        this.saveMessagesToStorage();
        
        this.currentAssistantMessage = "";
        this.isWaiting = true;
        this.isStreaming = false;
        this.isNewCommandPending = isNewCommand;

        if (!this.useSSE && this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ prompt: userMsg });
            console.log('Sending WS message:', message);
            this.socket.send(message);
        } else {
            console.log('Sending via SSE fallback');
            await this.streamViaSSE(userMsg);
            
            // For SSE, we know when it's done because the function returns
            this.isStreaming = false;
            if (this.isNewCommandPending) {
                this.resetState();
            }
        }
        
        this.savePromptToHistory(userMsg);
        this.inputMessage = "";
    }

    resetState() {
        console.log('ChatState: Resetting chat state.');
        this.isNewCommandPending = false;
        this.messages = [];
        this.currentAssistantMessage = "";
        this.sessionId = ""; // Clear session ID to start truly fresh
        this.statusMessages = []; // Clear status messages too
        this.files = []; // Clear files too
        this.currentPath = null;
        this._activeTab = "chat";
        
        if (typeof window !== 'undefined') {
            localStorage.removeItem('miri_chat_messages');
            localStorage.removeItem('miri_session_id');
            localStorage.removeItem('miri_task_messages');
            localStorage.removeItem('miri_agent_messages');
            localStorage.removeItem('miri_active_tab');
            localStorage.removeItem('miri_files');
            console.log('ChatState: Cleared all chat-related localStorage items');
        }
        
        // Reconnect to get a new session
        if (!this.useSSE) {
            if (this.socket) {
                this.socket.close(1000, "Reset session");
            }
            // Wait a bit for the socket to close and then reconnect
            setTimeout(() => this.connect(), 500);
        }
    }

    async streamViaSSE(prompt: string) {
        try {
            let serverUrl = PUBLIC_MIRI_SERVER_URL;
            if (serverUrl.endsWith('/')) serverUrl = serverUrl.slice(0, -1);
            const url = new URL(`${serverUrl}/api/v1/prompt/stream`);
            url.searchParams.set('prompt', prompt);
            if (this.sessionId) {
                url.searchParams.set('session_id', this.sessionId);
            }

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

                let idx;
                while ((idx = buffer.indexOf('\n\n')) !== -1) {
                    const event = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    
                    // SSE event can have multiple data: lines which should be concatenated with a newline
                    let eventData = '';
                    for (const line of event.split('\n')) {
                        if (line.startsWith('data:')) {
                            const payload = line.slice(5).trimStart();
                            if (eventData) eventData += '\n';
                            eventData += payload;
                        }
                    }
                    
                    if (eventData === "[DONE]") {
                        this.isStreaming = false;
                        if (this.isNewCommandPending) {
                            this.resetState();
                        }
                    } else if (eventData) {
                        this.handleIncomingChunk(eventData);
                    }
                }
            }
        } catch (err) {
            console.error('SSE streaming error:', err);
        } finally {
            this.isWaiting = false;
        }
    }
}

export const chatState = new ChatState();
