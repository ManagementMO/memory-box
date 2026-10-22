import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Memory, NewMemory, Pixel, SceneId, SearchResponse, WorldSnapshot } from "../types";

// This module is imported only by server routes and explicit operator scripts.
// The secret is never read at build time or copied to a public environment name.
let client: SupabaseClient | undefined;
export function adminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("Server database access is unavailable in the browser");
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is unavailable");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return client;
}

export class DatabaseError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = "DatabaseError"; }
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await adminClient().rpc(name, args);
  if (error) throw new DatabaseError(error.message, error.code || "database_error");
  return data as T;
}

export interface ProfileRecord { id: string; name: string; isOperator: boolean; suspended: boolean }
export interface AssetRecord {
  id: string; owner_id: string | null; name: string; staging_path: string;
  path: string | null; status: "staging" | "ready" | "rejected" | "deleted";
  mime: string; size: number; width: number | null; height: number | null; created_at: string;
  description?: string | null;
}
export interface IndexJob { id: string; memory_id: string; source_version: number; attempts: number; memory: Memory }
export interface AssetCleanupClaim { id: string; path: string | null; staging_path: string }
export interface ReadyStagingCleanupClaim { id: string; staging_path: string; claim_token: string }
export interface PaintTurn { serverTime: string; nextPaintAt: string; cooldownSeconds: 15 }
export interface PaintAcceptance extends PaintTurn { status: "accepted"; operationId: string; revision: number; epoch: number; pixels: Pixel[] }
export interface PaintCooldown extends PaintTurn { status: "cooldown"; retryAfterMs: number }
export type PaintResult = PaintAcceptance | PaintCooldown;
export interface UndoAcceptance { operationId: string; revision: number; restored: number; skipped: number }

export const getSnapshot = () => rpc<WorldSnapshot>("mb_snapshot");
export const getChanges = (after: number, epoch: number) => rpc<{ resync: boolean; revision: number; epoch: number; pixels?: Pixel[] }>("mb_changes", { p_after: after, p_epoch: epoch });
export const getProfile = (actorId: string) => rpc<ProfileRecord>("mb_profile", { p_actor: actorId });
export const updateProfile = (actorId: string, name: string) => rpc<ProfileRecord>("mb_profile", { p_actor: actorId, p_name: name });

export const getPaintTurn = (actorId: string) => rpc<PaintTurn>("mb_paint_turn", { p_actor: actorId });
export function applyPaint(actorId: string, opId: string, cells: Pixel[], sceneId?: SceneId | null) {
  return rpc<PaintResult>("mb_apply_paint", { p_actor: actorId, p_client_id: opId, p_cells: cells.map(({ x, y, color }) => ({ x, y, color })), p_scene_id: sceneId || null });
}
export const undoPaint = (actorId: string, operationId: string) => rpc<UndoAcceptance>("mb_undo_paint", { p_actor: actorId, p_operation_id: operationId });

export const createMemory = (actorId: string, input: NewMemory) => rpc<Memory>("mb_create_memory", { p_actor: actorId, p_input: input });
export type MemoryPatch = Partial<Pick<Memory, "title" | "body" | "url" | "color" | "x" | "y" | "sceneId" | "isBuildInvitation">> & { assetId?: string };
export const updateMemory = (actorId: string, id: string, expectedVersion: number, patch: MemoryPatch) => rpc<Memory>("mb_update_memory", { p_actor: actorId, p_id: id, p_version: expectedVersion, p_patch: patch });
export const deleteMemory = (actorId: string, id: string) => rpc<{ assetId: string | null }>("mb_delete_memory", { p_actor: actorId, p_id: id });

