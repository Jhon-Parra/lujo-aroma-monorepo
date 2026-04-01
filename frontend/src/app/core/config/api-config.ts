/**
 * Centralized API configuration for Lujo & Aroma
 * Updated dynamically by ConfigService at runtime.
 */
export const API_CONFIG = {
    serverUrl: 'https://api.perfumesbogota.com',
    baseUrl: 'https://api.perfumesbogota.com/api',
    googleClientId: '83015258138-h30gb9n5k9le48kt6amfgje39fgfr3dg.apps.googleusercontent.com'
};

export function updateApiConfig(apiUrl: string, googleClientId: string) {
    API_CONFIG.serverUrl = apiUrl;
    API_CONFIG.baseUrl = `${apiUrl}/api`;
    API_CONFIG.googleClientId = googleClientId;
}
