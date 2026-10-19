/**
 * Runtime Environment Configuration for VIAP Field / Tenant Application
 */

export const getAdminUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_URL) {
    return (import.meta.env.VITE_ADMIN_URL as string).replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export const getApiUrl = (): string => {
  if (typeof import.meta !== 'undefined') {
    const raw = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL;
    if (raw) {
      return (raw as string).replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    return '';
  }
  return 'http://localhost:4000';
};
