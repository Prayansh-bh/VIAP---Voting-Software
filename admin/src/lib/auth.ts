import { AdminUser } from '../types';

const ADMIN_TOKEN_KEY = 'cms_admin_token';
const ADMIN_USER_KEY = 'cms_admin_user';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return null;
  // If stale mock token (not a 3-part signed JWT), purge it
  if (!token.startsWith('eyJ') || token.split('.').length !== 3) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    return null;
  }
  return token;
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export function getAdminSession(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const token = getAdminToken();
  if (!token) return null;
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAdminSession(user: AdminUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}
