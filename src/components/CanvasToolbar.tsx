import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTool, setColor, clearCanvas, setZoom, ToolType, updateShape, updateNoteStyle, Shape, Note } from '@/store/canvasSlice';
import { createBoardShareToken, listMembers, updateMember, type BoardMember } from '@/services/boardService';
import { useAuth } from '@/auth/AuthContext';
import { MousePointer2, Circle, Square, Pentagon, Minus, StickyNote, Trash2, Undo, Redo, ZoomIn, ZoomOut, Hand, PenLine, ArrowUpRight, Type, Share2, History, Users, X, Menu, ArrowLeft, Layers, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useIsMobile } from '@/hooks/use-mobile';

const tools: Array<{ type: ToolType; icon: typeof MousePointer2; label: string; shortcut: string }> = [
  { type: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { type: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
  { type: 'pen', icon: PenLine, label: 'Pen', shortcut: 'P' },
  { type: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { type: 'arrow', icon: ArrowUpRight, label: 'Arrow', shortcut: 'A' },
  { type: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { type: 'sticky', icon: StickyNote, label: 'Sticky note', shortcut: 'S' },
  { type: 'circle', icon: Circle, label: 'Circle', shortcut: '' },
  { type: 'rectangle', icon: Square, label: 'Rectangle', shortcut: '' },
  { type: 'polygon', icon: Pentagon, label: 'Polygon', shortcut: '' },
];

export function CanvasToolbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const boardId = searchParams.get('board');
  const currentTool = useAppSelector((state) => state.canvas.currentTool);
  const currentColor = useAppSelector((state) => state.canvas.currentColor);
  const zoom = useAppSelector((state) => state.canvas.viewState.zoom);
  const canUndo = useAppSelector((state) => state.collaboration.canUndo);
  const canRedo = useAppSelector((state) => state.collaboration.canRedo);
  const selectedIds = useAppSelector((state) => state.canvas.selectedIds);
  const shapes = useAppSelector((state) => state.canvas.shapes);
  const notes = useAppSelector((state) => state.canvas.notes);
  const selectedShape = shapes.find((shape: Shape) => shape.id === selectedIds[0]);
  const selectedNote = notes.find((note: Note) => note.id === selectedIds[0]);
  const [expanded, setExpanded] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRoom, setShowRoom] = useState(false);
  const isMobile = useIsMobile();
  const [members, setMembers] = useState<BoardMember[]>([]);
  const roomUsers = useAppSelector((state) => Object.values(state.collaboration.users));
  const canManageMembers = members.some((member) => member.userId === user?.id && member.role === 'owner');

  useEffect(() => {
    if (isMobile) setExpanded(false);
  }, [isMobile]);

  useEffect(() => {
    if (!boardId) return;
    const loadMembers = () => listMembers(boardId).then(setMembers).catch((error) => console.error('Unable to load board members:', error));
    void loadMembers();
    const refresh = window.setInterval(loadMembers, 3000);
    return () => window.clearInterval(refresh);
  }, [boardId]);

  const updateSelectedColor = (color: string) => {
    dispatch(setColor(color));
    selectedIds.forEach((id: string) => {
      const shape = shapes.find((item: Shape) => item.id === id);
      if (shape) dispatch(updateShape({ id, updates: { color, properties: { ...shape.properties, fill: color } } }));
      if (notes.some((item: Note) => item.id === id)) dispatch(updateNoteStyle({ id, updates: { color } }));
    });
  };

  const shareBoard = async () => {
    if (!boardId) return;
    const token = await createBoardShareToken(boardId);
    const link = `${window.location.origin}${window.location.pathname}#/canvas?board=${encodeURIComponent(boardId)}&invite=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(link);
    window.alert('Share link copied to the clipboard.');
  };

  const changeMemberRole = async (member: BoardMember, role: 'editor' | 'viewer') => {
    if (!boardId || member.role === role) return;
    const updated = await updateMember(boardId, member.userId, role);
    setMembers((current) => current.map((item) => item.userId === updated.userId ? updated : item));
  };

  const control = (label: string, icon: ReactNode, onClick: () => void, disabled = false) => (
    <Tooltip key={label}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onClick} disabled={disabled} aria-label={label}>{icon}</Button></TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>
  );

  return <>
    <aside className={`absolute inset-y-0 left-0 z-20 flex flex-col border-r border-black/10 bg-[#f7f8f3]/95 shadow-xl backdrop-blur transition-[width] duration-200 ${expanded && !isMobile ? 'w-64' : 'w-[4.5rem]'}`}>
      <div className="flex h-16 items-center justify-between border-b border-black/10 px-3">
        {expanded && !isMobile && <button className="flex items-center gap-2 font-semibold text-[#173b36]" onClick={() => navigate('/boards')}><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f5148] text-white"><Layers className="h-4 w-4" /></span>SketchFlow</button>}
        {control(expanded && !isMobile ? 'Collapse tools' : 'Open tools', expanded && !isMobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />, () => setExpanded((value) => !value))}
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {control('Boards dashboard', <ArrowLeft className="h-4 w-4" />, () => navigate('/boards'))}
        <Separator className="my-2" />
        {tools.map((tool) => { const Icon = tool.icon; return <Tooltip key={tool.type}><TooltipTrigger asChild><Button variant={currentTool === tool.type ? 'default' : 'ghost'} className={expanded && !isMobile ? 'justify-start' : ''} size={expanded && !isMobile ? 'default' : 'icon'} onClick={() => dispatch(setTool(tool.type))}><Icon className="h-4 w-4" />{expanded && !isMobile && <span>{tool.label}</span>}{expanded && !isMobile && tool.shortcut && <span className="ml-auto text-xs opacity-50">{tool.shortcut}</span>}</Button></TooltipTrigger>{(!expanded || isMobile) && <TooltipContent side="right">{tool.label} ({tool.shortcut})</TooltipContent>}</Tooltip>; })}
        <Separator className="my-2" />
        {expanded && !isMobile && (selectedShape || selectedNote) && <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-3 text-xs" aria-label="Selected object properties">
          {selectedShape && <><label>Stroke <Input type="number" min="1" max="24" className="mt-1 h-8" value={selectedShape.properties.strokeWidth ?? 2} onChange={(event) => dispatch(updateShape({ id: selectedShape.id, updates: { properties: { ...selectedShape.properties, strokeWidth: Number(event.target.value) } } }))} /></label><label>Opacity <Input type="number" min="0" max="1" step="0.1" className="mt-1 h-8" value={selectedShape.properties.opacity ?? 1} onChange={(event) => dispatch(updateShape({ id: selectedShape.id, updates: { properties: { ...selectedShape.properties, opacity: Number(event.target.value) } } }))} /></label></>}
          {selectedNote && <><label>Text <Input type="color" className="mt-1 h-8 w-full p-1" value={selectedNote.textColor ?? '#1f2937'} onChange={(event) => dispatch(updateNoteStyle({ id: selectedNote.id, updates: { textColor: event.target.value } }))} /></label><label>Background <Input type="color" className="mt-1 h-8 w-full p-1" value={selectedNote.color} onChange={(event) => updateSelectedColor(event.target.value)} /></label></>}
        </div>}
        <div className="mt-auto grid gap-1">
          {control('Undo', <Undo className="h-4 w-4" />, () => window.dispatchEvent(new CustomEvent('sketchflow:history-action', { detail: 'undo' })), !canUndo)}
          {control('Redo', <Redo className="h-4 w-4" />, () => window.dispatchEvent(new CustomEvent('sketchflow:history-action', { detail: 'redo' })), !canRedo)}
          {expanded && !isMobile && <label className="mt-2 flex items-center gap-2 text-xs font-medium">Color <Input type="color" value={currentColor} onChange={(event) => updateSelectedColor(event.target.value)} className="h-8 w-full cursor-pointer" /></label>}
          {control('Zoom out', <ZoomOut className="h-4 w-4" />, () => dispatch(setZoom(zoom / 1.2)))}
          {expanded && !isMobile && <span className="text-center text-xs font-medium text-[#53645f]">{Math.round(zoom * 100)}%</span>}
          {control('Zoom in', <ZoomIn className="h-4 w-4" />, () => dispatch(setZoom(zoom * 1.2)))}
        </div>
      </div>
    </aside>

    <header className="absolute left-0 right-0 top-0 z-10 flex h-16 items-center justify-end gap-1 border-b border-black/10 bg-white/85 px-4 pl-[5.5rem] backdrop-blur">
      <div className="relative"><Button variant={showRoom ? 'secondary' : 'ghost'} size="icon" onClick={() => { setShowRoom((value) => !value); setShowHistory(false); }} aria-label="Show active users"><Users className="h-4 w-4" /><span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#d46b45] px-1 text-[10px] text-white">{roomUsers.length}</span></Button>{showRoom && <div className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><strong className="text-sm text-[#173b36]">People in this board</strong>{canManageMembers && <Button variant="outline" size="sm" onClick={() => void shareBoard()}><Share2 className="mr-1 h-3.5 w-3.5" />Share</Button>}</div><div className="mb-3 text-xs text-[#71827d]">{roomUsers.length} active now</div><div className="grid gap-2">{roomUsers.map((roomUser) => <div key={roomUser.userId} className="flex items-center gap-2 rounded-lg bg-[#f7f8f3] p-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: roomUser.color }} /><span className="flex-1 truncate">{roomUser.userId === user?.id ? `${roomUser.displayName} (you)` : roomUser.displayName}</span><ShieldCheck className="h-3.5 w-3.5 text-[#1f5148]" /></div>)}</div>{canManageMembers && members.length > 0 && <div className="mt-4 border-t border-black/10 pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#71827d]">Permissions</p>{members.map((member) => <div key={member.userId} className="mb-2 flex items-center gap-2 text-xs"><span className="flex-1 truncate">{member.userId === user?.id ? 'You' : member.userId}</span>{member.role === 'owner' ? <span className="text-[#71827d]">Owner</span> : <select className="h-7 rounded border border-black/10 bg-white px-2" value={member.role} onChange={(event) => void changeMemberRole(member, event.target.value as 'editor' | 'viewer')}><option value="viewer">Viewer</option><option value="editor">Editor</option></select>}</div>)}</div>}</div>}</div>
      <div className="relative"><Button variant={showHistory ? 'secondary' : 'ghost'} size="icon" onClick={() => { setShowHistory((value) => !value); setShowRoom(false); }} aria-label="Show history"><History className="h-4 w-4" /></Button>{showHistory && <div className="absolute right-0 top-12 w-64 rounded-xl border border-black/10 bg-white p-4 shadow-xl"><p className="text-sm text-[#53645f]">{canUndo ? 'Your recent canvas changes are available through undo.' : 'No canvas actions yet.'}</p></div>}</div>
      <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="ml-1" onClick={() => setShowClearDialog(true)} aria-label="Clear canvas"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Clear canvas</TooltipContent></Tooltip>
    </header>

    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-[#53645f] shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" />{roomUsers.length} active</div>
    <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear Canvas</AlertDialogTitle><AlertDialogDescription>Are you sure you want to clear the entire canvas? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { dispatch(clearCanvas()); setShowClearDialog(false); }}>Clear Canvas</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
