const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export function apiUrl(path: string) {
  return `${configuredApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export const API_BASE_URL = configuredApiBaseUrl || null;
