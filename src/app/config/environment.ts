/**
 * Environment configuration
 *
 * In development: Uses proxy.conf.json, so API_BASE_URL should be empty
 * In production: Set NG_APP_API_BASE_URL environment variable in Vercel to your backend URL
 */

// Angular/Vite uses import.meta.env for environment variables
// Variables must be prefixed with NG_APP_ to be exposed
// @ts-ignore - import.meta.env is provided by the build system
const apiBaseUrl: string =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env['NG_APP_API_BASE_URL'] || ''
    : '';

export const environment = {
  production: false,
  apiBaseUrl, // Empty in dev = uses relative URLs with proxy
};

/**
 * Get the full API base URL
 * In development, returns empty string (uses proxy)
 * In production, returns the configured base URL
 */
export function getApiBaseUrl(): string {
  return environment.apiBaseUrl;
}

/**
 * Get the full SignalR hub URL
 */
export function getSignalRHubUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}/gameHub` : '/gameHub';
}
