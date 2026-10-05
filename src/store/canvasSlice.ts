import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToolType = 'select' | 'hand' | 'pen' | 'line' | 'arrow' | 'text' | 'sticky' | 'circle' | 'rectangle' | 'point' | 'polygon' | 'polyline' | 'note';

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  id: string;
  type: 'circle' | 'rectangle' | 'point' | 'polygon' | 'polyline' | 'pen' | 'line' | 'arrow';
  color: string;
  timestamp: number;
  properties: {
    x?: number;
    y?: number;
    radius?: number;
    width?: number;
    height?: number;
    points?: Point[];
    start?: Point;
    end?: Point;
    fill?: string;
    strokeWidth?: number;
    opacity?: number;
  };
  rotation?: number;
}

export interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  timestamp: number;
  width?: number;
  height?: number;
  textColor?: string;
}

export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface DrawingState {
  isDrawing: boolean;
  points: Point[];
  tempShape: Shape | null;
}

export interface CanvasSnapshot {
  shapes: Shape[];
  notes: Note[];
}

export interface CanvasState {
  shapes: Shape[];
  notes: Note[];
  viewState: ViewState;
  currentTool: ToolType;
  currentColor: string;
  selectedShapeId: string | null;
  selectedIds: string[];
  drawingState: DrawingState;
  history: {
    past: Array<{ shapes: Shape[]; notes: Note[] }>;
    future: Array<{ shapes: Shape[]; notes: Note[] }>;
  };
}

