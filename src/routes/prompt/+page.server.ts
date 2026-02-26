import { PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return {
        miriServerKey: PUBLIC_MIRI_SERVER_KEY
    };
};
