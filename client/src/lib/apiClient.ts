import { clearAuthToken, getAuthToken } from './authStorage';

const API_BASE = '/api';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && path !== '/auth/login') {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  return response;
}

export function getAuthenticatedUrl(path: string): string {
  const token = getAuthToken();
  if (!token) return `${API_BASE}${path}`;
  const separator = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${separator}token=${encodeURIComponent(token)}`;
}
