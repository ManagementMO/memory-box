import { describe, expect, it } from "vitest";
import { CURSOR_INTERVAL_MS, MAX_PREVIEW_CELLS, PEER_TTL_MS, STROKE_TTL_MS, decodeCursorMessage, normalizeCursorUpdate, peerColor, presenceVisitors, visiblePeers } from "../src/lib/client/presence-state";

const one = "2e391fe2-6490-49b9-bb1f-0f40e1d93b11", two = "2e391fe2-6490-49b9-bb1f-0f40e1d93b12";
const payload = { version: 1, sessionId: one, name: "Nina", sequence: 2, cursor: { x: -52.2, y: 12.7, tool: "paint", stroke: [{ x: -9, y: 2, color: "#e7abc6" }] } };

describe("display-only live cursor protocol", () => {
  it("uses receipt time and a local palette instead of trusting peer timestamps or CSS", () => {
    const decoded = decodeCursorMessage({ ...payload, updatedAt: Infinity, color: "url(https://attacker.example)" }, 1234)!;
    expect(decoded.peer).toEqual({ sessionId: one, name: "Nina", x: -52, y: 13, tool: "paint", stroke: [{ x: -9, y: 2, color: "#E7ABC6" }], color: peerColor(one), updatedAt: 1234 });
    expect(decoded.sequence).toBe(2);
  });
  it("rejects malformed, unbounded and non-finite cursor messages", () => {
    for (const cursor of [{ x: Infinity, y: 0, tool: "paint" }, { x: 60000, y: 0, tool: "wander" }, { x: 0, y: -60001, tool: "wander" }, { x: 0, y: 0, tool: "admin" }, { x: 0, y: 0, tool: ["wander"] }, null]) expect(decodeCursorMessage({ ...payload, cursor }, 0)).toBeNull();
    for (const change of [{ sessionId: "anything" }, { version: 2 }, { sequence: -1 }, { sequence: 1.5 }]) expect(decodeCursorMessage({ ...payload, ...change }, 0)).toBeNull();
  });
  it("limits strokes before processing and accepts only real grid cells and hex paint", () => {
    expect(normalizeCursorUpdate({ ...payload.cursor, stroke: Array.from({ length: MAX_PREVIEW_CELLS + 1 }, () => payload.cursor.stroke[0]) })).toBeNull();
    for (const cell of [{ x: -10001, y: 0, color: "#FFFFFF" }, { x: 0.5, y: 0, color: "#FFFFFF" }, { x: 0, y: 0, color: "red" }]) expect(normalizeCursorUpdate({ ...payload.cursor, stroke: [cell] })).toBeNull();
    expect(normalizeCursorUpdate({ ...payload.cursor, stroke: [{ x: -10000, y: 9999, color: "#FFFFFF" }] })).not.toBeNull();
  });
  it("copies, normalizes and coalesces repeated cells without modifying the sender data", () => {
    const source = [{ x: 1, y: 2, color: "#fffaaa" }, { x: 1, y: 2, color: "#000000" }];
    expect(normalizeCursorUpdate({ ...payload.cursor, stroke: source })?.stroke).toEqual([{ x: 1, y: 2, color: "#000000" }]);
    expect(source).toHaveLength(2);
  });
  it("cleans display names but never interprets them as credentials", () => {
    expect(decodeCursorMessage({ ...payload, name: "  A\u0000name\n  " }, 0)?.peer.name).toBe("Aname");
    expect(decodeCursorMessage({ ...payload, name: "a".repeat(80) }, 0)?.peer.name).toHaveLength(32);
  });
  it("shows real idle membership without inventing cursor positions or trusting metadata colors", () => {
    const state = { [one]: [{ sessionId: one, name: "Nina" }], [two]: [{ sessionId: two, name: " Jo\n ", color: "red" }, { sessionId: two, name: "Duplicate" }], arbitrary: [{ sessionId: two }], "2e391fe2-6490-49b9-bb1f-0f40e1d93b13": [{ sessionId: two, name: "Mismatched" }] };
    expect(presenceVisitors(state, one)).toEqual([{ sessionId: two, name: "Jo", color: peerColor(two) }]);
    expect(presenceVisitors(null, one)).toEqual([]);
  });
  it("drops departed, own, stale and future-dated peers; expired strokes disappear before cursors", () => {
    const own = decodeCursorMessage(payload, 0)!.peer;
    const other = { ...own, sessionId: two };
    expect(visiblePeers([own, other], new Set([one, two]), one, 0)).toEqual([other]);
    expect(visiblePeers([other], new Set(), one, 0)).toEqual([]);
    expect(visiblePeers([other], new Set([two]), one, PEER_TTL_MS)).toEqual([]);
    expect(visiblePeers([other], new Set([two]), one, -1)).toEqual([]);
    expect(visiblePeers([other], new Set([two]), one, STROKE_TTL_MS)[0].stroke).toEqual([]);
    expect(other.stroke).toHaveLength(1);
    expect(CURSOR_INTERVAL_MS).toBeGreaterThanOrEqual(250);
    expect(PEER_TTL_MS + 1000).toBeLessThanOrEqual(12000);
  });
});
