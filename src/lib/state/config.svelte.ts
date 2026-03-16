import { DefaultApi, Configuration, type Config, type ProviderConfig, type ModelConfig } from '@alexrockshouts/miri-sdk';

export class ConfigState {
    config = $state<Config | null>(null);
    isFetchingConfig = $state(false);

    private getApi() {
        const serverUrl = (import.meta.env.PUBLIC_MIRI_SERVER_URL as string) ?? '';
        const serverKey = (import.meta.env.PUBLIC_MIRI_SERVER_KEY as string) ?? '';
        const user = (import.meta.env.PUBLIC_MIRI_ADMIN_USER as string) ?? 'admin';
        const pass = (import.meta.env.PUBLIC_MIRI_ADMIN_PASSWORD as string) ?? 'admin-password';
        const basicAuth = btoa(`${user}:${pass}`);

        console.log(`[ConfigState] Using URL: ${serverUrl}`);
        console.log(`[ConfigState] Using Server Key: ${serverKey}`);
        console.log(`[ConfigState] Using User: ${user}`);
        console.log(`[ConfigState] Using Password: ${pass}`);

        const config = new Configuration({
            basePath: serverUrl,
            apiKey: serverKey,
            username: user,
            password: pass,
            baseOptions: {
                headers: {
                    'X-Server-Key': serverKey,
                    'Authorization': `Basic ${basicAuth}`
                }
            }
        });
        const api = new DefaultApi(config);

        const axiosInstance = (api as any).axios || (api as any).axiosInstance;
        if (axiosInstance && !axiosInstance.interceptors.request.handlers.length) {
            axiosInstance.interceptors.request.use((config: any) => {
                console.log(`API [${config.method?.toUpperCase()}] ${config.url}`, {
                    params: config.params,
                    data: config.data,
                    headers: config.headers
                });
                return config;
            });
        }
        return api;
    }

    async fetchConfig() {
        this.isFetchingConfig = true;
        try {
            const api = this.getApi();
            const res = await api.apiAdminV1ConfigGet();
            this.config = res.data;
        } catch (e) {
            console.error('Failed to fetch config:', e);
        } finally {
            this.isFetchingConfig = false;
        }
    }

    async updateConfig(newConfig: Config) {
        try {
            const api = this.getApi();
            await api.apiAdminV1ConfigPost(newConfig);
            this.config = newConfig;
        } catch (e) {
            console.error('Failed to update config:', e);
            throw e;
        }
    }

    async addProvider(name: string, baseUrl: string, apiType: string, modelIds: string[]) {
        if (!this.config) {
            throw new Error('Config not loaded. Fetch config first.');
        }
        if (!this.config.models) {
            this.config.models = { providers: {} };
        }
        if (!this.config.models.providers) {
            this.config.models.providers = {};
        }
        const models: ModelConfig[] = modelIds.filter(id => id.trim()).map(id => ({ id: id.trim() } as ModelConfig));
        const provider: ProviderConfig = {
            baseUrl: baseUrl.trim() || undefined,
            api: apiType || 'openai',
            models
        };
        this.config.models.providers[name] = provider;
        await this.updateConfig(this.config);
    }

    async updateProviderModels(name: string, modelIds: string[]) {
        if (!this.config?.models?.providers?.[name]) {
            throw new Error(`Provider \"${name}\" not found`);
        }
        this.config.models.providers[name].models = modelIds.filter(id => id.trim()).map(id => ({ id: id.trim() } as ModelConfig));
        await this.updateConfig(this.config);
    }
}

export const configState = new ConfigState();
