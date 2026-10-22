import type { Pixel } from "../types";
import { CELL_MAX, CELL_MIN, WORLD_MAX, WORLD_MIN } from "../world-bounds";

/** Presence is display-only. A peer's self-reported name is never an identity proof. */
export type CursorTool = "wander" | "paint" | "note";
export interface CursorUpdate { x: number; y: number; tool: CursorTool; stroke?: Pixel[] }
export interface LivePeer extends CursorUpdate { sessionId: string; name: string; color: string; updatedAt: number }
export interface PresenceVisitor { sessionId: string; name: string; color: string }
export interface CursorMessage { version: 1; sessionId: string; name: string; sequence: number; cursor: CursorUpdate }

export const PRESENCE_TOPIC = "world:commons:presence";
export const CURSOR_INTERVAL_MS = 250;
export const CURSOR_HEARTBEAT_MS = 4_000;
/** A one-second sweep removes a quiet cursor within eleven seconds. */
export const PEER_TTL_MS = 10_000;
export const STROKE_TTL_MS = 2_000;
export const MAX_PREVIEW_CELLS = 128;
export const MAX_VISIBLE_PEERS = 100;
const COLORS = ["#8760BB", "#BD3F61", "#4E59D5", "#916B20", "#6C62AB", "#B14E81"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function validSessionId(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
export function peerName(value: unknown) {
  return typeof value === "string" ? [...value.slice(0, 256).replace(/[\u0000-\u001f\u007f]/g, "").trim()].slice(0, 32).join("") || "Someone" : "Someone";
}
export function peerColor(sessionId: string) {
  let hash = 0; for (const character of sessionId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}
/** Membership is real; names remain participant-supplied display text. No cursor is inferred. */
export function presenceVisitors(state: unknown, ownSessionId: string): PresenceVisitor[] {
  if (!record(state)) return [];
  const visitors: PresenceVisitor[] = [];
  for (const [sessionId, entries] of Object.entries(state)) {
    if (sessionId === ownSessionId || !validSessionId(sessionId) || !Array.isArray(entries)) continue;
    const member = entries.find(entry => record(entry) && entry.sessionId === sessionId);
    if (record(member)) visitors.push({ sessionId, name: peerName(member.name), color: peerColor(sessionId) });
  }
  return visitors.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}
export function normalizeCursorUpdate(value: unknown): CursorUpdate | null {
  if (!record(value) || typeof value.x !== "number" || typeof value.y !== "number" || !Number.isFinite(value.x) || !Number.isFinite(value.y)
    || value.x < WORLD_MIN || value.x > WORLD_MAX || value.y < WORLD_MIN || value.y > WORLD_MAX
    || typeof value.tool !== "string" || !["wander", "paint", "note"].includes(value.tool)) return null;
  let stroke: Pixel[] | undefined;
  if (value.stroke !== undefined) {
    if (!Array.isArray(value.stroke) || value.stroke.length > MAX_PREVIEW_CELLS) return null;
    stroke = [];
    const seen = new Map<string, number>();
    for (const cell of value.stroke) {
      if (!record(cell) || typeof cell.x !== "number" || typeof cell.y !== "number" || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)
        || cell.x < CELL_MIN || cell.x > CELL_MAX || cell.y < CELL_MIN || cell.y > CELL_MAX || typeof cell.color !== "string" || !HEX.test(cell.color)) return null;
      const next = { x: cell.x, y: cell.y, color: cell.color.toUpperCase() }, key = `${cell.x},${cell.y}`;
      const prior = seen.get(key);
      if (prior === undefined) { seen.set(key, stroke.length); stroke.push(next); } else stroke[prior] = next;
    }
  }
  return { x: Math.round(value.x), y: Math.round(value.y), tool: value.tool as CursorTool, ...(stroke ? { stroke } : {}) };
}
export function decodeCursorMessage(value: unknown, receivedAt: number): { peer: LivePeer; sequence: number } | null {
  if (!record(value) || value.version !== 1 || !validSessionId(value.sessionId) || !Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0) return null;
  const cursor = normalizeCursorUpdate(value.cursor);
  if (!cursor) return null;
  return { peer: { ...cursor, sessionId: value.sessionId, name: peerName(value.name), color: peerColor(value.sessionId), updatedAt: receivedAt }, sequence: value.sequence as number };
}
export function visiblePeers(peers: Iterable<LivePeer>, members: ReadonlySet<string>, ownSessionId: string, now: number): LivePeer[] {
  return [...peers].filter(peer => peer.sessionId !== ownSessionId && members.has(peer.sessionId) && now - peer.updatedAt < PEER_TTL_MS && peer.updatedAt <= now)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.sessionId.localeCompare(b.sessionId)).slice(0, MAX_VISIBLE_PEERS)
    .map(peer => now - peer.updatedAt >= STROKE_TTL_MS && peer.stroke?.length ? { ...peer, stroke: [] } : peer);
}
