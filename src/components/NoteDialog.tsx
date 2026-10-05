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

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (text: string) => void;
  initialText?: string;
}

export function NoteDialog({ open, onOpenChange, onSubmit, initialText = '' }: NoteDialogProps) {
  const [text, setText] = useState(initialText);
  useEffect(() => { if (open) setText(initialText); }, [open, initialText]);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
      setText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialText ? 'Edit note' : 'Add Note'}</DialogTitle>
          <DialogDescription>Enter the text for your note</DialogDescription>
        </DialogHeader>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter note text..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
