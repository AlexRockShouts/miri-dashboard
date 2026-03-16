import { DefaultApi, Configuration } from '@miri/sdk';
import type { 
    Config, 
    Human, 
    Session, 
    Skill, 
    Task, 
    PaginatedHistory,
    ApiAdminV1HealthGet200Response
} from '@miri/sdk';
const PUBLIC_MIRI_SERVER_URL = process.env.PUBLIC_MIRI_SERVER_URL ?? '';
const PUBLIC_MIRI_SERVER_KEY = process.env.PUBLIC_MIRI_SERVER_KEY ?? '';
const MIRI_ADMIN_USER = process.env.MIRI_ADMIN_USER ?? '';
const MIRI_ADMIN_PASSWORD = process.env.MIRI_ADMIN_PASSWORD ?? '';
import type { PageServerLoad } from './$types';

export interface AdminData {
    health: ApiAdminV1HealthGet200Response | null;
    config: Config | null;
    sessions: string[];
    tasks: Task[];
    skills: Skill[];
    error?: string;
}

export const load: PageServerLoad = async (): Promise<AdminData> => {
    const config = new Configuration({
        basePath: PUBLIC_MIRI_SERVER_URL,
        baseOptions: {
            headers: {
                'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
                'Authorization': 'Basic ' + Buffer.from(`${MIRI_ADMIN_USER}:${MIRI_ADMIN_PASSWORD}`).toString('base64')
            }
        }
    });
    const defaultApi = new DefaultApi(config);

    try {
        const [healthRes, configRes, sessionsRes, tasksRes, skillsRes] = await Promise.all([
            defaultApi.apiAdminV1HealthGet(),
            defaultApi.apiAdminV1ConfigGet(),
            defaultApi.apiAdminV1SessionsGet(100, 0),
            defaultApi.apiAdminV1TasksGet(100, 0),
            defaultApi.apiAdminV1SkillsGet(100, 0)
        ]);

        return {
            health: healthRes.data,
            config: configRes.data,
            sessions: sessionsRes.data.data as string[],
            tasks: tasksRes.data.data as Task[],
            skills: skillsRes.data.data as Skill[]
        };
    } catch (e: any) {
        console.error('Failed to fetch Miri data:', e.message);
        return {
            error: e.message || 'Could not connect to Miri server',
            health: null,
            config: null,
            sessions: [],
            tasks: [],
            skills: []
        };
    }
};

export const actions = {
    getHistory: async ({ request }) => {
        console.log('Action getHistory triggered');
        const data = await request.formData();
        const sessionId = data.get('sessionId') as string;
        console.log(`Fetching history for session: ${sessionId}`);

        if (!sessionId) {
            return { error: 'Session ID is required' };
        }

        const config = new Configuration({
            basePath: PUBLIC_MIRI_SERVER_URL,
            baseOptions: {
                headers: {
                    'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
                    'Authorization': 'Basic ' + Buffer.from(`${MIRI_ADMIN_USER}:${MIRI_ADMIN_PASSWORD}`).toString('base64')
                }
            }
        });
        const defaultApi = new DefaultApi(config);

        try {
            const response = await defaultApi.apiAdminV1SessionsIdHistoryGet(sessionId, 100, 0);
            const historyData = response.data as PaginatedHistory;

            // The SDK Message interface now specifically uses 'prompt' and 'response'
            let normalized: { role: string; content: string }[] = [];
            const msgs = Array.isArray(historyData?.messages) ? historyData.messages : [];
            for (const message of msgs) {
                if (message.prompt && message.prompt.trim()) {
                    normalized.push({ role: 'user', content: message.prompt });
                }
                if (message.response && message.response.trim()) {
                    normalized.push({ role: 'assistant', content: message.response });
                }
            }

            return { history: normalized };
        } catch (e: any) {
            console.error(`Failed to fetch history for session ${sessionId}:`, e.message);
            return { error: e.message || 'Could not fetch session history' };
        }
    },

    enrollChannel: async ({ request }) => {
        const data = await request.formData();
        const channel = data.get('channel') as string;
        const action = data.get('action') as string;

        if (!channel || !action) {
            return { error: 'Channel and action are required' };
        }

        const config = new Configuration({
            basePath: PUBLIC_MIRI_SERVER_URL,
            baseOptions: {
                headers: {
                    'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
                    'Authorization': 'Basic ' + Buffer.from(`${MIRI_ADMIN_USER}:${MIRI_ADMIN_PASSWORD}`).toString('base64')
                }
            }
        });
        const defaultApi = new DefaultApi(config);

        try {
            const response = await defaultApi.apiAdminV1ChannelsPost({
                channel: channel,
                action: action as any // Use the correct action enum
            });
            return { success: true, result: response.data };
        } catch (e: any) {
            console.error(`Failed to execute channel action ${action} on ${channel}:`, e.message);
            return { error: e.message || `Could not execute ${action} on ${channel}` };
        }
    }
};
