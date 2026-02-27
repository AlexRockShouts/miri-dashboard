import { DefaultApi, Configuration } from '@miri/sdk';
import type { Skill } from '@miri/sdk';
import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import { MIRI_ADMIN_USER, MIRI_ADMIN_PASSWORD } from '$env/static/private';
import type { PageServerLoad } from './$types';

export interface SkillsData {
    skills: Skill[];
    error?: string;
}

export const load: PageServerLoad = async (): Promise<SkillsData> => {
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
        const skillsRes = await defaultApi.apiAdminV1SkillsGet();
        const skills: Skill[] = (skillsRes.data as any) || [];

        return {
            skills
        };
    } catch (e: any) {
        console.error('Failed to fetch Skills data:', e.message);
        return {
            error: e.message || 'Could not connect to Miri server',
            skills: []
        };
    }
};

export const actions = {
    installSkill: async ({ request }) => {
        return { error: 'Skill installation is currently not supported via the API' };
    },

    removeSkill: async ({ request }) => {
        const data = await request.formData();
        const skillName = data.get('skillName') as string;

        if (!skillName) {
            return { error: 'Skill name is required' };
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
            await defaultApi.apiAdminV1SkillsNameDelete(skillName);
            return { success: true };
        } catch (e: any) {
            console.error(`Failed to remove skill ${skillName}:`, e.message);
            return { error: e.message || 'Could not remove skill' };
        }
    }
};
