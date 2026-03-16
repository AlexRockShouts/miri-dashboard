import { DefaultApi, Configuration } from '@miri/sdk';
import type { SubAgentRun } from '@miri/sdk';
const PUBLIC_MIRI_SERVER_URL = process.env.PUBLIC_MIRI_SERVER_URL ?? '';
const PUBLIC_MIRI_SERVER_KEY = process.env.PUBLIC_MIRI_SERVER_KEY ?? '';
const MIRI_ADMIN_USER = process.env.MIRI_ADMIN_USER ?? '';
const MIRI_ADMIN_PASSWORD = process.env.MIRI_ADMIN_PASSWORD ?? '';
import type { PageServerLoad } from './$types';

export interface SubAgentsData {
    runs: SubAgentRun[];
    error?: string;
}

export const load: PageServerLoad = async ({ url }): Promise<SubAgentsData> => {
    const sessionId = url.searchParams.get('session_id') || undefined;
    
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
        const response = await defaultApi.apiAdminV1SubagentsGet(sessionId);
        return {
            runs: Array.isArray(response.data) ? response.data : []
        };
    } catch (e: any) {
        console.error('Failed to fetch SubAgents data:', e.message);
        return {
            error: e.message || 'Could not connect to Miri server',
            runs: []
        };
    }
};
