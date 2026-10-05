import { CanvasToolbar } from '@/components/CanvasToolbar';
import { CanvasRenderer } from '@/components/CanvasRenderer';
import { useBoardPersistence } from '@/hooks/useBoardPersistence';
import { useEffect, useState } from 'react';

export default function Canvas() {
  const { connectionStatus, moveCursor } = useBoardPersistence();
  const [presenceMessage, setPresenceMessage] = useState('');

  useEffect(() => {
    const handleCollaboration = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string; userId: string }>).detail;
      setPresenceMessage(detail.type === 'USER_JOINED' ? 'A collaborator joined' : 'A collaborator left');
      window.setTimeout(() => setPresenceMessage(''), 3000);
    };
    window.addEventListener('sketchflow:collaboration', handleCollaboration);
    return () => window.removeEventListener('sketchflow:collaboration', handleCollaboration);
  }, []);

  return (
    <div className="relative h-[100dvh] min-h-[28rem] overflow-hidden bg-[#fbfcf8]">
      <CanvasToolbar />
      <div className="absolute inset-0 overflow-hidden pl-0 pt-16">
        <CanvasRenderer onCursorMove={moveCursor} />
      </div>
      <div className="absolute bottom-3 left-1/2 z-10 max-w-[calc(100%-7rem)] -translate-x-1/2 truncate rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm sm:bottom-4" role="status">{connectionStatus}{presenceMessage ? ` - ${presenceMessage}` : ''}</div>
    </div>
  );
}
