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
  updateShapePosition,
  updateNote,
  commitDrag,
  deleteShape,
  deleteNote,
  Shape,
  Point,
  Note,
  setTool,
  ToolType,
  setSelectedIds,
  updateNotePositionTransient,
} from '@/store/canvasSlice';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { NoteDialog } from './NoteDialog';
import { MousePointer2 } from 'lucide-react';

interface CanvasRendererProps {
  onCursorMove?: (point: Point) => void;
}

export function CanvasRenderer({ onCursorMove }: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dispatch = useAppDispatch();
  
  const shapes = useAppSelector((state) => state.canvas.shapes);
  const notes = useAppSelector((state) => state.canvas.notes);
  const currentTool = useAppSelector((state) => state.canvas.currentTool);
  const currentColor = useAppSelector((state) => state.canvas.currentColor);
  const selectedShapeId = useAppSelector((state) => state.canvas.selectedShapeId);
  const selectedIds = useAppSelector((state) => state.canvas.selectedIds);
  const viewState = useAppSelector((state) => state.canvas.viewState);
  const drawingState = useAppSelector((state) => state.canvas.drawingState);
  const remoteCursors = useAppSelector((state) => Object.values(state.collaboration.cursors));
  const collaborationUsers = useAppSelector((state) => state.collaboration.users);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<Point>({ x: 0, y: 0 });
  const resizeOriginRef = useRef<{ width?: number; height?: number; radius?: number }>({});
  const dragSnapshotRef = useRef<{ shapes: Shape[]; notes: Note[] } | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [notePosition, setNotePosition] = useState<Point>({ x: 0, y: 0 });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStart, setRotationStart] = useState(0);
  const [canvasSizeVersion, setCanvasSizeVersion] = useState(0);
  const cursorPointRef = useRef<Point | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const lastCursorSentRef = useRef<Point | null>(null);

  useEffect(() => () => {
    if (cursorTimerRef.current !== null) window.clearTimeout(cursorTimerRef.current);
  }, []);

  const broadcastCursor = (point: Point) => {
    if (!onCursorMove) return;
    cursorPointRef.current = point;
    if (cursorTimerRef.current !== null) return;
    if (lastCursorSentRef.current?.x !== point.x || lastCursorSentRef.current?.y !== point.y) {
      onCursorMove(point);
      lastCursorSentRef.current = point;
    }
    cursorTimerRef.current = window.setTimeout(() => {
      cursorTimerRef.current = null;
      const latest = cursorPointRef.current;
      if (latest && (lastCursorSentRef.current?.x !== latest.x || lastCursorSentRef.current?.y !== latest.y)) {
        onCursorMove(latest);
        lastCursorSentRef.current = latest;
      }
    }, 50);
  };

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

      ctx.save();
      ctx.globalAlpha = shape.properties.opacity ?? 1;
      ctx.lineWidth = (shape.properties.strokeWidth ?? 2) / viewState.zoom;
      if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.width !== undefined && shape.properties.height !== undefined && shape.rotation) {
        ctx.translate(shape.properties.x + shape.properties.width / 2, shape.properties.y + shape.properties.height / 2);
        ctx.rotate(shape.rotation);
        ctx.translate(-(shape.properties.x + shape.properties.width / 2), -(shape.properties.y + shape.properties.height / 2));
      }
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
      } else if ((shape.type === 'polygon' || shape.type === 'polyline' || shape.type === 'pen') && shape.properties.points && shape.properties.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(shape.properties.points[0].x, shape.properties.points[0].y);
        for (let i = 1; i < shape.properties.points.length; i++) {
          ctx.lineTo(shape.properties.points[i].x, shape.properties.points[i].y);
        }
        if (shape.type === 'polygon') {
          ctx.closePath();
        }
        ctx.stroke();
      } else if ((shape.type === 'line' || shape.type === 'arrow') && shape.properties.start && shape.properties.end) {
        const { start, end } = shape.properties;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        if (shape.type === 'arrow') {
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const size = 10 / viewState.zoom;
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      // Draw selection highlight
      if (selectedIds.includes(shape.id)) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3 / viewState.zoom;
        ctx.setLineDash([5 / viewState.zoom, 5 / viewState.zoom]);
        
        if (shape.type === 'circle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.radius !== undefined) {
          ctx.beginPath();
          ctx.arc(shape.properties.x, shape.properties.y, shape.properties.radius + 5 / viewState.zoom, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(
            shape.properties.x + shape.properties.radius - 4 / viewState.zoom,
            shape.properties.y - 4 / viewState.zoom,
            8 / viewState.zoom,
            8 / viewState.zoom
          );
        } else if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.width !== undefined && shape.properties.height !== undefined) {
          ctx.strokeRect(
            shape.properties.x - 5 / viewState.zoom,
            shape.properties.y - 5 / viewState.zoom,
            shape.properties.width + 10 / viewState.zoom,
            shape.properties.height + 10 / viewState.zoom
          );
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(
            shape.properties.x + shape.properties.width - 4 / viewState.zoom,
            shape.properties.y + shape.properties.height - 4 / viewState.zoom,
            8 / viewState.zoom,
            8 / viewState.zoom
          );
          ctx.beginPath();
          ctx.moveTo(shape.properties.x + shape.properties.width / 2, shape.properties.y - 22 / viewState.zoom);
          ctx.lineTo(shape.properties.x + shape.properties.width / 2, shape.properties.y - 5 / viewState.zoom);
          ctx.stroke();
          ctx.fillRect(shape.properties.x + shape.properties.width / 2 - 4 / viewState.zoom, shape.properties.y - 26 / viewState.zoom, 8 / viewState.zoom, 8 / viewState.zoom);
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
      else if ((shape.type === 'pen' || shape.type === 'line' || shape.type === 'arrow') && shape.properties.points) {
        ctx.beginPath();
        ctx.moveTo(shape.properties.points[0].x, shape.properties.points[0].y);
        shape.properties.points.slice(1).forEach((p: Point) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
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
      const noteWidth = note.width ?? Math.max(140, note.text.length * 8);
      const noteHeight = note.height ?? 64;
      ctx.fillStyle = `${note.color}33`;
      ctx.fillRect(note.x, note.y, noteWidth, noteHeight);
      ctx.strokeStyle = note.color;
      ctx.strokeRect(note.x, note.y, noteWidth, noteHeight);
      ctx.fillStyle = note.textColor ?? '#1f2937';
      ctx.font = `${14 / viewState.zoom}px sans-serif`;
      note.text.split('\n').forEach((line, index) => ctx.fillText(line, note.x + 10 / viewState.zoom, note.y + (20 + index * 18) / viewState.zoom));
      
      // Draw selection highlight for notes
      if (selectedIds.includes(note.id)) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / viewState.zoom;
        ctx.setLineDash([5 / viewState.zoom, 5 / viewState.zoom]);
        
        ctx.strokeRect(
          note.x - 4 / viewState.zoom,
          note.y - 4 / viewState.zoom,
          noteWidth + 8 / viewState.zoom,
          noteHeight + 8 / viewState.zoom
        );
        
        ctx.setLineDash([]);
      }
    });

    ctx.restore();
  }, [shapes, notes, viewState, drawingState, selectedIds, currentTool, currentColor, canvasSizeVersion]);

  useEffect(() => {
    const exportPng = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'sketchflow-board.png';
      link.click();
    };
    window.addEventListener('sketchflow:export-png', exportPng);
    return () => window.removeEventListener('sketchflow:export-png', exportPng);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setCanvasSizeVersion((version) => version + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Mouse down handler
  const handleMouseDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = screenToCanvas(e.clientX, e.clientY);

    // Pan with middle mouse or Ctrl + left mouse
    if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey)) || currentTool === 'hand') {
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
          const nextIds = e.shiftKey ? (selectedIds.includes(id) ? selectedIds.filter((item: string) => item !== id) : [...selectedIds, id]) : [id];
          dispatch(setSelectedIds(nextIds));
          dragSnapshotRef.current = {
            shapes: structuredClone(shapes),
            notes: structuredClone(notes),
          };
          if (foundShapeObj && isPointOnRotateHandle(point, foundShapeObj)) {
            setIsRotating(true);
            setRotationStart(Math.atan2(point.y - getShapeCenter(foundShapeObj).y, point.x - getShapeCenter(foundShapeObj).x) - (foundShapeObj.rotation ?? 0));
          } else if (foundShapeObj && isPointOnResizeHandle(point, foundShapeObj)) {
            setIsResizing(true);
            resizeStartRef.current = point;
            resizeOriginRef.current = {
              width: foundShapeObj.properties.width,
              height: foundShapeObj.properties.height,
              radius: foundShapeObj.properties.radius,
            };
          } else if (foundNote && isPointOnNoteResizeHandle(point, foundNote)) {
            setIsResizing(true);
            resizeStartRef.current = point;
            resizeOriginRef.current = { width: foundNote.width ?? 180, height: foundNote.height ?? 90 };
          } else {
            setIsDragging(true);
            setDragStart(point);
          }
        }
      } else {
        dispatch(setSelectedShape(null));
      }
      return; // Important: return early to prevent any other actions
    } else if (currentTool === 'circle' || currentTool === 'rectangle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'pen') {
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
    } else if (currentTool === 'note' || currentTool === 'sticky' || currentTool === 'text') {
      setNotePosition(point);
      setNoteDialogOpen(true);
    }
  };

  // Mouse move handler
  const handleMouseMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const point = screenToCanvas(e.clientX, e.clientY);
    broadcastCursor(point);

    if (isPanning) {
      dispatch(setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    if (isRotating && selectedShapeId) {
      const shape = shapes.find((item: Shape) => item.id === selectedShapeId);
      if (shape) dispatch(updateShapePosition({ id: shape.id, updates: { rotation: Math.atan2(point.y - getShapeCenter(shape).y, point.x - getShapeCenter(shape).x) - rotationStart } }));
      return;
    }

    if (isResizing && selectedShapeId) {
      const shape = shapes.find((item: Shape) => item.id === selectedShapeId);
      const note = notes.find((item: Note) => item.id === selectedShapeId);
      if (note && resizeOriginRef.current.width !== undefined && resizeOriginRef.current.height !== undefined) {
        dispatch(updateNotePositionTransient({ id: selectedShapeId, updates: { width: Math.max(80, resizeOriginRef.current.width + point.x - resizeStartRef.current.x), height: Math.max(48, resizeOriginRef.current.height + point.y - resizeStartRef.current.y) } }));
      } else if (shape?.type === 'rectangle' && resizeOriginRef.current.width !== undefined && resizeOriginRef.current.height !== undefined) {
        dispatch(updateShapePosition({
          id: selectedShapeId,
          updates: {
            properties: {
              ...shape.properties,
              width: Math.max(1, resizeOriginRef.current.width + point.x - resizeStartRef.current.x),
              height: Math.max(1, resizeOriginRef.current.height + point.y - resizeStartRef.current.y),
            },
          },
        }));
      } else if (shape?.type === 'circle' && resizeOriginRef.current.radius !== undefined) {
        dispatch(updateShapePosition({
          id: selectedShapeId,
          updates: {
            properties: {
              ...shape.properties,
              radius: Math.max(1, resizeOriginRef.current.radius + point.x - resizeStartRef.current.x),
            },
          },
        }));
      }
      return;
    }

    if (isDragging && selectedShapeId) {
      const selectedShape = shapes.find((s: Shape) => s.id === selectedShapeId);
      const selectedNote = notes.find((n: Note) => n.id === selectedShapeId);

      if (selectedShape || selectedNote) {
        const dx = point.x - dragStart.x;
        const dy = point.y - dragStart.y;

        selectedIds.forEach((selectedId: string) => {
          const shape = shapes.find((item: Shape) => item.id === selectedId);
          const note = notes.find((item: Note) => item.id === selectedId);
          if (note) {
            dispatch(updateNotePositionTransient({ id: selectedId, updates: { x: note.x + dx, y: note.y + dy } }));
            return;
          }
          if (!shape) return;
          if (shape.type === 'circle' || shape.type === 'rectangle' || shape.type === 'point') {
            if (shape.properties.x !== undefined && shape.properties.y !== undefined) {
              dispatch(updateShapePosition({ id: selectedId, updates: { properties: { ...shape.properties, x: shape.properties.x + dx, y: shape.properties.y + dy } } }));
            }
          } else if ((shape.type === 'polygon' || shape.type === 'polyline' || shape.type === 'pen') && shape.properties.points) {
            dispatch(updateShapePosition({ id: selectedId, updates: { properties: { ...shape.properties, points: shape.properties.points.map((item: Point) => ({ x: item.x + dx, y: item.y + dy })) } } }));
          } else if ((shape.type === 'line' || shape.type === 'arrow') && shape.properties.start && shape.properties.end) {
            dispatch(updateShapePosition({ id: selectedId, updates: { properties: { ...shape.properties, start: { x: shape.properties.start.x + dx, y: shape.properties.start.y + dy }, end: { x: shape.properties.end.x + dx, y: shape.properties.end.y + dy } } } }));
          }
        });
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
      } else if (currentTool === 'line' || currentTool === 'arrow') {
        dispatch(updateTempShape({ id: 'temp', type: currentTool, color: currentColor, timestamp: Date.now(), properties: { start: startPoint, end: point, points: [startPoint, point] } }));
      } else if (currentTool === 'pen') {
        dispatch(addDrawingPoint(point));
        dispatch(updateTempShape({ id: 'temp', type: 'pen', color: currentColor, timestamp: Date.now(), properties: { points: [...drawingState.points, point] } }));
      }
    }
  };

  // Mouse up handler
  const handleMouseUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (isPanning) {
      setIsPanning(false);
    }

    if (isResizing) {
      setIsResizing(false);
      if (dragSnapshotRef.current) {
        dispatch(commitDrag(dragSnapshotRef.current));
        dragSnapshotRef.current = null;
      }
    }

    if (isRotating) {
      setIsRotating(false);
      if (dragSnapshotRef.current) { dispatch(commitDrag(dragSnapshotRef.current)); dragSnapshotRef.current = null; }
    }

    if (isDragging && selectedShapeId) {
      setIsDragging(false);
      if (dragSnapshotRef.current) {
        dispatch(commitDrag(dragSnapshotRef.current));
        dragSnapshotRef.current = null;
      }
    }

    if (drawingState.isDrawing && (currentTool === 'circle' || currentTool === 'rectangle' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'pen')) {
      if (drawingState.tempShape && (currentTool !== 'pen' || drawingState.points.length > 1)) {
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
      const target = e.target as HTMLElement | null;
      const isEditing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
      if (!isEditing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const shortcuts: Record<string, ToolType> = {
          v: 'select', h: 'hand', p: 'pen', l: 'line', a: 'arrow', t: 'text', s: 'sticky',
        };
        const tool = shortcuts[e.key.toLowerCase()];
        if (tool) {
          dispatch(setTool(tool));
          return;
        }
      }

      if (e.key === 'Delete' && selectedIds.length) {
        selectedIds.forEach((id: string) => shapes.some((shape: Shape) => shape.id === id) ? dispatch(deleteShape(id)) : dispatch(deleteNote(id)));
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
        window.dispatchEvent(new CustomEvent('sketchflow:history-action', { detail: 'undo' }));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sketchflow:history-action', { detail: 'redo' }));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedIds.length) {
        e.preventDefault();
        localStorage.setItem('sketchflow-clipboard', JSON.stringify({ shapes: shapes.filter((shape: Shape) => selectedIds.includes(shape.id)), notes: notes.filter((note: Note) => selectedIds.includes(note.id)) }));
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        const clipboard = e.key.toLowerCase() === 'd'
          ? { shapes: shapes.filter((shape: Shape) => selectedIds.includes(shape.id)), notes: notes.filter((note: Note) => selectedIds.includes(note.id)) }
          : JSON.parse(localStorage.getItem('sketchflow-clipboard') || 'null');
        if (clipboard) {
          const newIds: string[] = [];
          clipboard.shapes.forEach((shape: Shape) => {
            const id = `${Date.now()}-${Math.random()}`;
            newIds.push(id);
            dispatch(addShape({ ...shape, id, properties: { ...shape.properties, x: shape.properties.x === undefined ? undefined : shape.properties.x + 24, y: shape.properties.y === undefined ? undefined : shape.properties.y + 24, points: shape.properties.points?.map((point) => ({ x: point.x + 24, y: point.y + 24 })), start: shape.properties.start && { x: shape.properties.start.x + 24, y: shape.properties.start.y + 24 }, end: shape.properties.end && { x: shape.properties.end.x + 24, y: shape.properties.end.y + 24 } } }));
          });
          clipboard.notes.forEach((note: Note) => { const id = `${Date.now()}-${Math.random()}`; newIds.push(id); dispatch(addNote({ ...note, id, x: note.x + 24, y: note.y + 24 })); });
          dispatch(setSelectedIds(newIds));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, selectedIds, drawingState, currentTool, currentColor, shapes, notes, dispatch]);

  // Helper function to check if point is in note
  const isPointInNote = (point: Point, note: Note): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    
    ctx.font = `${14 / viewState.zoom}px sans-serif`;
    return (
      point.x >= note.x &&
      point.x <= note.x + (note.width ?? Math.max(140, note.text.length * 8)) &&
      point.y >= note.y &&
      point.y <= note.y + (note.height ?? 64)
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
    } else if ((shape.type === 'polygon' || shape.type === 'polyline' || shape.type === 'pen') && shape.properties.points && shape.properties.points.length > 0) {
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
    } else if ((shape.type === 'line' || shape.type === 'arrow') && shape.properties.start && shape.properties.end) {
      return distanceToLineSegment(point, shape.properties.start, shape.properties.end) <= 8 / viewState.zoom;
    }
    return false;
  };

  const getShapeCenter = (shape: Shape): Point => {
    if (shape.type === 'circle') return { x: shape.properties.x ?? 0, y: shape.properties.y ?? 0 };
    if (shape.properties.x !== undefined && shape.properties.y !== undefined) return { x: shape.properties.x + (shape.properties.width ?? 0) / 2, y: shape.properties.y + (shape.properties.height ?? 0) / 2 };
    const points = shape.properties.points ?? [shape.properties.start, shape.properties.end].filter(Boolean) as Point[];
    return points.reduce((center, item) => ({ x: center.x + item.x / points.length, y: center.y + item.y / points.length }), { x: 0, y: 0 });
  };

  const isPointOnRotateHandle = (point: Point, shape: Shape): boolean => {
    if (shape.type !== 'rectangle' || shape.properties.x === undefined || shape.properties.y === undefined || shape.properties.width === undefined) return false;
    return Math.hypot(point.x - (shape.properties.x + shape.properties.width / 2), point.y - shape.properties.y + 26 / viewState.zoom) < 12 / viewState.zoom;
  };

  const isPointOnNoteResizeHandle = (point: Point, note: Note): boolean => {
    const width = note.width ?? 180;
    const height = note.height ?? 90;
    return Math.abs(point.x - (note.x + width)) <= 12 / viewState.zoom && Math.abs(point.y - (note.y + height)) <= 12 / viewState.zoom;
  };

  const isPointOnResizeHandle = (point: Point, shape: Shape): boolean => {
    const tolerance = 10 / viewState.zoom;
    if (shape.type === 'rectangle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.width !== undefined && shape.properties.height !== undefined) {
      return Math.abs(point.x - (shape.properties.x + shape.properties.width)) <= tolerance &&
        Math.abs(point.y - (shape.properties.y + shape.properties.height)) <= tolerance;
    }
    if (shape.type === 'circle' && shape.properties.x !== undefined && shape.properties.y !== undefined && shape.properties.radius !== undefined) {
      return Math.abs(point.x - (shape.properties.x + shape.properties.radius)) <= tolerance &&
        Math.abs(point.y - shape.properties.y) <= tolerance;
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
    if (editingNoteId) {
      dispatch(updateNote({ id: editingNoteId, text }));
      setEditingNoteId(null);
      return;
    }
    dispatch(addNote({
      id: Date.now().toString(),
      text,
      x: notePosition.x,
      y: notePosition.y,
      color: currentColor,
      timestamp: Date.now(),
      width: 180,
      height: 90,
    }));
  };

  const handleDoubleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const point = screenToCanvas(e.clientX, e.clientY);
    const note = [...notes].reverse().find((item) => isPointInNote(point, item));
    if (note) {
      setEditingNoteId(note.id);
      setEditingNoteText(note.text);
      setNoteDialogOpen(true);
    }
  };

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none bg-white cursor-crosshair"
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerCancel={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {remoteCursors.map((cursor) => {
          const user = collaborationUsers[cursor.userId];
          if (!user) return null;
          return <div key={cursor.userId} className="absolute left-0 top-0 flex items-start gap-1 transition-transform duration-75 ease-out" style={{ transform: `translate(${viewState.panX + cursor.x * viewState.zoom}px, ${viewState.panY + cursor.y * viewState.zoom}px)` }}>
            <MousePointer2 className="h-5 w-5 shrink-0 fill-white drop-shadow" style={{ color: user.color }} />
            <span className="mt-4 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm" style={{ backgroundColor: user.color }}>{user.displayName}</span>
          </div>;
        })}
      </div>
      <NoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        onSubmit={handleAddNote}
        initialText={editingNoteText}
      />
    </div>
  );
}