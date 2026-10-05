import type { NextFunction, Request, Response } from 'express';
import { UserService } from '../services/userService.js';
import { logger } from '../logging.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

const userService = new UserService();

export const requireAuth = (request: Request, _response: Response, next: NextFunction) => {
  const header = request.header('authorization');
  if (!header || !/^Bearer [^\s]+$/.test(header)) {
    logger.warn('Authentication failed', { reason: 'missing_or_malformed_header' });
    const error = new Error('Authentication required');
    Object.assign(error, { statusCode: 401 });
    return next(error);
  }
  try {
    (request as AuthenticatedRequest).userId = userService.verifyToken(header.slice(7));
    return next();
  } catch (error) {
    return next(error);
  }
};