/// <reference types="vite/client" />

import { getAuthToken } from '../authStorage';

export const isMobileClient = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    (window.location.hostname === 'localhost' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  );
};

export const getApiBase = (): string => {
  if (typeof import.meta !== 'undefined') {
    const envUrl = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || '').trim();
    if (envUrl && !envUrl.includes('railway.app') && !envUrl.includes('ngrok')) {
      const cleaned = envUrl.replace(/\/+$/, '');
      return cleaned.replace(/\/api\/?$/, '');
    }
  }
  // Mobile app (Capacitor) or Production Web (Vercel) -> Always use production Render backend
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('livesurvey.tech') || /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) {
      return window.location.origin;
    }
    if (isMobileClient() || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return 'https://viap-backend.onrender.com';
    }
    // Local dev: use relative URL so Vite proxy handles requests
    return '';
  }
  return 'https://viap-backend.onrender.com';
};

export async function apiFetch<T = any>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const sanitizedEndpoint = endpoint.replace(/https?:\/\/[a-zA-Z0-9_.-]*railway\.app/g, 'https://viap-backend.onrender.com');
  const normalizedEndpoint = sanitizedEndpoint.startsWith('/') ? sanitizedEndpoint : `/${sanitizedEndpoint}`;

  let primaryUrl: string;
  let fallbackUrl: string;

  if (sanitizedEndpoint.startsWith('http')) {
    primaryUrl = sanitizedEndpoint;
    fallbackUrl = sanitizedEndpoint;
  } else {
    const apiBase = getApiBase().replace(/\/api\/?$/, '');
    const cleanPath = normalizedEndpoint.replace(/^\/?api\/?/, '/');
    primaryUrl = apiBase ? `${apiBase}/api${cleanPath}` : `/api${cleanPath}`;
    fallbackUrl = `/api${cleanPath}`;
  }

  const headers = new Headers(init.headers);
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Inject multi-tenant context headers from session or URL parameters if not explicitly provided
  if (typeof window !== 'undefined') {
    try {
      const sessionStr = localStorage.getItem('kdp_active_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        const orgId = session?.organisationId || session?.organisation?.id;
        const tenantCode = session?.organisation?.code;
        if (orgId && !headers.has('x-organisation-id')) {
          headers.set('x-organisation-id', orgId);
        }
        if (tenantCode && !headers.has('x-tenant-code')) {
          headers.set('x-tenant-code', tenantCode);
        }
      }

      if (!headers.has('x-tenant-code')) {
        const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
        const urlTenant = urlParams.get('app') || urlParams.get('tenant');
        if (urlTenant) {
          headers.set('x-tenant-code', urlTenant);
        }
      }
    } catch {}
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
    // Only attempt relative fallback on desktop local dev, NEVER on mobile
    if (!isMobileClient() && fallbackUrl !== primaryUrl && !fallbackUrl.startsWith('http')) {
      try {
        res = await fetch(fallbackUrl, {
          ...init,
          headers,
          credentials: 'include',
        });
      } catch (secondErr: any) {
        throw new Error(secondErr?.message || 'Failed to communicate with API server. Please check your backend connection.');
      }
    } else {
      throw new Error('Unable to connect to the cloud server. Please check your internet connection and try again.');
    }
  }

  const rawText = await res.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE') || rawText.includes('<!doctype')) {
      throw new Error('Cloud backend is waking up or initializing. Please retry in 10-15 seconds.');
    }
    throw new Error('Unexpected response format received from server.');
  }

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    errMessage = json?.error?.message || json?.message || errMessage;
    const err: any = new Error(errMessage);
    err.status = res.status;
    err.statusCode = res.status;
    err.code = json?.error?.code || json?.code;
    err.data = json?.data;
    const retryHeader = res.headers.get('retry-after');
    const headerRetry = retryHeader ? parseInt(retryHeader, 10) : NaN;
    const bodyRetry = json?.data?.retryAfter ?? json?.retryAfter;
    if (!isNaN(headerRetry) && headerRetry > 0) {
      err.retryAfter = headerRetry;
    } else if (typeof bodyRetry === 'number' && bodyRetry > 0) {
      err.retryAfter = bodyRetry;
    }
    throw err;
  }

  if (json && typeof json === 'object' && json.data !== undefined) {
    if (json.meta !== undefined && typeof json.data === 'object' && json.data !== null) {
      try {
        Object.defineProperty(json.data, '__meta', {
          value: json.meta,
          enumerable: false,
          writable: true,
          configurable: true,
        });
      } catch {}
    }
    return json.data;
  }
  return json;
}

export async function apiFetchWithMeta<T = any>(
  endpoint: string,
  init: RequestInit = {}
): Promise<{ data: T; meta?: any }> {
  const sanitizedEndpoint = endpoint.replace(/https?:\/\/[a-zA-Z0-9_.-]*railway\.app/g, 'https://viap-backend.onrender.com');
  const normalizedEndpoint = sanitizedEndpoint.startsWith('/') ? sanitizedEndpoint : `/${sanitizedEndpoint}`;
  const apiBase = getApiBase();
  const primaryUrl = sanitizedEndpoint.startsWith('http') ? sanitizedEndpoint : `${apiBase}${normalizedEndpoint}`;
  const fallbackUrl = sanitizedEndpoint.startsWith('http') ? sanitizedEndpoint : normalizedEndpoint;

  const headers = new Headers(init.headers);
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (typeof window !== 'undefined') {
    try {
      const sessionStr = localStorage.getItem('kdp_active_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        const orgId = session?.organisationId || session?.organisation?.id;
        const tenantCode = session?.organisation?.code;
        if (orgId && !headers.has('x-organisation-id')) {
          headers.set('x-organisation-id', orgId);
        }
        if (tenantCode && !headers.has('x-tenant-code')) {
          headers.set('x-tenant-code', tenantCode);
        }
      }

      if (!headers.has('x-tenant-code')) {
        const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
        const urlTenant = urlParams.get('app') || urlParams.get('tenant');
        if (urlTenant) {
          headers.set('x-tenant-code', urlTenant);
        }
      }
    } catch {}
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
    if (!isMobileClient() && fallbackUrl !== primaryUrl && !fallbackUrl.startsWith('http')) {
      try {
        res = await fetch(fallbackUrl, {
          ...init,
          headers,
          credentials: 'include',
        });
      } catch (secondErr: any) {
        throw new Error(secondErr?.message || 'Failed to communicate with API server. Please check your backend connection.');
      }
    } else {
      throw new Error('Unable to connect to the cloud server. Please check your internet connection and try again.');
    }
  }

  const rawText = await res.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE') || rawText.includes('<!doctype')) {
      throw new Error('Cloud backend is waking up or initializing. Please retry in 10-15 seconds.');
    }
    throw new Error('Unexpected response format received from server.');
  }

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    errMessage = json?.error?.message || json?.message || errMessage;
    const err: any = new Error(errMessage);
    err.status = res.status;
    err.statusCode = res.status;
    err.code = json?.error?.code || json?.code;
    err.data = json?.data;
    throw err;
  }

  return {
    data: json?.data !== undefined ? json.data : json,
    meta: json?.meta,
  };
}
