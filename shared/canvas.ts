export type BoardObjectType = 'circle' | 'rectangle' | 'point' | 'polygon' | 'polyline' | 'pen' | 'line' | 'arrow' | 'note';

export interface BoardObject {
  id: string;
  type: BoardObjectType;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  rotation: number;
  style: { color: string; textColor?: string };
  text?: string;
  properties?: Record<string, unknown>;
}

export interface BoardDocument {
  objects: BoardObject[];
}
