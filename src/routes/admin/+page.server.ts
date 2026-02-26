// @ts-ignore
import { Api } from '@miri/sdk/miri-sdk';
import { error } from '@sveltejs/kit';
import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import { MIRI_ADMIN_USER, MIRI_ADMIN_PASSWORD } from '$env/static/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const api = new Api({
        baseURL: PUBLIC_MIRI_SERVER_URL,
        headers: {
            'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
            'Authorization': 'Basic ' + Buffer.from(`${MIRI_ADMIN_USER}:${MIRI_ADMIN_PASSWORD}`).toString('base64')
        }
    });

    try {
        const [health, config, sessions, humans, skills] = await Promise.all([
            api.api.adminV1HealthList(),
            api.api.adminV1ConfigList(),
            api.api.adminV1SessionsList(),
            api.api.adminV1HumanList(),
            api.api.adminV1SkillsList()
        ]);

        return {
            health: health.data,
            config: config.data,
            sessions: sessions.data,
            humans: humans.data,
            skills: skills.data
        };
    } catch (e: any) {
        console.error('Failed to fetch Miri data:', e.message);
        // We still want to render the page, but with empty data or error state
        return {
            error: e.message || 'Could not connect to Miri server',
            health: null,
            config: null,
            sessions: [],
            humans: [],
            skills: []
        };
    }
};
