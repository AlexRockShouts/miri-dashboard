import type { PageServerLoad } from './$types';
const PUBLIC_MIRI_SERVER_KEY = process.env.PUBLIC_MIRI_SERVER_KEY ?? '';

export const load: PageServerLoad = async () => {
    return {
        miriServerKey: PUBLIC_MIRI_SERVER_KEY
    };
};
