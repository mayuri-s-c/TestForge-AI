import { Router, type Request, type Response } from 'express';
import {
  validateCredentials,
  createSession,
  destroySession,
  extendSession,
  getSession,
  getSessionPublicView,
} from '../services/authService.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }

  const altHeader = req.headers['x-session-token'];
  if (typeof altHeader === 'string') {
    return altHeader;
  }

  return undefined;
}

router.post('/login', (req: Request, res: Response) => {
  const { login, password } = req.body as { login?: string; password?: string };

  if (!login?.trim() || !password) {
    res.status(400).json({ error: 'Email/username and password are required' });
    return;
  }

  const user = validateCredentials(login, password);
  if (!user) {
    res.status(401).json({ error: 'Invalid email/username or password' });
    return;
  }

  const session = createSession(user);
  res.json({
    token: session.token,
    ...getSessionPublicView(session),
  });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const session = getSession(req.sessionToken);
  if (!session) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  res.json(getSessionPublicView(session));
});

router.post('/extend', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const session = extendSession(req.sessionToken!);
  if (!session) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  res.json(getSessionPublicView(session));
});

router.post('/logout', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (token) {
    destroySession(token);
  }

  res.json({ message: 'Logged out' });
});

export default router;
