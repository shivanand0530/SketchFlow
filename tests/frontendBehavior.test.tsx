import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { ProtectedRoute } from '../src/auth/ProtectedRoute';
import * as authService from '../src/services/authService';
import { fromBoardDocument, listBoards, toBoardDocument } from '../src/services/boardService';
import { WebSocketService } from '../src/services/websocketService';
import canvasReducer, { addShape, redo, undo, type Shape } from '../src/store/canvasSlice';
import collaborationReducer, { setCursor, setPresence } from '../src/store/collaborationSlice';

const user = { id: '00000000-0000-0000-0000-000000000001', email: 'user@example.com', displayName: 'User' };
const shape: Shape = { id: 'shape-1', type: 'rectangle', color: '#000000', timestamp: 1, properties: { x: 1, y: 2, width: 10, height: 20 } };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function AuthProbe() {
  const { user: current, loading, login, register } = useAuth();
  return <div><span data-testid="loading">{String(loading)}</span><span data-testid="user">{current?.displayName ?? 'anonymous'}</span><button onClick={() => void login(user.email, 'password123')}>login</button><button onClick={() => void register('new@example.com', 'New User', 'password123')}>register</button></div>;
}

describe('frontend authentication and protected routes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads the current user and stores a login token', async () => {
    vi.spyOn(authService, 'currentUser').mockRejectedValue(new Error('Not authenticated'));
    vi.spyOn(authService, 'login').mockResolvedValue({ user, accessToken: 'access-token' });
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    screen.getByRole('button', { name: 'login' }).click();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('User'));
    expect(localStorage.getItem('sketchflow-access-token')).toBe('access-token');
  });

  it('registers a user and stores the returned token', async () => {
    vi.spyOn(authService, 'currentUser').mockRejectedValue(new Error('Not authenticated'));
    vi.spyOn(authService, 'register').mockResolvedValue({ user, accessToken: 'registered-token' });
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    screen.getByRole('button', { name: 'register' }).click();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('User'));
    expect(authService.register).toHaveBeenCalledWith('new@example.com', 'New User', 'password123');
    expect(localStorage.getItem('sketchflow-access-token')).toBe('registered-token');
  });

  it('redirects unauthenticated users while preserving the return path', async () => {
    vi.spyOn(authService, 'currentUser').mockRejectedValue(new Error('Not authenticated'));
    render(<MemoryRouter initialEntries={['/canvas?board=board-1']}><AuthProvider><Routes><Route element={<ProtectedRoute />}><Route path="/canvas" element={<div>canvas</div>} /></Route><Route path="/login" element={<div>login</div>} /></Routes></AuthProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('login')).toBeInTheDocument());
  });
});

describe('frontend board and canvas state', () => {
  it('round-trips canvas objects through the board document format', () => {
    const document = toBoardDocument({ shapes: [shape], notes: [] });
    expect(document.objects[0]).toMatchObject({ id: 'shape-1', type: 'rectangle', position: { x: 1, y: 2 } });
    expect(fromBoardDocument(document).shapes[0]).toMatchObject({ id: 'shape-1', type: 'rectangle', color: '#000000' });
  });

  it('loads boards through the authenticated API service', async () => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 'board-1', name: 'Board', createdBy: user.id, createdAt: '', updatedAt: '', role: 'owner' }]), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(listBoards()).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/boards', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }));
  });

  it('records canvas changes and supports local state undo/redo', () => {
    let state = canvasReducer(undefined, addShape(shape));
    expect(state.shapes).toHaveLength(1);
    state = canvasReducer(state, undo());
    expect(state.shapes).toHaveLength(0);
    state = canvasReducer(state, redo());
    expect(state.shapes).toHaveLength(1);
  });
});

describe('frontend collaboration state and websocket recovery', () => {
  it('accepts remote presence and cursor state only for active users', () => {
    let state = collaborationReducer(undefined, setPresence([{ userId: 'remote', displayName: 'Remote', color: '#fff000', boardId: 'board' }]));
    state = collaborationReducer(state, setCursor({ userId: 'remote', boardId: 'board', x: 5, y: 8 }));
    expect(state.users.remote.displayName).toBe('Remote');
    expect(state.cursors.remote).toMatchObject({ x: 5, y: 8 });
  });

  it('sends authenticated events and reconnects after a socket close', () => {
    localStorage.setItem('sketchflow-access-token', 'token');
    class FakeWebSocket {
      static OPEN = 1;
      readyState = 0;
      sent: string[] = [];
      onopen?: () => void;
      onclose?: () => void;
      onmessage?: (event: { data: string }) => void;
      onerror?: () => void;
      constructor(public readonly url: string) { instances.push(this); }
      send(value: string) { this.sent.push(value); }
      close() { this.readyState = 3; this.onclose?.(); }
    }
    const instances: FakeWebSocket[] = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-0000-0000-000000000002' });
    vi.useFakeTimers();
    const service = new WebSocketService();
    const statuses: string[] = [];
    service.subscribeStatus((status) => statuses.push(status));
    service.connect('00000000-0000-0000-0000-000000000003');
    const first = instances[0];
    first.readyState = FakeWebSocket.OPEN;
    first.onopen?.();
    expect(JSON.parse(first.sent[0])).toMatchObject({ type: 'JOIN_BOARD', boardId: '00000000-0000-0000-0000-000000000003' });
    first.close();
    vi.advanceTimersByTime(1300);
    expect(instances).toHaveLength(2);
    expect(statuses).toContain('reconnecting');
    vi.useRealTimers();
  });

  it('delivers remote WebSocket events to subscribers', () => {
    localStorage.setItem('sketchflow-access-token', 'token');
    class FakeWebSocket {
      static OPEN = 1;
      readyState = 0;
      onopen?: () => void;
      onmessage?: (event: { data: string }) => void;
      constructor() { instances.push(this); }
      send() { return undefined; }
      close() { return undefined; }
    }
    const instances: FakeWebSocket[] = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-0000-0000-000000000002' });
    const service = new WebSocketService();
    const received: unknown[] = [];
    service.subscribe((event) => received.push(event));
    service.connect('00000000-0000-0000-0000-000000000003');
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'OBJECT_UPDATED', boardId: '00000000-0000-0000-0000-000000000003', userId: 'remote', payload: { id: 'shape-1' }, timestamp: Date.now() }) });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'OBJECT_UPDATED', userId: 'remote' });
  });
});

describe('frontend API error handling', () => {
  it('surfaces structured backend errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Board access denied' } }), { status: 403, headers: { 'Content-Type': 'application/json' } })));
    await expect(listBoards()).rejects.toThrow('Board access denied');
  });
});
