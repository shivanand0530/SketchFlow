import { describe, expect, it } from 'vitest';
import reducer, { setHistoryAvailability, setPresence, setCursor } from '../src/store/collaborationSlice';

describe('collaboration state', () => {
  it('tracks server undo/redo availability', () => {
    const state = reducer(undefined, setHistoryAvailability({ canUndo: true, canRedo: false }));
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
  });

  it('keeps cursors for active remote users only', () => {
    let state = reducer(undefined, setPresence([{ userId: 'remote', displayName: 'Remote', color: '#000000', boardId: 'board' }]));
    state = reducer(state, setCursor({ userId: 'remote', boardId: 'board', x: 1, y: 2 }));
    expect(state.cursors.remote).toMatchObject({ x: 1, y: 2 });
    state = reducer(state, setPresence([]));
    expect(state.cursors.remote).toBeUndefined();
  });
});