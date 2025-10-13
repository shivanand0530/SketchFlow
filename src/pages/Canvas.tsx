import { CanvasToolbar } from '@/components/CanvasToolbar';
import { CanvasRenderer } from '@/components/CanvasRenderer';

export default function Canvas() {
  return (
    <div className="h-screen flex flex-col">
      <CanvasToolbar />
      <div className="flex-1 overflow-hidden">
        <CanvasRenderer />
      </div>
    </div>
  );
}
