import type { BoardDocument, BoardObject } from '@shared/canvas';
import type { Note, Shape } from '@/store/canvasSlice';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role?: 'owner' | 'editor' | 'viewer';
}

export interface CanvasSnapshot {
  shapes: Shape[];
  notes: Note[];
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = localStorage.getItem('sketchflow-access-token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  if (!response.ok) {
    let message = `SketchFlow API request failed: ${response.status}`;
    try {
      const body = await response.json() as { error?: string | { message?: string } };
      const apiMessage = typeof body.error === 'string' ? body.error : body.error?.message;
      if (apiMessage) message = apiMessage;
    } catch { /* Keep the status-based message. */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const listBoards = () => request<Board[]>('/api/boards');
export const createBoard = (name: string) => request<Board>('/api/boards', { method: 'POST', body: JSON.stringify({ name }) });
export const getBoard = (boardId: string) => request<Board>(`/api/boards/${boardId}`);
export const updateBoard = (boardId: string, name: string) => request<Board>(`/api/boards/${boardId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
export const deleteBoard = (boardId: string) => request<void>(`/api/boards/${boardId}`, { method: 'DELETE' });
export const createBoardShareToken = (boardId: string) => request<string>(`/api/boards/${boardId}/share`, { method: 'POST' });
export const acceptBoardShareToken = (token: string) => request<Board>('/api/boards/share/accept', { method: 'POST', body: JSON.stringify({ token }) });
export interface BoardMember { boardId: string; userId: string; role: 'owner' | 'editor' | 'viewer'; }
export const listMembers = (boardId: string) => request<BoardMember[]>(`/api/boards/${boardId}/members`);
export const addMember = (boardId: string, userId: string, role: 'editor' | 'viewer') => request<BoardMember>(`/api/boards/${boardId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) });
export const updateMember = (boardId: string, userId: string, role: 'editor' | 'viewer') => request<BoardMember>(`/api/boards/${boardId}/members/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const removeMember = (boardId: string, userId: string) => request<void>(`/api/boards/${boardId}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const listBoardObjects = (boardId: string) => request<BoardDocument>(`/api/boards/${boardId}/objects`);
const operationHeaders = () => ({ 'x-operation-id': crypto.randomUUID() });
export const createBoardObject = (boardId: string, object: BoardObject) => request<BoardObject>(`/api/boards/${boardId}/objects`, { method: 'POST', headers: operationHeaders(), body: JSON.stringify(object) });
export const updateBoardObject = (boardId: string, object: BoardObject) => request<BoardObject>(`/api/boards/${boardId}/objects/${encodeURIComponent(object.id)}`, { method: 'PATCH', headers: operationHeaders(), body: JSON.stringify(object) });
export const deleteBoardObject = (boardId: string, objectId: string) => request<void>(`/api/boards/${boardId}/objects/${encodeURIComponent(objectId)}`, { method: 'DELETE', headers: operationHeaders() });
export interface BoardHistory { items: Array<{ id: string; boardId: string; userId: string; operationId: string; sequence: string; type: string; action: string; timestamp: string }>; canUndo: boolean; canRedo: boolean; limit: number; offset: number; }
export const listBoardHistory = (boardId: string) => request<BoardHistory>(`/api/boards/${boardId}/history?limit=50`);

export const syncBoardObjects = async (boardId: string, document: BoardDocument): Promise<void> => {
  const remote = await listBoardObjects(boardId);
  const localById = new Map(document.objects.map((object) => [object.id, object]));
  const remoteById = new Map(remote.objects.map((object) => [object.id, object]));
  await Promise.all(document.objects.map((object) => remoteById.has(object.id) ? updateBoardObject(boardId, object) : createBoardObject(boardId, object)));
  await Promise.all(remote.objects.filter((object) => !localById.has(object.id)).map((object) => deleteBoardObject(boardId, object.id)));
};

const dimensionsForShape = (shape: Shape) => {
  if (shape.type === 'circle') {
    const diameter = (shape.properties.radius ?? 0) * 2;
    return { width: diameter, height: diameter };
  }
  if (shape.type === 'rectangle') return { width: shape.properties.width ?? 0, height: shape.properties.height ?? 0 };
  if (shape.type === 'point') return { width: 0, height: 0 };
  const points = shape.properties.points ?? [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0, height: ys.length ? Math.max(...ys) - Math.min(...ys) : 0 };
};

export const toBoardDocument = ({ shapes, notes }: CanvasSnapshot): BoardDocument => ({
  objects: [
    ...shapes.map((shape): BoardObject => ({ id: shape.id, type: shape.type, position: { x: shape.properties.x ?? shape.properties.points?.[0]?.x ?? shape.properties.start?.x ?? 0, y: shape.properties.y ?? shape.properties.points?.[0]?.y ?? shape.properties.start?.y ?? 0 }, dimensions: dimensionsForShape(shape), rotation: shape.rotation ?? 0, style: { color: shape.color }, properties: shape.properties })),
    ...notes.map((note): BoardObject => ({ id: note.id, type: 'note', position: { x: note.x, y: note.y }, dimensions: { width: note.width ?? 180, height: note.height ?? 90 }, rotation: 0, style: { color: note.color, textColor: note.textColor }, text: note.text })),
  ],
});

export const fromBoardDocument = (document: BoardDocument): CanvasSnapshot => document.objects.reduce<CanvasSnapshot>((snapshot, object) => {
  if (object.type === 'note') {
    snapshot.notes.push({ id: object.id, text: object.text ?? '', x: object.position.x, y: object.position.y, color: object.style.color, width: object.dimensions.width, height: object.dimensions.height, textColor: object.style.textColor, timestamp: Date.now() });
  } else {
    snapshot.shapes.push({ id: object.id, type: object.type, color: object.style.color, timestamp: Date.now(), rotation: object.rotation, properties: object.properties as Shape['properties'] });
  }
  return snapshot;
}, { shapes: [], notes: [] });