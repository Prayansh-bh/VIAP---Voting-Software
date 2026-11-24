/**
 * Runtime Environment Configuration for VIAP Admin Application
 */

export const getAppUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) {
    const raw = (import.meta.env.VITE_APP_URL as string).trim();
    if (raw && !raw.includes('railway.app') && !raw.includes('vercel.app')) {
      return raw.replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('livesurvey.tech') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `${window.location.protocol}//viap.${host.replace(/^admin\./, '')}`;
    }
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://viap.livesurvey.tech';
    }
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return 'http://localhost:3000';
};

export const getApiUrl = (): string => {
  if (typeof import.meta !== 'undefined') {
    const raw = (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || '').trim();
    if (raw && !raw.includes('railway.app') && !raw.includes('vercel.app')) {
      const cleaned = raw.replace(/\/+$/, '');
      return cleaned.endsWith('/api') ? cleaned : `${cleaned}/api`;
    }
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('livesurvey.tech')) {
      return 'https://viap.livesurvey.tech/api';
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `${window.location.protocol}//${host}:4000/api`;
    }
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://viap.livesurvey.tech/api';
    }
  }
  return 'http://localhost:4000/api';
};
