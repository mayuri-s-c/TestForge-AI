import { randomUUID } from 'crypto';

export const SESSION_DURATION_MS = 15 * 60 * 1000;
export const SESSION_WARNING_MS = 14 * 60 * 1000;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
}

interface SessionRecord {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

const sessions = new Map<string, SessionRecord>();

function getConfiguredUser(): AuthUser {
  const username = process.env.AUTH_USERNAME || 'admin';
  const email = process.env.AUTH_EMAIL || 'admin@example.com';
  const displayName = process.env.AUTH_DISPLAY_NAME || username;

  return {
    id: 'default-user',
    username,
    email,
    displayName,
  };
}

function getConfiguredPassword(): string {
  return process.env.AUTH_PASSWORD || 'admin123';
}

export function validateCredentials(login: string, password: string): AuthUser | null {
  const user = getConfiguredUser();
  const expectedPassword = getConfiguredPassword();
  const normalizedLogin = login.trim().toLowerCase();

  const loginMatches =
    normalizedLogin === user.username.toLowerCase() ||
    normalizedLogin === user.email.toLowerCase();

  if (!loginMatches || password !== expectedPassword) {
    return null;
  }

  return user;
}

export function createSession(user: AuthUser): SessionRecord {
  const token = randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session: SessionRecord = { token, user, expiresAt };
  sessions.set(token, session);
  return session;
}

export function getSession(token: string | undefined): SessionRecord | null {
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

export function extendSession(token: string): SessionRecord | null {
  const session = getSession(token);
  if (!session) return null;

  session.expiresAt = Date.now() + SESSION_DURATION_MS;
  sessions.set(token, session);
  return session;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export function getSessionPublicView(session: SessionRecord) {
  return {
    user: session.user,
    expiresAt: session.expiresAt,
    warningAt: session.expiresAt - (SESSION_DURATION_MS - SESSION_WARNING_MS),
    sessionDurationMs: SESSION_DURATION_MS,
  };
}
