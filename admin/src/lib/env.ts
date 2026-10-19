/**
 * Runtime Environment Configuration for VIAP Admin Application
 */

export const getAppUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) {
    return (import.meta.env.VITE_APP_URL as string).replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return 'http://localhost:3000';
};

export const getApiUrl = (): string => {
  if (typeof import.meta !== 'undefined') {
    const raw = (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || '').trim();
    if (raw) {
      const cleaned = raw.replace(/\/+$/, '');
      return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
    }
  }
  return 'http://localhost:4000/api';
};
