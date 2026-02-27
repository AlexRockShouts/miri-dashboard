import { DefaultApi, Configuration } from '@miri/sdk';
import type { Config, HumanInfo, Session, Skill, Task } from '@miri/sdk';
import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import { MIRI_ADMIN_USER, MIRI_ADMIN_PASSWORD } from '$env/static/private';
import type { PageServerLoad } from './$types';

export interface AdminData {
    health: { status?: string; message?: string } | null;
    config: Config | null;
    sessions: string[];
    humans: HumanInfo[];
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
        const [health, configRes, sessions, humans, tasks, skills] = await Promise.all([
            defaultApi.apiAdminV1HealthGet(),
            defaultApi.apiAdminV1ConfigGet(),
            defaultApi.apiAdminV1SessionsGet(),
            defaultApi.apiAdminV1HumanGet(),
            defaultApi.apiAdminV1TasksGet(),
            defaultApi.apiAdminV1SkillsGet()
        ]);

        return {
            health: health.data,
            config: configRes.data,
            sessions: sessions.data,
            humans: humans.data,
            tasks: tasks.data,
            skills: skills.data
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
            const historyData = response.data as any;

            // Normalize messages to SDK shape: { role, content }
            let normalized: { role: string; content: string }[] = [];
            const msgs = Array.isArray(historyData?.messages) ? historyData.messages : [];
            for (const m of msgs) {
                // If already in role/content form, keep as is
                if (m && (typeof m.role === 'string' || typeof m.content === 'string')) {
                    if (m.content && m.content.trim()) {
                        normalized.push({ role: (m.role || 'assistant') as string, content: m.content as string });
                    }
                    continue;
                }
                // Fallback: map { prompt, response } to two messages
                if (m?.prompt && String(m.prompt).trim()) {
                    normalized.push({ role: 'user', content: String(m.prompt) });
                }
                if (m?.response && String(m.response).trim()) {
                    normalized.push({ role: 'assistant', content: String(m.response) });
                }
            }

            return { history: normalized };
        } catch (e: any) {
            console.error(`Failed to fetch history for session ${sessionId}:`, e.message);
            return { error: e.message || 'Could not fetch session history' };
        }
    }
};
