import type { Request, Response, NextFunction } from 'express';
import { getSession, type AuthUser } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  sessionToken?: string;
  authUser?: AuthUser;
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }

  const altHeader = req.headers['x-session-token'];
  if (typeof altHeader === 'string') {
    return altHeader;
  }

  if (typeof req.query.token === 'string') {
    return req.query.token;
  }

  return undefined;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const session = getSession(token);

  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  req.sessionToken = token;
  req.authUser = session.user;
  next();
}
