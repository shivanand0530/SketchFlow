import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToolType = 'select' | 'circle' | 'rectangle' | 'point' | 'polygon' | 'polyline' | 'note';

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  id: string;
  type: 'circle' | 'rectangle' | 'point' | 'polygon' | 'polyline';
  color: string;
  timestamp: number;
  properties: {
    x?: number;
    y?: number;
    radius?: number;
    width?: number;
    height?: number;
    points?: Point[];
  };
}

export interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  timestamp: number;
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

interface CanvasState {
  shapes: Shape[];
  notes: Note[];
  viewState: ViewState;
  currentTool: ToolType;
  currentColor: string;
  selectedShapeId: string | null;
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
    deleteNote: (state, action: PayloadAction<string>) => {
      state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
      state.history.future = [];
      const noteIndex = state.notes.findIndex(n => n.id === action.payload);
      if (noteIndex !== -1) {
        state.notes.splice(noteIndex, 1);
      }
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
      // Clear drawing state when switching tools
      state.drawingState = { isDrawing: false, points: [], tempShape: null };
    },
    setColor: (state, action: PayloadAction<string>) => {
      state.currentColor = action.payload;
    },
    setSelectedShape: (state, action: PayloadAction<string | null>) => {
      state.selectedShapeId = action.payload;
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
    },
    undo: (state) => {
      if (state.history.past.length > 0) {
        const previousState = state.history.past.pop()!;
        state.history.future.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
        state.shapes = previousState.shapes;
        state.notes = previousState.notes;
        state.selectedShapeId = null;
      }
    },
    redo: (state) => {
      if (state.history.future.length > 0) {
        const nextState = state.history.future.pop()!;
        state.history.past.push({ shapes: JSON.parse(JSON.stringify(state.shapes)), notes: JSON.parse(JSON.stringify(state.notes)) }); // Deep copy
        state.shapes = nextState.shapes;
        state.notes = nextState.notes;
        state.selectedShapeId = null;
      }
    },
  },
});

export const {
  addShape,
  updateShape,
  updateShapePosition,
  deleteShape,
  addNote,
  updateNote,
  deleteNote,
  setTool,
  setColor,
  setSelectedShape,
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