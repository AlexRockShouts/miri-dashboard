import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
    const { filepath } = params;
    
    if (!filepath) {
        throw error(400, 'File path is required');
    }

    let serverUrl = PUBLIC_MIRI_SERVER_URL;
    if (serverUrl.endsWith('/')) {
        serverUrl = serverUrl.slice(0, -1);
    }

    const targetUrl = `${serverUrl}/api/v1/files/${filepath}`;
    
    console.log(`Proxying file request: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'X-Server-Key': PUBLIC_MIRI_SERVER_KEY
            }
        });

        if (!response.ok) {
            console.error(`Miri server returned ${response.status}: ${response.statusText} for ${targetUrl}`);
            throw error(response.status, `Miri server: ${response.statusText}`);
        }

        const contentType = response.headers.get('Content-Type');
        const contentDisposition = response.headers.get('Content-Disposition');
        const blob = await response.blob();

        const headers = new Headers();
        if (contentType) headers.set('Content-Type', contentType);
        if (contentDisposition) headers.set('Content-Disposition', contentDisposition);

        return new Response(blob, {
            status: 200,
            headers
        });
    } catch (e: any) {
        console.error(`Failed to proxy file ${filepath}:`, e.message);
        throw error(500, `Internal proxy error: ${e.message}`);
    }
};
