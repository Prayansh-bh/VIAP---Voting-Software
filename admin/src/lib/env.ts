/**
 * Runtime Environment Configuration for VIAP Admin Application
 */

export const getAppUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) {
    return (import.meta.env.VITE_APP_URL as string).replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://frontend-prayansh-bh-projects.vercel.app';
    }
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
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://viap-backend.onrender.com/api';
  }
  return 'http://localhost:4000/api';
};
