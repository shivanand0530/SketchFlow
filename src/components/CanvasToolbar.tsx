import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTool, setColor, clearCanvas, undo, redo, setZoom, ToolType } from '@/store/canvasSlice';
import {
  MousePointer2,
  Circle,
  Square,
  Dot,
  Pentagon,
  Minus,
  StickyNote,
  Trash2,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const tools: Array<{ type: ToolType; icon: typeof MousePointer2; label: string; shortcut: string }> = [
  { type: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { type: 'circle', icon: Circle, label: 'Circle', shortcut: 'C' },
  { type: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { type: 'point', icon: Dot, label: 'Point', shortcut: 'P' },
  { type: 'polygon', icon: Pentagon, label: 'Polygon', shortcut: 'G' },
  { type: 'polyline', icon: Minus, label: 'Polyline', shortcut: 'L' },
  { type: 'note', icon: StickyNote, label: 'Note', shortcut: 'N' },
];

export function CanvasToolbar() {
  const dispatch = useAppDispatch();
  const currentTool = useAppSelector((state) => state.canvas.currentTool);
  const currentColor = useAppSelector((state) => state.canvas.currentColor);
  const zoom = useAppSelector((state) => state.canvas.viewState.zoom);
  const canUndo = useAppSelector((state) => state.canvas.history.past.length > 0);
  const canRedo = useAppSelector((state) => state.canvas.history.future.length > 0);
  
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleClearCanvas = () => {
    dispatch(clearCanvas());
    setShowClearDialog(false);
  };

  const handleZoomIn = () => {
    dispatch(setZoom(zoom * 1.2));
  };

  const handleZoomOut = () => {
    dispatch(setZoom(zoom / 1.2));
  };

  return (
    <>
      <div className="border-b bg-card px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Tooltip key={tool.type}>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentTool === tool.type ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => dispatch(setTool(tool.type))}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {tool.label} ({tool.shortcut})
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch(undo())}
                disabled={!canUndo}
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch(redo())}
                disabled={!canRedo}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <label htmlFor="color-picker" className="text-sm font-medium">
            Color:
          </label>
          <Input
            id="color-picker"
            type="color"
            value={currentColor}
            onChange={(e) => dispatch(setColor(e.target.value))}
            className="w-16 h-9 cursor-pointer"
          />
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setShowClearDialog(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear Canvas</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Canvas</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear the entire canvas? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCanvas}>Clear Canvas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}