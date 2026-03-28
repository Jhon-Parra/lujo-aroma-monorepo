/**
 * Centralized API configuration for Lujo & Aroma
 * Updated dynamically by ConfigService at runtime.
 */
export const API_CONFIG = {
    serverUrl: 'http://localhost:3000',
    baseUrl: 'http://localhost:3000/api',
    googleClientId: '129037757547-mvt7e9b254t59dc4s7mu8vnth62lf7lr.apps.googleusercontent.com'
};

export function updateApiConfig(apiUrl: string, googleClientId: string) {
    API_CONFIG.serverUrl = apiUrl;
    API_CONFIG.baseUrl = `${apiUrl}/api`;
    API_CONFIG.googleClientId = googleClientId;
}
