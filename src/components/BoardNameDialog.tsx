import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';

interface BoardNameDialogProps {
  open: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}

export function BoardNameDialog({
  open,
  mode,
  initialName = '',
  onOpenChange,
  onSubmit,
}: BoardNameDialogProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [initialName, open]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSubmit(trimmedName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create board' : 'Rename board'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Give your new board a name.' : 'Choose a new name for this board.'}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Board name"
          maxLength={80}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{mode === 'create' ? 'Create board' : 'Save name'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
