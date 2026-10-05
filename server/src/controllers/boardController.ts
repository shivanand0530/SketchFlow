import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BoardService, boardDocumentSchema, boardObjectSchema } from '../services/boardService.js';
import type { BoardMember } from '../types.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const boardNameSchema = z.object({ name: z.string().trim().min(1).max(160) }).strict();
const objectIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/);
const objectPatchSchema = boardObjectSchema.partial();
const memberRoleSchema = z.enum(['editor', 'viewer']);
const memberSchema = z.object({ userId: z.string().uuid(), role: memberRoleSchema }).strict();

export class BoardController {
  constructor(private readonly service = new BoardService()) {}

  private userId(request: Request): string {
    return (request as AuthenticatedRequest).userId;
  }

  private param(request: Request, name: string): string {
    return name === 'boardId' ? this.boardId(request) : objectIdSchema.parse(request.params[name]);
  }

  private boardId(request: Request): string {
    return z.string().uuid().parse(request.params.boardId);
  }

  private operationId(request: Request): string {
    return z.string().uuid().parse(request.header('x-operation-id'));
  }

  private async run(handler: () => Promise<unknown>, response: Response, next: NextFunction, status = 200) {
    try {
      const result = await handler();
      if (result === undefined) response.status(204).send();
      else response.status(status).json(result);
    } catch (error) { next(error); }
  }

  create = (request: Request, response: Response, next: NextFunction) => this.run(async () => {
    const body = boardNameSchema.parse(request.body);
    return this.service.create(body.name, this.userId(request));
  }, response, next, 201);

  list = (request: Request, response: Response, next: NextFunction) => this.run(() => this.service.list(this.userId(request)), response, next);
  get = (request: Request, response: Response, next: NextFunction) => this.run(() => this.service.get(this.boardId(request), this.userId(request)), response, next);
  update = (request: Request, response: Response, next: NextFunction) => this.run(async () => this.service.update(this.boardId(request), this.userId(request), boardNameSchema.parse(request.body).name), response, next);
  delete = (request: Request, response: Response, next: NextFunction) => this.run(async () => { await this.service.delete(this.boardId(request), this.userId(request)); return undefined; }, response, next);

  listObjects = (request: Request, response: Response, next: NextFunction) => this.run(() => this.service.load(this.param(request, 'boardId'), this.userId(request)), response, next);
  createObject = (request: Request, response: Response, next: NextFunction) => this.run(async () => (await this.service.applyObjectOperation(this.param(request, 'boardId'), this.userId(request), this.operationId(request), 'CREATE_OBJECT', boardObjectSchema.parse(request.body))).eventPayload, response, next, 201);
  updateObject = (request: Request, response: Response, next: NextFunction) => this.run(async () => (await this.service.applyObjectOperation(this.param(request, 'boardId'), this.userId(request), this.operationId(request), 'UPDATE_OBJECT', { objectId: objectIdSchema.parse(this.param(request, 'objectId')), updates: objectPatchSchema.parse(request.body) })).eventPayload, response, next);
  deleteObject = (request: Request, response: Response, next: NextFunction) => this.run(async () => { await this.service.applyObjectOperation(this.param(request, 'boardId'), this.userId(request), this.operationId(request), 'DELETE_OBJECT', { objectId: objectIdSchema.parse(this.param(request, 'objectId')) }); return undefined; }, response, next);

  history = (request: Request, response: Response, next: NextFunction) => this.run(async () => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(request.query);
    const { limit, offset } = query;
    return this.service.history(this.param(request, 'boardId'), this.userId(request), limit, offset);
  }, response, next);

  listMembers = (request: Request, response: Response, next: NextFunction) => this.run(() => this.service.listMembers(this.param(request, 'boardId'), this.userId(request)), response, next);
  addMember = (request: Request, response: Response, next: NextFunction) => this.run(async () => {
    const body = memberSchema.parse(request.body);
    return this.service.addMember(this.param(request, 'boardId'), this.userId(request), body.userId, body.role as BoardMember['role']);
  }, response, next, 201);

  updateMember = (request: Request, response: Response, next: NextFunction) => this.run(async () => {
    const body = z.object({ role: memberRoleSchema }).strict().parse(request.body);
    return this.service.updateMember(this.param(request, 'boardId'), this.userId(request), z.string().uuid().parse(this.param(request, 'userId')), body.role as BoardMember['role']);
  }, response, next);

  deleteMember = (request: Request, response: Response, next: NextFunction) => this.run(async () => {
    await this.service.deleteMember(this.param(request, 'boardId'), this.userId(request), z.string().uuid().parse(this.param(request, 'userId')));
    return undefined;
  }, response, next);

  createShareToken = (request: Request, response: Response, next: NextFunction) => this.run(() => this.service.createShareToken(this.param(request, 'boardId'), this.userId(request)), response, next);
  acceptShareToken = (request: Request, response: Response, next: NextFunction) => this.run(async () => {
    const body = z.object({ token: z.string().min(1).max(4096) }).strict().parse(request.body);
    return this.service.acceptShareToken(body.token, this.userId(request));
  }, response, next);

  saveDocument = (request: Request, response: Response, next: NextFunction) => this.run(() => this.service.save(this.param(request, 'boardId'), this.userId(request), boardDocumentSchema.parse(request.body)), response, next);
}