const STORAGE_KEY = 'sketchflow-app-state';

import type { CanvasState } from './canvasSlice';

type PersistedState = { canvas: CanvasState };
type SavedCanvas = Pick<CanvasState, 'shapes' | 'notes' | 'viewState' | 'currentTool' | 'currentColor'>;

export const loadState = (): PersistedState | undefined => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
      return undefined;
    }
    const state = JSON.parse(serializedState);
    if (!state?.canvas || !Array.isArray(state.canvas.shapes) || !Array.isArray(state.canvas.notes)) {
      return undefined;
    }
    state.canvas = {
      shapes: state.canvas.shapes,
      notes: state.canvas.notes,
      viewState: state.canvas.viewState ?? { panX: 0, panY: 0, zoom: 1 },
      currentTool: state.canvas.currentTool ?? 'select',
      currentColor: state.canvas.currentColor ?? '#000000',
      selectedShapeId: state.canvas.selectedShapeId ?? null,
      selectedIds: state.canvas.selectedIds ?? [],
      drawingState: state.canvas.drawingState ?? { isDrawing: false, points: [], tempShape: null },
      history: state.canvas.history ?? { past: [], future: [] },
    };
    
    // Ensure history exists in loaded state (migration for old data)
    if (state?.canvas && !state.canvas.history) {
      state.canvas.history = { past: [], future: [] };
    }
    if (!state.canvas.selectedIds) {
      state.canvas.selectedIds = state.canvas.selectedShapeId ? [state.canvas.selectedShapeId] : [];
    }
    
    return state;
  } catch (err) {
    console.error('Error loading state from localStorage:', err);
    return undefined;
  }
};

export const saveState = (state: { canvas: SavedCanvas }): void => {
  try {
    const { shapes, notes, viewState, currentTool, currentColor } = state.canvas;
    const serializedState = JSON.stringify({ canvas: { shapes, notes, viewState, currentTool, currentColor } });
    localStorage.setItem(STORAGE_KEY, serializedState);
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }
};

export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing state from localStorage:', err);
  }
};