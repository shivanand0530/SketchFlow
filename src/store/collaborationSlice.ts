import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CollaborationCursor, CollaborationPresence } from '@shared/collaboration';
import type { ConnectionStatus } from '@/services/websocketService';

interface CollaborationState {
  currentUser: CollaborationPresence | null;
  users: Record<string, CollaborationPresence>;
  cursors: Record<string, CollaborationCursor>;
  cursorLastSeen: Record<string, number>;
  connectionState: ConnectionStatus;
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: CollaborationState = {
  currentUser: null,
  users: {},
  cursors: {},
  cursorLastSeen: {},
  connectionState: 'disconnected',
  canUndo: false,
  canRedo: false,
};

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<CollaborationPresence | null>) => {
      state.currentUser = action.payload;
    },
    setConnectionState: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionState = action.payload;
      if (action.payload === 'disconnected') {
        state.users = {};
        state.cursors = {};
        state.cursorLastSeen = {};
      }
    },
    setHistoryAvailability: (state, action: PayloadAction<{ canUndo: boolean; canRedo: boolean }>) => {
      state.canUndo = action.payload.canUndo;
      state.canRedo = action.payload.canRedo;
    },
    setPresence: (state, action: PayloadAction<CollaborationPresence[]>) => {
      state.users = Object.fromEntries(action.payload.map((user) => [user.userId, user]));
      state.cursors = Object.fromEntries(Object.entries(state.cursors).filter(([userId]) => state.users[userId]));
      state.cursorLastSeen = Object.fromEntries(Object.entries(state.cursorLastSeen).filter(([userId]) => state.users[userId]));
    },
    addUser: (state, action: PayloadAction<CollaborationPresence>) => {
      state.users[action.payload.userId] = action.payload;
    },
    removeUser: (state, action: PayloadAction<string>) => {
      delete state.users[action.payload];
      delete state.cursors[action.payload];
      delete state.cursorLastSeen[action.payload];
    },
    setCursor: (state, action: PayloadAction<CollaborationCursor>) => {
      if (action.payload.userId !== state.currentUser?.userId && state.users[action.payload.userId]) {
        state.cursors[action.payload.userId] = action.payload;
        state.cursorLastSeen[action.payload.userId] = Date.now();
      }
    },
    pruneCursors: (state, action: PayloadAction<number>) => {
      Object.entries(state.cursorLastSeen).forEach(([userId, lastSeen]) => {
        if (action.payload - lastSeen > 10000) {
          delete state.cursors[userId];
          delete state.cursorLastSeen[userId];
        }
      });
    },
    clearCollaboration: () => initialState,
  },
});

export const { setCurrentUser, setConnectionState, setHistoryAvailability, setPresence, addUser, removeUser, setCursor, pruneCursors, clearCollaboration } = collaborationSlice.actions;
export default collaborationSlice.reducer;
