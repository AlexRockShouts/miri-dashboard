import { DefaultApi, Configuration } from '@miri/sdk';
import type { SearchResult, TopologyData } from '@miri/sdk';
import { PUBLIC_MIRI_SERVER_URL, PUBLIC_MIRI_SERVER_KEY } from '$env/static/public';
import { MIRI_ADMIN_USER, MIRI_ADMIN_PASSWORD } from '$env/static/private';
import type { PageServerLoad } from './$types';

export interface BrainData {
    facts: SearchResult[];
    summaries: SearchResult[];
    totalFacts: number;
    totalSummaries: number;
    topology?: TopologyData;
    error?: string;
    page: number;
    pageSize: number;
}

export const load: PageServerLoad = async ({ url }): Promise<BrainData> => {
    const sessionId = url.searchParams.get('session_id') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;
    
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
        // The Brain endpoints are now correctly mapped to /api/admin/v1/brain
        // in the OpenAPI spec and regenerated SDK.
        const [factsRes, summariesRes, topologyRes] = await Promise.all([
            defaultApi.apiAdminV1BrainFactsGet(pageSize, offset),
            defaultApi.apiAdminV1BrainSummariesGet(pageSize, offset),
            defaultApi.apiAdminV1BrainTopologyGet(sessionId)
        ]);

        return {
            facts: Array.isArray(factsRes.data.data) ? factsRes.data.data : [],
            summaries: Array.isArray(summariesRes.data.data) ? summariesRes.data.data : [],
            totalFacts: factsRes.data.total || 0,
            totalSummaries: summariesRes.data.total || 0,
            topology: topologyRes?.data as TopologyData || { nodes: [], edges: [] },
            page,
            pageSize
        };
    } catch (e: any) {
        console.error('Failed to fetch Brain data:', e.message);
        
        // Fallback: If 404, it's likely because the SDK is hitting /api/v1/brain instead of /api/admin/v1/brain
        if (e.response?.status === 404 || e.message?.includes('404')) {
            try {
                console.log('Attempting fallback to /api/admin/v1/brain...');
                const auth = Buffer.from(`${MIRI_ADMIN_USER}:${MIRI_ADMIN_PASSWORD}`).toString('base64');
                
                const [factsRes, summariesRes, topologyRes] = await Promise.all([
                    fetch(`${PUBLIC_MIRI_SERVER_URL}/api/admin/v1/brain/facts?limit=${pageSize}&offset=${offset}`, {
                        headers: {
                            'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
                            'Authorization': `Basic ${auth}`
                        }
                    }),
                    fetch(`${PUBLIC_MIRI_SERVER_URL}/api/admin/v1/brain/summaries?limit=${pageSize}&offset=${offset}`, {
                        headers: {
                            'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
                            'Authorization': `Basic ${auth}`
                        }
                    }),
                    fetch(`${PUBLIC_MIRI_SERVER_URL}/api/admin/v1/brain/topology${sessionId ? `?session_id=${sessionId}` : ''}`, {
                        headers: {
                            'X-Server-Key': PUBLIC_MIRI_SERVER_KEY,
                            'Authorization': `Basic ${auth}`
                        }
                    })
                ]);

                if (factsRes.ok && summariesRes.ok) {
                    const facts = await factsRes.json();
                    const summaries = await summariesRes.json();
                    const topology = topologyRes.ok ? await topologyRes.json() : undefined;
                    return {
                        facts: Array.isArray(facts.data) ? facts.data : [],
                        summaries: Array.isArray(summaries.data) ? summaries.data : [],
                        totalFacts: facts.total || 0,
                        totalSummaries: summaries.total || 0,
                        topology: topology,
                        page,
                        pageSize
                    };
                }
            } catch (fallbackError: any) {
                console.error('Fallback fetch failed:', fallbackError.message);
            }
        }

        return {
            error: e.message || 'Could not connect to Miri server',
            facts: [],
            summaries: [],
            totalFacts: 0,
            totalSummaries: 0,
            topology: { nodes: [], edges: [] },
            page,
            pageSize
        };
    }
};