export const createAsset = (actorId: string, input: { name: string; mime: string; size: number }) => rpc<AssetRecord>("mb_create_asset", { p_actor: actorId, p_name: input.name, p_mime: input.mime, p_size: input.size });
export async function getAsset(id: string): Promise<AssetRecord | null> {
  const { data, error } = await adminClient().from("assets").select("*").eq("id", id).maybeSingle();
  if (error) throw new DatabaseError(error.message, error.code);
  return data as AssetRecord | null;
}
export const markAssetReady = (actorId: string, id: string, metadata: { path: string; mime: string; width: number; height: number; size: number }) => rpc<AssetRecord>("mb_ready_asset", { p_actor: actorId, p_id: id, p_metadata: metadata });
export const getReadableAsset = (id: string, viewerId?: string | null) => rpc<AssetRecord | null>("mb_readable_asset", { p_id: id, p_viewer: viewerId || null });
export const claimAssetCleanup = (limit = 25) => rpc<AssetCleanupClaim[]>("mb_claim_asset_cleanup", { p_limit: limit });
export const completeAssetCleanup = (id: string) => rpc<boolean>("mb_complete_asset_cleanup", { p_id: id });
export const claimReadyStagingCleanup = (limit = 25) => rpc<ReadyStagingCleanupClaim[]>("mb_claim_ready_staging_cleanup", { p_limit: limit });
export const completeReadyStagingCleanup = (id: string, token: string) => rpc<boolean>("mb_complete_ready_staging_cleanup", { p_id: id, p_token: token });

export function searchMemories(query: string, embedding: number[] | null, sceneId?: SceneId | null, limit = 12, model = process.env.EMBEDDING_MODEL || "supabase/gte-small:padded1536") {
  if (embedding && (embedding.length !== 1536 || embedding.some(n => !Number.isFinite(n)))) throw new Error("Invalid embedding dimensions");
  return rpc<SearchResponse>("mb_search", { p_query: query, p_embedding: embedding ? JSON.stringify(embedding) : null, p_scene_id: sceneId || null, p_limit: limit, p_model: model });
}
export const getIndexJobs = (limit = 5) => rpc<IndexJob[]>("mb_lease_index_jobs", { p_limit: limit });
export function completeIndexJob(id: string, version: number, attempt: number, representation: string, embedding: number[], model = process.env.EMBEDDING_MODEL || "supabase/gte-small:padded1536", imageDescription: string | null = null) {
  if (embedding.length !== 1536 || embedding.some(n => !Number.isFinite(n))) throw new Error("Invalid embedding dimensions");
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Invalid index lease attempt");
  return rpc<boolean>("mb_complete_index_job_leased", { p_job_id: id, p_version: version, p_attempt: attempt, p_representation: representation, p_embedding: JSON.stringify(embedding), p_model: model, p_image_description: imageDescription });
}
export function failIndexJob(id: string, attempt: number, reason: string) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Invalid index lease attempt");
  return rpc<boolean>("mb_fail_index_job_leased", { p_job_id: id, p_attempt: attempt, p_reason: reason.slice(0, 120) });
}
export const consumeBudget = (actorId: string, kind: string, limit: number, windowSeconds: number, cost = 1) => rpc<number>("mb_consume_budget", { p_actor: actorId, p_kind: kind, p_limit: limit, p_window_seconds: windowSeconds, p_cost: cost });
export const createReport = (actorId: string, input: { memoryId?: string; bounds?: { x: number; y: number; width: number; height: number }; reason: string }) => rpc<string>("mb_report", { p_actor: actorId, p_input: input });
export const moderate = (actorId: string, action: "hide" | "restore" | "pause" | "resume" | "clear" | "suspend" | "unsuspend", options: { memoryId?: string; targetActorId?: string; bounds?: { x: number; y: number; width: number; height: number } } = {}) => rpc<{ revision: number; epoch: number }>("mb_moderate", { p_actor: actorId, p_action: action, p_memory_id: options.memoryId || null, p_target_actor: options.targetActorId || null, p_bounds: options.bounds || null });
export async function listReports() {
  const { data, error } = await adminClient().from("reports").select("*").eq("state", "open").order("created_at", { ascending: false }).limit(100);
  if (error) throw new DatabaseError(error.message, error.code);
  return data;
}
