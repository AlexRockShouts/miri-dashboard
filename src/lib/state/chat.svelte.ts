import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import type { Message as MiriMessage, Session as MiriSession, PaginatedHistory } from '@miri/sdk';

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

class ChatState {
    socket: WebSocket | null = $state(null);
    sessionId = $state("");
    inputMessage = $state("");
    messages = $state<Message[]>([]);
    taskMessages = $state<TaskMessage[]>([]);
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

    constructor() {
        if (typeof window !== 'undefined') {
            this.loadFromStorage();
        }
    }

    loadFromStorage() {
        if (typeof window === 'undefined') return;
        
        console.log('ChatState: Loading from storage');
        this.sessionId = localStorage.getItem('miri_session_id') || "";
        console.log('ChatState: Loaded sessionId:', this.sessionId);

        try {
            const savedMessages = localStorage.getItem('miri_chat_messages');
            if (savedMessages) {
                const parsed = JSON.parse(savedMessages);
                if (Array.isArray(parsed)) {
                    this.messages = parsed;
                    console.log('ChatState: Loaded messages:', this.messages.length, 'items');
                }
            }
        } catch (e) {
            console.error('ChatState: Failed to load chat messages:', e);
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
            localStorage.setItem('miri_chat_messages', JSON.stringify(this.messages));
        }
    }

    processMessage(data: string) {
        if (!data) return;
        
        let content = "";
        try {
            const parsed = JSON.parse(data);
            
            // Persist session ID if provided by server
            if (parsed.session_id && parsed.session_id !== this.sessionId) {
                this.sessionId = parsed.session_id;
                if (typeof window !== 'undefined') {
                    localStorage.setItem('miri_session_id', this.sessionId);
                }
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
            
            if (parsed.content) {
                content = parsed.content;
            } else if (parsed.response) {
                content = parsed.response;
            } else if (parsed.done || parsed.status === "done") {
                this.isStreaming = false;
                if (this.isNewCommandPending) {
                    this.resetState();
                }
                return;
            } else if (typeof parsed === 'string') {
                content = parsed;
            } else if (parsed.error) {
                console.error('Server error:', parsed.error);
                content = `Error: ${parsed.error}`;
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
            const formData = new FormData();
            formData.append('file', file);
            
            let serverUrl = PUBLIC_MIRI_SERVER_URL;
            if (serverUrl.endsWith('/')) {
                serverUrl = serverUrl.slice(0, -1);
            }
            
            const res = await fetch(`${serverUrl}/api/v1/files/upload`, {
                method: 'POST',
                headers: {
                    'X-Server-Key': PUBLIC_MIRI_SERVER_KEY
                },
                body: formData
            });
            
            if (!res.ok) {
                throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
            }
            
            const data = await res.json();
            if (data.path) {
                this.pendingFiles.push(data.filename);
                console.log('File uploaded and added to pending list:', data.filename, 'as path:', data.path);
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
        if (typeof window !== 'undefined') {
            localStorage.removeItem('miri_chat_messages');
            localStorage.removeItem('miri_session_id');
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
