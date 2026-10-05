import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, ArrowRight, Search, Shapes, Share2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { createBoard as createBoardRequest, createBoardShareToken, deleteBoard, listBoards, updateBoard, type Board } from "@/services/boardService";
import { UserProfile } from "@/components/UserProfile";
import { useAuth } from "@/auth/AuthContext";
import { BoardNameDialog } from "@/components/BoardNameDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Boards() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<'create' | 'rename'>('create');
  const [boardBeingRenamed, setBoardBeingRenamed] = useState<Board | null>(null);
  const [boardBeingDeleted, setBoardBeingDeleted] = useState<Board | null>(null);

  useEffect(() => {
    listBoards().then(setBoards).catch((error) => console.error('Unable to load boards:', error));
  }, []);

  const openCreateDialog = () => {
    setNameDialogMode('create');
    setBoardBeingRenamed(null);
    setNameDialogOpen(true);
  };

  const createBoard = async (name: string) => {
    const board = await createBoardRequest(name);
    setBoards((current) => [...current, board]);
    navigate(`/canvas?board=${board.id}`);
  };

  const shareBoard = async (boardId: string) => {
    const token = await createBoardShareToken(boardId);
    const shareUrl = `${window.location.origin}${window.location.pathname}#/canvas?board=${encodeURIComponent(boardId)}&invite=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(shareUrl);
    window.alert('Share link copied to the clipboard.');
  };

  const openRenameDialog = (board: Board) => {
    setNameDialogMode('rename');
    setBoardBeingRenamed(board);
    setNameDialogOpen(true);
  };

  const submitBoardName = async (name: string) => {
    if (nameDialogMode === 'rename' && boardBeingRenamed) {
      const updated = await updateBoard(boardBeingRenamed.id, name);
      setBoards((current) => current.map((item) => item.id === updated.id ? updated : item));
      return;
    }
    await createBoard(name);
  };

  const confirmDeleteBoard = async () => {
    if (!boardBeingDeleted || boards.length === 1) return;
    await deleteBoard(boardBeingDeleted.id);
    setBoards((current) => current.filter((board) => board.id !== boardBeingDeleted.id));
    setBoardBeingDeleted(null);
  };

  const visibleBoards = boards.filter((board) => board.name.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  return (
    <main className="min-h-screen bg-[#f7f8f3]">
      <header className="border-b border-black/10 bg-[#f7f8f3]/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => navigate('/')}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f5148] text-white"><Shapes className="h-4 w-4" /></span>
            SketchFlow
          </button>
          <UserProfile />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0"><p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#d46b45]">Workspace</p><h1 className="text-3xl font-semibold tracking-tight text-[#173b36] sm:text-4xl">Your boards</h1><p className="mt-2 truncate text-sm text-[#53645f]">Welcome back, {user?.displayName}.</p></div>
          <Button className="bg-[#1f5148] hover:bg-[#173b36]" onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" />New board</Button>
        </div>
        <div className="relative mb-8 max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71827d]" /><Input className="border-black/10 bg-white pl-9" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search boards" aria-label="Search boards" /></div>
        {visibleBoards.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleBoards.map((board) => <Card key={board.id} className="border-black/10 bg-white shadow-sm"><CardHeader><CardTitle className="truncate text-[#173b36]">{board.name}</CardTitle><p className="text-xs uppercase tracking-wider text-[#71827d]">{board.role}</p></CardHeader><CardContent><div className="flex flex-wrap gap-2"><Button className="min-w-0 flex-1 bg-[#1f5148] hover:bg-[#173b36]" onClick={() => navigate(`/canvas?board=${board.id}`)}>Open <ArrowRight className="ml-2 h-4 w-4" /></Button>{board.role === 'owner' && <><Button variant="outline" size="icon" onClick={() => void shareBoard(board.id)} aria-label={`Copy share link for ${board.name}`}><Share2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => openRenameDialog(board)} aria-label={`Rename ${board.name}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setBoardBeingDeleted(board)} disabled={boards.length === 1} aria-label={`Delete ${board.name}`}><Trash2 className="h-4 w-4" /></Button></>}</div></CardContent></Card>)}</div> : <div className="rounded-xl border border-dashed border-black/20 p-8 text-center text-[#53645f] sm:p-12">No boards match your search.</div>}
      </div>
      <BoardNameDialog open={nameDialogOpen} mode={nameDialogMode} initialName={boardBeingRenamed?.name} onOpenChange={setNameDialogOpen} onSubmit={submitBoardName} />
      <AlertDialog open={Boolean(boardBeingDeleted)} onOpenChange={(open) => !open && setBoardBeingDeleted(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete board?</AlertDialogTitle><AlertDialogDescription>This will permanently remove “{boardBeingDeleted?.name}”.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteBoard}>Delete board</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}
