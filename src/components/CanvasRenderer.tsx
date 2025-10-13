import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addShape,
  addNote,
  setSelectedShape,
  setPan,
  setZoom,
  startDrawing,
  addDrawingPoint,
  updateTempShape,
  finishDrawing,
  updateShape,
  updateShapePosition,
  updateNote,
  deleteShape,
  deleteNote,
  Shape,
  Point,
  Note,
  undo,
  redo,
} from '@/store/canvasSlice';
import { useEffect, useRef, useState } from 'react';
import { NoteDialog } from './NoteDialog';

export function CanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dispatch = useAppDispatch();
  
  const shapes = useAppSelector((state) => state.canvas.shapes);
  const notes = useAppSelector((state) => state.canvas.notes);
  const currentTool = useAppSelector((state) => state.canvas.currentTool);
  const currentColor = useAppSelector((state) => state.canvas.currentColor);
  const selectedShapeId = useAppSelector((state) => state.canvas.selectedShapeId);
  const viewState = useAppSelector((state) => state.canvas.viewState);
  const drawingState = useAppSelector((state) => state.canvas.drawingState);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [notePosition, setNotePosition] = useState<Point>({ x: 0, y: 0 });

  // Transform screen coordinates to canvas coordinates
  const screenToCanvas = (screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - viewState.panX) / viewState.zoom,
      y: (screenY - rect.top - viewState.panY) / viewState.zoom,
    };
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(viewState.panX, viewState.panY);
    ctx.scale(viewState.zoom, viewState.zoom);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1 / viewState.zoom;
    const gridSize = 50;
    const startX = Math.floor(-viewState.panX / viewState.zoom / gridSize) * gridSize;
    const startY = Math.floor(-viewState.panY / viewState.zoom / gridSize) * gridSize;
    const endX = startX + canvas.width / viewState.zoom + gridSize;
    const endY = startY + canvas.height / viewState.zoom + gridSize;

    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // Draw shapes
    shapes.forEach((shape: Shape) => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 2 / viewState.zoom;

      if (shape.type === 'circle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.radius !== undefined) {
        ctx.beginPath();
        ctx.arc(shape.properties.x, shape.properties.y, shape.properties.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.width !== undefined && shape.properties.height !== undefined) {
        ctx.strokeRect(shape.properties.x, shape.properties.y, shape.properties.width, shape.properties.height);
      } else if (shape.type === 'point' && shape.properties.x !== undefined && shape.properties.y !== undefined) {
        ctx.beginPath();
        ctx.arc(shape.properties.x, shape.properties.y, 3 / viewState.zoom, 0, Math.PI * 2);
        ctx.fill();
      } else if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.properties.points && shape.properties.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(shape.properties.points[0].x, shape.properties.points[0].y);
        for (let i = 1; i < shape.properties.points.length; i++) {
          ctx.lineTo(shape.properties.points[i].x, shape.properties.points[i].y);
        }
        if (shape.type === 'polygon') {
          ctx.closePath();
        }
        ctx.stroke();
      }

      // Draw selection highlight
      if (shape.id === selectedShapeId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3 / viewState.zoom;
        ctx.setLineDash([5 / viewState.zoom, 5 / viewState.zoom]);
        
        if (shape.type === 'circle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.radius !== undefined) {
          ctx.beginPath();
          ctx.arc(shape.properties.x, shape.properties.y, shape.properties.radius + 5 / viewState.zoom, 0, Math.PI * 2);
          ctx.stroke();
        } else if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.width !== undefined && shape.properties.height !== undefined) {
          ctx.strokeRect(
            shape.properties.x - 5 / viewState.zoom,
            shape.properties.y - 5 / viewState.zoom,
            shape.properties.width + 10 / viewState.zoom,
            shape.properties.height + 10 / viewState.zoom
          );
        }
        
        ctx.setLineDash([]);
      }
    });

    // Draw temp shape
    if (drawingState.tempShape) {
      const shape = drawingState.tempShape;
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 2 / viewState.zoom;
      ctx.globalAlpha = 0.5;

      if (shape.type === 'circle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.radius !== undefined) {
        ctx.beginPath();
        ctx.arc(shape.properties.x, shape.properties.y, shape.properties.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.width !== undefined && shape.properties.height !== undefined) {
        ctx.strokeRect(shape.properties.x, shape.properties.y, shape.properties.width, shape.properties.height);
      }

      ctx.globalAlpha = 1;
    }

    // Draw polygon/polyline in progress
    if ((currentTool === 'polygon' || currentTool === 'polyline') && drawingState.points.length > 0) {
      ctx.strokeStyle = currentColor;
      ctx.fillStyle = currentColor;
      ctx.lineWidth = 2 / viewState.zoom;

      ctx.beginPath();
      ctx.moveTo(drawingState.points[0].x, drawingState.points[0].y);
      for (let i = 1; i < drawingState.points.length; i++) {
        ctx.lineTo(drawingState.points[i].x, drawingState.points[i].y);
      }
      ctx.stroke();

      // Draw points
      drawingState.points.forEach((point: Point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 / viewState.zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw notes
    notes.forEach((note: Note) => {
      ctx.fillStyle = note.color;
      ctx.font = `${14 / viewState.zoom}px sans-serif`;
      ctx.fillText(note.text, note.x, note.y);
      
      // Draw selection highlight for notes
      if (note.id === selectedShapeId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / viewState.zoom;
        ctx.setLineDash([5 / viewState.zoom, 5 / viewState.zoom]);
        
        const metrics = ctx.measureText(note.text);
        const textWidth = metrics.width;
        const textHeight = 14 / viewState.zoom;
        
        ctx.strokeRect(
          note.x - 2 / viewState.zoom,
          note.y - textHeight - 2 / viewState.zoom,
          textWidth + 4 / viewState.zoom,
          textHeight + 4 / viewState.zoom
        );
        
        ctx.setLineDash([]);
      }
    });

    ctx.restore();
  }, [shapes, notes, viewState, drawingState, selectedShapeId, currentTool, currentColor]);

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = screenToCanvas(e.clientX, e.clientY);

    // Pan with middle mouse or Ctrl + left mouse
    if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewState.panX, y: e.clientY - viewState.panY });
      return;
    }

    if (currentTool === 'select') {
      // Check if clicking on a shape
      let foundShape = false;
      let foundShapeObj: Shape | null = null;
      let foundNote: Note | null = null;
      
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (isPointInShape(point, shape)) {
          foundShapeObj = shape;
          foundShape = true;
          break;
        }
      }
      
      // Check if clicking on a note
      if (!foundShape) {
        for (let i = notes.length - 1; i >= 0; i--) {
          const note = notes[i];
          if (isPointInNote(point, note)) {
            foundNote = note;
            foundShape = true;
            break;
          }
        }
      }
      
      if (foundShape) {
        const id = foundShapeObj?.id || foundNote?.id;
        if (id) {
          dispatch(setSelectedShape(id));
          setIsDragging(true);
          setDragStart(point);
          // Record state before dragging starts
          if (foundShapeObj) {
            dispatch(updateShape({ id, updates: {} }));
          } else if (foundNote) {
            dispatch(updateNote({ id, text: foundNote.text }));
          }
        }
      } else {
        dispatch(setSelectedShape(null));
      }
      return; // Important: return early to prevent any other actions
    } else if (currentTool === 'circle' || currentTool === 'rectangle') {
      dispatch(startDrawing(point));
    } else if (currentTool === 'point') {
      const newShape: Shape = {
        id: Date.now().toString(),
        type: 'point',
        color: currentColor,
        timestamp: Date.now(),
        properties: { x: point.x, y: point.y },
      };
      dispatch(addShape(newShape));
    } else if (currentTool === 'polygon' || currentTool === 'polyline') {
      if (!drawingState.isDrawing) {
        dispatch(startDrawing(point));
      } else {
        dispatch(addDrawingPoint(point));
      }
    } else if (currentTool === 'note') {
      setNotePosition(point);
      setNoteDialogOpen(true);
    }
  };

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = screenToCanvas(e.clientX, e.clientY);

    if (isPanning) {
      dispatch(setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    if (isDragging && selectedShapeId) {
      const shape = shapes.find((s: Shape) => s.id === selectedShapeId);
      const note = notes.find((n: Note) => n.id === selectedShapeId);
      
      if (shape) {
        const dx = point.x - dragStart.x;
        const dy = point.y - dragStart.y;
        
        // Update shape position without recording to history (use a direct state update)
        if (shape.type === 'circle' && shape.properties.x !== undefined && shape.properties.y !== undefined) {
          dispatch(updateShapePosition({
            id: selectedShapeId,
            updates: {
              properties: {
                ...shape.properties,
                x: shape.properties.x + dx,
                y: shape.properties.y + dy,
              },
            },
          }));
        } else if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined) {
          dispatch(updateShapePosition({
            id: selectedShapeId,
            updates: {
              properties: {
                ...shape.properties,
                x: shape.properties.x + dx,
                y: shape.properties.y + dy,
              },
            },
          }));
        } else if (shape.type === 'point' && shape.properties.x !== undefined && shape.properties.y !== undefined) {
          dispatch(updateShapePosition({
            id: selectedShapeId,
            updates: {
              properties: {
                x: shape.properties.x + dx,
                y: shape.properties.y + dy,
              },
            },
          }));
        } else if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.properties.points) {
          const updatedPoints = shape.properties.points.map((p: Point) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          dispatch(updateShapePosition({
            id: selectedShapeId,
            updates: {
              properties: {
                points: updatedPoints,
              },
            },
          }));
        }
        
        setDragStart(point);
      } else if (note) {
        const dx = point.x - dragStart.x;
        const dy = point.y - dragStart.y;
        
        dispatch(updateNote({
          id: selectedShapeId,
          text: note.text,
          x: note.x + dx,
          y: note.y + dy,
        }));
        
        setDragStart(point);
      }
    }

    if (drawingState.isDrawing && drawingState.points.length > 0) {
      const startPoint = drawingState.points[0];
      
      if (currentTool === 'circle') {
        const radius = Math.sqrt(
          Math.pow(point.x - startPoint.x, 2) + Math.pow(point.y - startPoint.y, 2)
        );
        dispatch(updateTempShape({
          id: 'temp',
          type: 'circle',
          color: currentColor,
          timestamp: Date.now(),
          properties: { x: startPoint.x, y: startPoint.y, radius },
        }));
      } else if (currentTool === 'rectangle') {
        dispatch(updateTempShape({
          id: 'temp',
          type: 'rectangle',
          color: currentColor,
          timestamp: Date.now(),
          properties: {
            x: Math.min(startPoint.x, point.x),
            y: Math.min(startPoint.y, point.y),
            width: Math.abs(point.x - startPoint.x),
            height: Math.abs(point.y - startPoint.y),
          },
        }));
      }
    }
  };

  // Mouse up handler
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (isDragging && selectedShapeId) {
      setIsDragging(false);
      // Dragging is complete - no need to record again as we recorded at drag start
    }

    if (drawingState.isDrawing && (currentTool === 'circle' || currentTool === 'rectangle')) {
      if (drawingState.tempShape) {
        dispatch(addShape({ ...drawingState.tempShape, id: Date.now().toString() }));
      }
      dispatch(finishDrawing());
    }
  };

  // Wheel handler for zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    dispatch(setZoom(viewState.zoom * delta));
  };

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedShapeId) {
        dispatch(deleteShape(selectedShapeId));
      } else if (e.key === 'Escape') {
        if (drawingState.isDrawing) {
          dispatch(finishDrawing());
        }
        dispatch(setSelectedShape(null));
      } else if (e.key === 'Enter' && drawingState.isDrawing && (currentTool === 'polygon' || currentTool === 'polyline')) {
        if (drawingState.points.length >= 2) {
          const newShape: Shape = {
            id: Date.now().toString(),
            type: currentTool,
            color: currentColor,
            timestamp: Date.now(),
            properties: { points: drawingState.points },
          };
          dispatch(addShape(newShape));
        }
        dispatch(finishDrawing());
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch(redo());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, drawingState, currentTool, currentColor, dispatch]);

  // Helper function to check if point is in note
  const isPointInNote = (point: Point, note: Note): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    
    ctx.font = `${14 / viewState.zoom}px sans-serif`;
    const metrics = ctx.measureText(note.text);
    const textWidth = metrics.width;
    const textHeight = 14 / viewState.zoom;
    
    return (
      point.x >= note.x &&
      point.x <= note.x + textWidth &&
      point.y >= note.y - textHeight &&
      point.y <= note.y
    );
  };

  // Helper function to check if point is in shape
  const isPointInShape = (point: Point, shape: Shape): boolean => {
    if (shape.type === 'circle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.radius !== undefined) {
      const dist = Math.sqrt(
        Math.pow(point.x - shape.properties.x, 2) + Math.pow(point.y - shape.properties.y, 2)
      );
      return dist <= shape.properties.radius;
    } else if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.width !== undefined && shape.properties.height !== undefined) {
      return (
        point.x >= shape.properties.x &&
        point.x <= shape.properties.x + shape.properties.width &&
        point.y >= shape.properties.y &&
        point.y <= shape.properties.y + shape.properties.height
      );
    } else if (shape.type === 'point' && shape.properties.x !== undefined && shape.properties.y !== undefined) {
      const dist = Math.sqrt(
        Math.pow(point.x - shape.properties.x, 2) + Math.pow(point.y - shape.properties.y, 2)
      );
      return dist <= 5;
    } else if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.properties.points && shape.properties.points.length > 0) {
      // Check if point is near any line segment
      for (let i = 0; i < shape.properties.points.length - 1; i++) {
        const p1 = shape.properties.points[i];
        const p2 = shape.properties.points[i + 1];
        const dist = distanceToLineSegment(point, p1, p2);
        if (dist <= 5 / viewState.zoom) {
          return true;
        }
      }
      // For polygons, also check the closing segment
      if (shape.type === 'polygon' && shape.properties.points.length > 2) {
        const p1 = shape.properties.points[shape.properties.points.length - 1];
        const p2 = shape.properties.points[0];
        const dist = distanceToLineSegment(point, p1, p2);
        if (dist <= 5 / viewState.zoom) {
          return true;
        }
      }
    }
    return false;
  };

  // Helper function to calculate distance from point to line segment
  const distanceToLineSegment = (point: Point, p1: Point, p2: Point): number => {
    const A = point.x - p1.x;
    const B = point.y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = p1.x;
      yy = p1.y;
    } else if (param > 1) {
      xx = p2.x;
      yy = p2.y;
    } else {
      xx = p1.x + param * C;
      yy = p1.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleAddNote = (text: string) => {
    dispatch(addNote({
      id: Date.now().toString(),
      text,
      x: notePosition.x,
      y: notePosition.y,
      color: currentColor,
      timestamp: Date.now(),
    }));
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-white cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
      <NoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        onSubmit={handleAddNote}
      />
    </>
  );
}