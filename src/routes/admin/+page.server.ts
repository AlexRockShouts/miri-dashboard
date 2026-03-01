import { DefaultApi, Configuration } from '@miri/sdk';
import type { 
    Config, 
    Human, 
    Session, 
    Skill, 
    Task, 
    ApiAdminV1SessionsIdHistoryGet200Response,
    ApiAdminV1HealthGet200Response
} from '@miri/sdk';
import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import { MIRI_ADMIN_USER, MIRI_ADMIN_PASSWORD } from '$env/static/private';
import type { PageServerLoad } from './$types';

export interface AdminData {
    health: ApiAdminV1HealthGet200Response | null;
    config: Config | null;
    sessions: string[];
    humans: Human[];
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
        const [healthRes, configRes, sessionsRes, humansRes, tasksRes, skillsRes] = await Promise.all([
            defaultApi.apiAdminV1HealthGet(),
            defaultApi.apiAdminV1ConfigGet(),
            defaultApi.apiAdminV1SessionsGet(),
            defaultApi.apiAdminV1HumanGet(),
            defaultApi.apiAdminV1TasksGet(),
            defaultApi.apiAdminV1SkillsGet()
        ]);

        return {
            health: healthRes.data,
            config: configRes.data,
            sessions: sessionsRes.data,
            humans: Array.isArray(humansRes.data) ? humansRes.data : [humansRes.data],
            tasks: tasksRes.data,
            skills: skillsRes.data
        };
    } catch (e: any) {
        console.error('Failed to fetch Miri data:', e.message);
        return {
            error: e.message || 'Could not connect to Miri server',
            health: null,
            config: null,
            sessions: [],
            humans: [],
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
            const response = await defaultApi.apiAdminV1SessionsIdHistoryGet(sessionId);
            const historyData = response.data as ApiAdminV1SessionsIdHistoryGet200Response;

            // Normalize messages to SDK shape: { role, content }
            let normalized: { role: string; content: string }[] = [];
            const msgs = Array.isArray(historyData?.messages) ? historyData.messages : [];
            for (const m of msgs) {
                const message = m as any;
                // If already in role/content form, keep as is
                if (message && (typeof message.role === 'string' || typeof message.content === 'string')) {
                    if (message.content && message.content.trim()) {
                        normalized.push({ role: (message.role || 'assistant') as string, content: message.content as string });
                    }
                    continue;
                }
                // Fallback: map { prompt, response } to two messages
                if (message?.prompt && String(message.prompt).trim()) {
                    normalized.push({ role: 'user', content: String(message.prompt) });
                }
                if (message?.response && String(message.response).trim()) {
                    normalized.push({ role: 'assistant', content: String(message.response) });
                }
            }

            return { history: normalized };
        } catch (e: any) {
            console.error(`Failed to fetch history for session ${sessionId}:`, e.message);
            return { error: e.message || 'Could not fetch session history' };
        }
    }
};
