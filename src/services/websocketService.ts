import type { BoardObject } from '@shared/canvas';
import { collaborationClientEvents, collaborationServerEvents, type CollaborationCursor, type CollaborationServerEvent } from '@shared/collaboration';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
type Listener = (event: CollaborationServerEvent) => void;

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL ?? API_URL.replace(/^http/, 'ws');

export class WebSocketService {
  private socket: WebSocket | null = null;
  private boardId: string | null = null;
  private reconnectTimer: number | undefined;
  private reconnectAttempt = 0;
  private joined = false;
  private shouldReconnect = true;
  private status: ConnectionStatus = 'disconnected';
  private readonly listeners = new Set<Listener>();
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();

  connect(boardId: string) {
    if (this.boardId && this.boardId !== boardId) this.disconnect();
    this.boardId = boardId;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.open();
  }

  disconnect() {
    this.shouldReconnect = false;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.joined = false;
    if (this.boardId) this.send(collaborationClientEvents.leaveBoard, undefined, this.boardId);
    this.socket?.close();
    this.socket = null;
    this.setStatus('disconnected');
  }

  subscribe(listener: Listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  subscribeStatus(listener: (status: ConnectionStatus) => void) { this.statusListeners.add(listener); listener(this.status); return () => this.statusListeners.delete(listener); }
  createObject(object: BoardObject) { return this.send(collaborationClientEvents.createObject, object); }
  updateObject(objectId: string, updates: Partial<BoardObject>) { return this.send(collaborationClientEvents.updateObject, { objectId, updates }); }
  deleteObject(objectId: string) { return this.send(collaborationClientEvents.deleteObject, { objectId }); }
  undo() { return this.send(collaborationClientEvents.undo, undefined); }
  redo() { return this.send(collaborationClientEvents.redo, undefined); }
  moveCursor(cursor: CollaborationCursor) { return this.send(collaborationClientEvents.cursorMove, cursor); }
  get connected() { return this.socket?.readyState === WebSocket.OPEN && this.joined; }

  private open() {
    const token = localStorage.getItem('sketchflow-access-token');
    if (!token || !this.boardId) return;
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) return;
    this.setStatus('reconnecting');
    const socket = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);
    this.socket = socket;
    this.joined = false;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.reconnectAttempt = 0;
      this.send(collaborationClientEvents.joinBoard, undefined, this.boardId!);
    };
    socket.onmessage = (message) => {
      if (this.socket !== socket) return;
      try {
        const event = JSON.parse(message.data) as CollaborationServerEvent;
        if (event.type === collaborationServerEvents.presenceUpdate && event.boardId === this.boardId) {
          this.joined = true;
          this.setStatus('connected');
        }
        this.listeners.forEach((listener) => listener(event));
      } catch { /* Ignore malformed server messages. */ }
    };
    socket.onerror = () => { if (this.socket === socket) this.setStatus('reconnecting'); };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.joined = false;
      if (!this.shouldReconnect) return;
      this.setStatus('reconnecting');
      const delay = Math.min(10000, 1000 * 2 ** this.reconnectAttempt) + Math.round(Math.random() * 250);
      this.reconnectAttempt += 1;
      this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = undefined; this.open(); }, delay);
    };
  }

  private send(type: string, payload: unknown, boardId = this.boardId) {
    if (!boardId) return undefined;
    const operationId = crypto.randomUUID();
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type, boardId, operationId, timestamp: Date.now(), payload }));
    return operationId;
  }

  private setStatus(status: ConnectionStatus) { this.status = status; this.statusListeners.forEach((listener) => listener(status)); }
}

export { collaborationServerEvents };