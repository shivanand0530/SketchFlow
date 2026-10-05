import type { NextFunction, Request, Response } from 'express';
import { registerSchema, loginSchema, UserService } from '../services/userService.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class AuthController {
  constructor(private readonly service = new UserService()) {}

  register = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const body = registerSchema.parse(request.body);
      response.status(201).json(await this.service.register(body.email, body.displayName, body.password));
    } catch (error) { next(error); }
  };

  login = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(request.body);
      response.json(await this.service.login(body.email, body.password));
    } catch (error) { next(error); }
  };

  me = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const user = await this.service.me((request as AuthenticatedRequest).userId);
      if (!user) {
        const error = new Error('User not found');
        Object.assign(error, { statusCode: 401 });
        throw error;
      }
      response.json(user);
    } catch (error) { next(error); }
  };
}