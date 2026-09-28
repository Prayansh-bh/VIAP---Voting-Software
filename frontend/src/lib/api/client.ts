/// <reference types="vite/client" />

import { getAuthToken } from '../authStorage';

export const getApiBase = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // If in browser, use relative URL (empty string) so Vite proxy handles requests from any device/laptop/phone
  if (typeof window !== 'undefined') {
    return '';
  }
  return 'http://localhost:4000';
};

export async function apiFetch<T = any>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const apiBase = getApiBase();
  const primaryUrl = endpoint.startsWith('http') ? endpoint : `${apiBase}${normalizedEndpoint}`;
  const fallbackUrl = endpoint.startsWith('http') ? endpoint : normalizedEndpoint;

  const headers = new Headers(init.headers);
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(primaryUrl, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch (_err) {
    // If primary URL failed (e.g. cross-port block on mobile/network), try relative fallback via Vite proxy
    try {
      res = await fetch(fallbackUrl, {
        ...init,
        headers,
        credentials: 'include',
      });
    } catch (secondErr: any) {
      throw new Error(secondErr?.message || 'Failed to communicate with API server. Please check your backend connection.');
    }
  }

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errMessage = errJson.error?.message || errJson.message || errMessage;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}
