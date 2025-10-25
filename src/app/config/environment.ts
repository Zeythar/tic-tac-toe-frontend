/**
 * Environment configuration
 *
 * This now imports from the official Angular environment files
 * which are replaced during production builds via angular.json fileReplacements
 */

import { environment as env } from '../../environments/environment';

export const environment = env;

/**
 * Get the full API base URL
 * In development, returns empty string (uses proxy)
 * In production, returns the configured base URL from environment.prod.ts
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
