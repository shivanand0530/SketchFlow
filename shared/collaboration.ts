import type { BoardObject } from './canvas.js';

export const collaborationClientEvents = {
  joinBoard: 'JOIN_BOARD',
  leaveBoard: 'LEAVE_BOARD',
  createObject: 'CREATE_OBJECT',
  updateObject: 'UPDATE_OBJECT',
  deleteObject: 'DELETE_OBJECT',
  undo: 'UNDO',
  redo: 'REDO',
  cursorMove: 'CURSOR_MOVE',
} as const;

export const collaborationServerEvents = {
  userJoined: 'USER_JOINED',
  userLeft: 'USER_LEFT',
  presenceUpdate: 'PRESENCE_UPDATE',
  objectCreated: 'OBJECT_CREATED',
  objectUpdated: 'OBJECT_UPDATED',
  objectDeleted: 'OBJECT_DELETED',
  operationUndone: 'OPERATION_UNDONE',
  operationRedone: 'OPERATION_REDONE',
  cursorMoved: 'CURSOR_MOVED',
  error: 'ERROR',
} as const;

export const collaborationColors = ['#e76f51', '#2a9d8f', '#e9c46a', '#457b9d', '#9b5de5', '#f15bb5', '#00bbf9', '#8ab17d'] as const;

export interface CollaborationPresence {
  userId: string;
  displayName: string;
  color: string;
  boardId: string;
}

export interface CollaborationCursor {
  userId: string;
  boardId: string;
  x: number;
  y: number;
}

export function collaborationColor(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) hash = (hash * 31 + userId.charCodeAt(index)) | 0;
  return collaborationColors[Math.abs(hash) % collaborationColors.length];
}

export interface CollaborationServerEvent {
  type: string;
  boardId: string;
  userId: string;
  operationId?: string;
  timestamp: number;
  payload?: unknown;
}

export type CollaborationClientEvent = {
  type: string;
  boardId: string;
  operationId?: string;
  timestamp: number;
  payload?: BoardObject | { objectId: string; updates: Partial<BoardObject> } | { objectId: string } | CollaborationCursor;
};