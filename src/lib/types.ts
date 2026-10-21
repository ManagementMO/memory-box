export type SceneId = "mixtape" | "pond" | "garden";
export type MemoryType = "text" | "image" | "link";
export type IndexStatus = "pending" | "ready" | "failed";

export interface Pixel { x: number; y: number; color: string; revision?: number }
export interface Scene {
  id: SceneId;
  title: string;
  invitation: string;
  x: number;
  y: number;
}
export interface Memory {
  id: string;
  authorId: string | null;
  authorName: string;
  type: MemoryType;
  title: string;
  body: string;
  url: string | null;
  imageUrl: string | null;
  /** Machine-derived visual description; never replaces the authored body. */
  imageDescription?: string | null;
  color: string;
  x: number;
  y: number;
  sceneId: SceneId;
  inspiredBy: string | null;
  paintOperationId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  indexStatus: IndexStatus;
  isSeed: boolean;
}
export interface WorldEvent {
  id: string;
  kind: "paint" | "memory" | "build_on" | "delete" | "moderation" | "undo";
  authorName: string;
  memoryId: string | null;
  operationId: string | null;
  sceneId: SceneId | null;
  description: string;
  createdAt: string;
  isSeed: boolean;
}
export interface WorldSnapshot {
  worldId: string;
  revision: number;
  epoch: number;
  width: number;
  height: number;
  gridSize: number;
  paintingPaused: boolean;
  pixels: Pixel[];
  memories: Memory[];
  events: WorldEvent[];
}
export interface NewMemory {
  clientId: string;
  type: MemoryType;
  title?: string;
  body: string;
  url?: string;
  assetId?: string;
  color: string;
  x: number;
  y: number;
  sceneId: SceneId;
  inspiredBy?: string;
  paintOperationId?: string;
}
export interface SearchResult {
  memory: Memory;
  score: number;
  match: "keyword" | "semantic" | "both";
}
export interface SearchResponse {
  results: SearchResult[];
  mode: "hybrid" | "keyword";
  notice?: string;
}
export interface AnswerClaim { text: string; sourceIds: string[] }
export interface AnswerResponse extends SearchResponse {
  status: "answered" | "insufficient" | "unavailable";
  claims: AnswerClaim[];
  summary: string;
  sourceVersions: Record<string, number>;
}
export interface SessionIdentity { id: string; name: string; isAnonymous: boolean }
export interface WorldNotice { revision: number; epoch: number; kind: string; memoryId?: string }
