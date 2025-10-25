/**
 * Environment configuration
 *
 * In development: Uses proxy.conf.json, so API_BASE_URL should be empty
 * In production: Set API_BASE_URL environment variable to your backend URL
 */

export const environment = {
  production: false,
  apiBaseUrl: '', // Empty in dev = uses relative URLs with proxy
};

/**
 * Get the full API base URL
 * In development, returns empty string (uses proxy)
 * In production, returns the configured base URL
 */
export function getApiBaseUrl(): string {
  // In production builds, you can replace this with process.env or inject via build
  return environment.apiBaseUrl;
}

/**
 * Get the full SignalR hub URL
 */
export function getSignalRHubUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}/gameHub` : '/gameHub';
}
