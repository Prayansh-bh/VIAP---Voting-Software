/**
 * Runtime Environment Configuration for VIAP Field / Tenant Application
 */

export const getAdminUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_URL) {
    const raw = (import.meta.env.VITE_ADMIN_URL as string).trim();
    if (raw && !raw.includes('railway.app')) {
      return raw.replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://admin-delta-five-56.vercel.app';
    }
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export const getApiUrl = (): string => {
  if (typeof import.meta !== 'undefined') {
    const raw = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || '').trim();
    if (raw && !raw.includes('railway.app')) {
      return raw.replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://viap-backend.onrender.com';
    }
    return '';
  }
  return 'http://localhost:4000';
};