const initialState: CanvasState = {
  shapes: [],
  notes: [],
  viewState: { panX: 0, panY: 0, zoom: 1 },
  currentTool: 'select',
  currentColor: '#000000',
  selectedShapeId: null,
  selectedIds: [],
  drawingState: { isDrawing: false, points: [], tempShape: null },
  history: { past: [], future: [] },
};

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    addShape: (state, action: PayloadAction<Shape>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      state.shapes.push(action.payload);
    },
    updateShape: (state, action: PayloadAction<{ id: string; updates: Partial<Shape> }>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      const shapeIndex = state.shapes.findIndex(s => s.id === action.payload.id);
      if (shapeIndex !== -1) {
        state.shapes[shapeIndex] = { ...state.shapes[shapeIndex], ...action.payload.updates };
      }
    },
    updateShapePosition: (state, action: PayloadAction<{ id: string; updates: Partial<Shape> }>) => {
      // Update shape position without recording to history (for drag operations)
      const shapeIndex = state.shapes.findIndex(s => s.id === action.payload.id);
      if (shapeIndex !== -1) {
        state.shapes[shapeIndex] = { ...state.shapes[shapeIndex], ...action.payload.updates };
      }
    },
    updateNotePositionTransient: (state, action: PayloadAction<{ id: string; updates: Partial<Note> }>) => {
      const note = state.notes.find((item) => item.id === action.payload.id);
      if (note) Object.assign(note, action.payload.updates);
    },
    commitDrag: (state, action: PayloadAction<CanvasSnapshot>) => {
      state.history.past.push(action.payload);
      state.history.future = [];
    },
    replaceDocument: (state, action: PayloadAction<CanvasSnapshot>) => {
      state.shapes = action.payload.shapes;
      state.notes = action.payload.notes;
      state.history = { past: [], future: [] };
      state.selectedShapeId = null;
      state.selectedIds = [];
    },
    deleteShape: (state, action: PayloadAction<string>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      const shapeIndex = state.shapes.findIndex(s => s.id === action.payload);
      if (shapeIndex !== -1) {
        state.shapes.splice(shapeIndex, 1);
      }
      if (state.selectedShapeId === action.payload) {
        state.selectedShapeId = null;
      }
      state.selectedIds = state.selectedIds.filter((id) => id !== action.payload);
    },
    addNote: (state, action: PayloadAction<Note>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      state.notes.push(action.payload);
    },
    updateNote: (state, action: PayloadAction<{ id: string; text: string; x?: number; y?: number }>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      const noteIndex = state.notes.findIndex(n => n.id === action.payload.id);
      if (noteIndex !== -1) {
        state.notes[noteIndex].text = action.payload.text;
        if (action.payload.x !== undefined) {
          state.notes[noteIndex].x = action.payload.x;
        }
        if (action.payload.y !== undefined) {
          state.notes[noteIndex].y = action.payload.y;
        }
      }
    },
    updateNotePosition: (state, action: PayloadAction<{ id: string; x: number; y: number }>) => {
      const note = state.notes.find((item) => item.id === action.payload.id);
      if (note) {
        note.x = action.payload.x;
        note.y = action.payload.y;
      }
    },
    updateNoteStyle: (state, action: PayloadAction<{ id: string; updates: Partial<Note> }>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) });
      state.history.future = [];
      const note = state.notes.find((item) => item.id === action.payload.id);
      if (note) Object.assign(note, action.payload.updates);
    },
    deleteNote: (state, action: PayloadAction<string>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      const noteIndex = state.notes.findIndex(n => n.id === action.payload);
      if (noteIndex !== -1) {
        state.notes.splice(noteIndex, 1);
      }
      state.selectedIds = state.selectedIds.filter((id) => id !== action.payload);
    },
    setTool: (state, action: PayloadAction<ToolType>) => {
      // If we're currently drawing a polygon or polyline with points, save it before switching tools
      if (state.drawingState.isDrawing && 
          (state.currentTool === 'polygon' || state.currentTool === 'polyline') && 
          state.drawingState.points.length >= 2) {
        // Save the current polygon/polyline as a completed shape
        state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) });
        state.history.future = [];
        const newShape: Shape = {
          id: Date.now().toString(),
          type: state.currentTool,
          color: state.currentColor,
          timestamp: Date.now(),
          properties: { points: state.drawingState.points },
        };
        state.shapes.push(newShape);
      }
      
      state.currentTool = action.payload;
      state.selectedShapeId = null;
      state.selectedIds = [];
      // Clear drawing state when switching tools
      state.drawingState = { isDrawing: false, points: [], tempShape: null };
    },
    setColor: (state, action: PayloadAction<string>) => {
      state.currentColor = action.payload;
    },
    setSelectedShape: (state, action: PayloadAction<string | null>) => {
      state.selectedShapeId = action.payload;
      state.selectedIds = action.payload ? [action.payload] : [];
    },
    setSelectedIds: (state, action: PayloadAction<string[]>) => {
      state.selectedIds = action.payload;
      state.selectedShapeId = action.payload[0] ?? null;
    },
    bringForward: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      for (let index = state.shapes.length - 2; index >= 0; index -= 1) {
        if (ids.has(state.shapes[index].id) && !ids.has(state.shapes[index + 1].id)) {
          [state.shapes[index], state.shapes[index + 1]] = [state.shapes[index + 1], state.shapes[index]];
        }
      }
    },
    sendBackward: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      for (let index = 1; index < state.shapes.length; index += 1) {
        if (ids.has(state.shapes[index].id) && !ids.has(state.shapes[index - 1].id)) {
          [state.shapes[index], state.shapes[index - 1]] = [state.shapes[index - 1], state.shapes[index]];
        }
      }
    },
    bringToFront: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      const selected = state.shapes.filter((shape) => ids.has(shape.id));
      state.shapes = state.shapes.filter((shape) => !ids.has(shape.id));
      state.shapes.push(...selected);
    },
    sendToBack: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      const selected = state.shapes.filter((shape) => ids.has(shape.id));
      state.shapes = state.shapes.filter((shape) => !ids.has(shape.id));
      state.shapes.unshift(...selected);
    },
    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.viewState.panX = action.payload.x;
      state.viewState.panY = action.payload.y;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.viewState.zoom = Math.max(0.1, Math.min(5, action.payload));
    },
    startDrawing: (state, action: PayloadAction<Point>) => {
      state.drawingState.isDrawing = true;
      state.drawingState.points = [action.payload];
      state.drawingState.tempShape = null;
    },
    addDrawingPoint: (state, action: PayloadAction<Point>) => {
      state.drawingState.points.push(action.payload);
    },
    updateTempShape: (state, action: PayloadAction<Shape | null>) => {
      state.drawingState.tempShape = action.payload;
    },
    finishDrawing: (state) => {
      state.drawingState.isDrawing = false;
      state.drawingState.points = [];
      state.drawingState.tempShape = null;
    },
    clearCanvas: (state) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      state.shapes = [];
      state.notes = [];
      state.selectedShapeId = null;
      state.selectedIds = [];
    },
    undo: (state) => {
      if (state.history.past.length > 0) {
        const previousState = state.history.past.pop()!;
        state.history.future.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
        state.shapes = previousState.shapes;
        state.notes = previousState.notes;
        state.selectedShapeId = null;
        state.selectedIds = [];
      }
    },
    redo: (state) => {
      if (state.history.future.length > 0) {
        const nextState = state.history.future.pop()!;
        state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
        state.shapes = nextState.shapes;
        state.notes = nextState.notes;
        state.selectedShapeId = null;
        state.selectedIds = [];
      }
    },
  },
});

export const {
  addShape,
  updateShape,
  updateShapePosition,
  updateNotePositionTransient,
  commitDrag,
  replaceDocument,
  deleteShape,
  addNote,
  updateNote,
  updateNotePosition,
  updateNoteStyle,
  deleteNote,
  setTool,
  setColor,
  setSelectedShape,
  setSelectedIds,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  setPan,
  setZoom,
  startDrawing,
  addDrawingPoint,
  updateTempShape,
  finishDrawing,
  clearCanvas,
  undo,
  redo,
} = canvasSlice.actions;

export default canvasSlice.reducer;