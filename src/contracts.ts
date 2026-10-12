import type { Entity, Props, StudioDocument, Command } from "./model";
export interface SceneViewProps {
  entity: Entity;
  values: Props;
  interactive?: boolean;
  navigation?: "model" | "camera";
  onChange?: (patch: Props) => void;
  onStatus?: (status: string) => void;
  orbitSensitivity?: number;
  onOrbitHandler?: (id: string, handler: ((event: PointerEvent) => void) | null) => void;
  onHitTest?: (id: string, hit: ((x: number, y: number) => boolean) | null) => void;
}
export interface InspectorProps {
  document: StudioDocument;
  entity: Entity | undefined;
  profileId: string;
  playhead: number;
  signals?: Record<string, number>;
  onCommand: (command: Command, label?: string) => void;
  onPatch: (values: Props) => void;
  onBatch: (commands: Command[], label: string) => void;
  onSeekTrack: (time: number, clockId: string) => void;
}
export interface TimelineProps {
  document: StudioDocument;
  selection: string[];
  profileId: string;
  playhead: number;
  signals?: Record<string, number>;
  playing: boolean;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onCommand: (command: Command, label?: string) => void;
  onBatch: (commands: Command[], label: string) => void;
  onSelect: (id: string) => void;
  clockId?: string;
  onClockSelect?: (id: string) => void;
  editMode?: "key" | "offset";
  onEditMode?: (mode: "key" | "offset") => void;
}
