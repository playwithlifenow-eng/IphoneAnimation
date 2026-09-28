import type { Entity, Props, StudioDocument, Command } from "./model";
export interface SceneViewProps {
  entity: Entity;
  values: Props;
  interactive?: boolean;
  onChange?: (patch: Props) => void;
  onStatus?: (status: string) => void;
}
export interface InspectorProps {
  document: StudioDocument;
  entity: Entity | undefined;
  profileId: string;
  playhead: number;
  signals?: Record<string, number>;
  onCommand: (command: Command, label?: string) => void;
  onPatch: (values: Props) => void;
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
}
