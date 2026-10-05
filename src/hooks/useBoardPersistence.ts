import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { replaceDocument } from '@/store/canvasSlice';
import { acceptBoardShareToken, fromBoardDocument, listBoardHistory, listBoardObjects, syncBoardObjects, toBoardDocument, type CanvasSnapshot } from '@/services/boardService';
import { WebSocketService, collaborationServerEvents, type ConnectionStatus } from '@/services/websocketService';
import { useAuth } from '@/auth/AuthContext';
import { collaborationColor, type CollaborationCursor, type CollaborationPresence } from '@shared/collaboration';
import { addUser, clearCollaboration, pruneCursors, removeUser, setConnectionState, setCurrentUser, setCursor, setHistoryAvailability, setPresence } from '@/store/collaborationSlice';

const parseLocalBoard = (saved: string | null): CanvasSnapshot => {
  if (!saved) return { shapes: [], notes: [] };
  const parsed = JSON.parse(saved) as CanvasSnapshot & { objects?: unknown[] };
  if (Array.isArray(parsed.objects)) return fromBoardDocument(parsed as Parameters<typeof fromBoardDocument>[0]);
  return {
    shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  };
};

export function useBoardPersistence() {
  const dispatch = useAppDispatch();
  const shapes = useAppSelector((state) => state.canvas.shapes);
  const notes = useAppSelector((state) => state.canvas.notes);
  const [searchParams] = useSearchParams();
  const boardId = searchParams.get('board');
  const inviteToken = searchParams.get('invite');
  const hasLoaded = useRef(false);
  const localBoardId = boardId ?? 'default';
  const localKey = `sketchflow-board-${localBoardId}`;
  const socketRef = useRef<WebSocketService | null>(null);
  const applyingRemoteRef = useRef(false);
  const pendingOperationsRef = useRef(new Set<string>());
  const previousDocumentRef = useRef<ReturnType<typeof toBoardDocument> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const { user } = useAuth();

  useEffect(() => {
    dispatch(setCurrentUser(user && boardId ? { userId: user.id, displayName: user.displayName, color: collaborationColor(user.id), boardId } : null));
    return () => { dispatch(clearCollaboration()); };
  }, [boardId, dispatch, user]);

  useEffect(() => {
    if (!boardId) return;
    const cleanup = window.setInterval(() => dispatch(pruneCursors(Date.now())), 3000);
    return () => window.clearInterval(cleanup);
  }, [boardId, dispatch]);

  useEffect(() => {
    if (!boardId) return;
    const service = new WebSocketService();
    socketRef.current = service;
    const unsubscribeStatus = service.subscribeStatus((status) => {
      setConnectionStatus(status);
      dispatch(setConnectionState(status));
      if (status === 'connected') {
        Promise.all([listBoardObjects(boardId), listBoardHistory(boardId)]).then(([document, history]) => {
          previousDocumentRef.current = document;
          dispatch(replaceDocument(fromBoardDocument(document)));
          dispatch(setHistoryAvailability(history));
        }).catch((error) => console.error('Unable to resynchronize board:', error));
      }
    });
    const unsubscribe = service.subscribe((event) => {
      if (event.operationId) pendingOperationsRef.current.delete(event.operationId);
      if (event.type === collaborationServerEvents.presenceUpdate) {
        dispatch(setPresence((event.payload ?? []) as CollaborationPresence[]));
        return;
      }
      if (event.type === collaborationServerEvents.userJoined) {
        dispatch(addUser(event.payload as CollaborationPresence));
        window.dispatchEvent(new CustomEvent('sketchflow:collaboration', { detail: event }));
        return;
      }
      if (event.type === collaborationServerEvents.userLeft) {
        dispatch(removeUser((event.payload as { userId: string }).userId));
        window.dispatchEvent(new CustomEvent('sketchflow:collaboration', { detail: event }));
        return;
      }
      if (event.type === collaborationServerEvents.cursorMoved) {
        dispatch(setCursor(event.payload as CollaborationCursor));
        return;
      }
      if (event.type === collaborationServerEvents.error || event.type === collaborationServerEvents.objectCreated || event.type === collaborationServerEvents.objectUpdated || event.type === collaborationServerEvents.objectDeleted || event.type === collaborationServerEvents.operationUndone || event.type === collaborationServerEvents.operationRedone) {
        applyingRemoteRef.current = true;
        Promise.all([listBoardObjects(boardId), listBoardHistory(boardId)]).then(([document, history]) => {
          previousDocumentRef.current = document;
          dispatch(replaceDocument(fromBoardDocument(document)));
          dispatch(setHistoryAvailability(history));
        }).catch((error) => console.error('Unable to apply collaboration update:', error)).finally(() => { applyingRemoteRef.current = false; });
      }
    });
    const connect = () => service.connect(boardId);
    if (inviteToken) acceptBoardShareToken(inviteToken).then(connect).catch((error) => console.error('Unable to accept board invite:', error));
    else connect();
    return () => { unsubscribe(); unsubscribeStatus(); service.disconnect(); socketRef.current = null; dispatch(clearCollaboration()); };
  }, [boardId, dispatch, inviteToken]);

  useEffect(() => {
    const requestHistoryAction = (event: Event) => {
      if (!boardId || !socketRef.current?.connected) return;
      const type = (event as CustomEvent<'undo' | 'redo'>).detail;
      const operationId = type === 'undo' ? socketRef.current.undo() : socketRef.current.redo();
      if (operationId) pendingOperationsRef.current.add(operationId);
    };
    window.addEventListener('sketchflow:history-action', requestHistoryAction);
    return () => window.removeEventListener('sketchflow:history-action', requestHistoryAction);
  }, [boardId]);

  useEffect(() => {
    hasLoaded.current = false;
    let cancelled = false;
    if (!boardId) {
      previousDocumentRef.current = null;
      dispatch(replaceDocument(parseLocalBoard(localStorage.getItem(localKey))));
      hasLoaded.current = true;
      return () => { cancelled = true; };
    }
    const prepareBoard = inviteToken ? acceptBoardShareToken(inviteToken) : Promise.resolve(undefined);
    prepareBoard.then(() => listBoardObjects(boardId))
      .then((document) => {
        if (!cancelled) {
          dispatch(replaceDocument(fromBoardDocument(document)));
          previousDocumentRef.current = document;
          hasLoaded.current = true;
        }
      })
      .catch((error) => {
        console.error('Unable to load board:', error);
        if (!cancelled) {
          dispatch(replaceDocument(parseLocalBoard(localStorage.getItem(localKey))));
          hasLoaded.current = true;
        }
      });
    return () => { cancelled = true; };
  }, [boardId, dispatch, inviteToken, localKey]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    const timeout = window.setTimeout(() => {
      const document = toBoardDocument({ shapes, notes });
      if (boardId && !applyingRemoteRef.current && socketRef.current?.connected) {
        const previous = previousDocumentRef.current ?? { objects: [] };
        const previousById = new Map(previous.objects.map((object) => [object.id, object]));
        const currentById = new Map(document.objects.map((object) => [object.id, object]));
        document.objects.forEach((object) => {
          const prior = previousById.get(object.id);
          const operationId = prior ? socketRef.current?.updateObject(object.id, object) : socketRef.current?.createObject(object);
          if (operationId) pendingOperationsRef.current.add(operationId);
        });
        previous.objects.filter((object) => !currentById.has(object.id)).forEach((object) => {
          const operationId = socketRef.current?.deleteObject(object.id);
          if (operationId) pendingOperationsRef.current.add(operationId);
        });
        previousDocumentRef.current = document;
      } else if (boardId) {
        syncBoardObjects(boardId, document).catch((error) => console.error('Unable to save board:', error));
      }
      else localStorage.setItem(localKey, JSON.stringify(document));
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [boardId, shapes, notes, localKey]);

  const moveCursor = (cursor: Omit<CollaborationCursor, 'userId' | 'boardId'>) => {
    if (user && boardId && socketRef.current?.connected) socketRef.current.moveCursor({ ...cursor, userId: user.id, boardId });
  };

  return { connectionStatus, moveCursor };
}
