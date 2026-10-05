import type { BoardDocument, BoardObject } from '../../shared/canvas.js';

export type { BoardDocument, BoardObject };

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role?: BoardMember['role'];
}

export interface BoardMember {
  boardId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
}

export type BoardObjectInput = BoardObject;
