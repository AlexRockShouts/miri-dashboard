import { MIRI_SERVER_KEY } from '$env/static/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return {
        miriServerKey: MIRI_SERVER_KEY
    };
};
