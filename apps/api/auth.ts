import { verifyToken } from '@clerk/backend';
import type { NextFunction, Request, Response } from 'express';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authz = req.headers.authorization;
    if (!authz || !authz.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization token' });
      return;
    }

    const payload = await verifyToken(authz.slice(7), { secretKey: CLERK_SECRET_KEY });

    if (!payload || !payload.sub) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    res.locals.userId = payload.sub;
    next();
  } catch (err) {
    console.error('Auth verification failed:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

export function userIdOf(res: Response): string {
  return res.locals.userId as string;
}