"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionIdentity } from "../types";
import { getBrowserSupabase } from "./supabase";
import { CURSOR_HEARTBEAT_MS, CURSOR_INTERVAL_MS, MAX_PREVIEW_CELLS, MAX_VISIBLE_PEERS, PRESENCE_TOPIC, STROKE_TTL_MS, decodeCursorMessage, normalizeCursorUpdate, peerColor, peerName, presenceVisitors, visiblePeers, type CursorMessage, type CursorUpdate, type LivePeer, type PresenceVisitor } from "./presence-state";

/** Ephemeral display hints only. Paint and originals still go through verified server APIs. */
export function usePresence(identity: SessionIdentity | null, connection: string) {
  const [peers, setPeers] = useState<LivePeer[]>([]);
  const [connected, setConnected] = useState(false);
  const [visitors, setVisitors] = useState<PresenceVisitor[]>([]);
  const sessionId = useRef<string | null>(null);
  const sequence = useRef(0);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const currentCursor = useRef<CursorUpdate | null>(null);
  const strokeUpdatedAt = useRef(0);
  const send = useRef<(() => void) | null>(null);
  const retrack = useRef<(() => Promise<void>) | null>(null);
  const admitted = !!identity && connection === "live";

  const publish = useCallback((update: CursorUpdate) => {
    // The local brush can be larger than one network hint; the latest 128 cells suffice.
    const cursor = normalizeCursorUpdate({ ...update, ...(update.stroke ? { stroke: update.stroke.slice(-MAX_PREVIEW_CELLS) } : {}) });
    if (!cursor) return;
    currentCursor.current = cursor;
    strokeUpdatedAt.current = cursor.stroke?.length ? Date.now() : 0;
    send.current?.();
  }, []);

  useEffect(() => {
    if (!admitted) { send.current = null; retrack.current = null; setPeers([]); setVisitors([]); setConnected(false); return; }
    const supabase = getBrowserSupabase();
    const ownId = sessionId.current ?? (sessionId.current = crypto.randomUUID());
    const received = new Map<string, LivePeer>();
    const versions = new Map<string, number>();
    let members = new Set<string>();
    let disposed = false, subscribed = false, tracked = false, lastSentAt = 0;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(PRESENCE_TOPIC, { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: ownId } } });
    const updatePeers = () => {
      if (disposed) return;
      if (document.visibilityState !== "visible") { setPeers([]); return; }
      const next = visiblePeers(received.values(), members, ownId, Date.now());
      // Bound storage too, rather than retaining expired clients indefinitely.
      const active = new Set(next.map(peer => peer.sessionId));
      for (const id of received.keys()) if (!active.has(id)) { received.delete(id); versions.delete(id); }
      setPeers(next);
    };
    const flush = () => {
      if (disposed || !subscribed || !tracked || channel.state !== "joined" || !supabase.realtime.isConnected() || document.visibilityState !== "visible" || !currentCursor.current || !identityRef.current) return;
      if (queued) { clearTimeout(queued); queued = undefined; }
      const remaining = CURSOR_INTERVAL_MS - (Date.now() - lastSentAt);
      if (remaining > 0) { queued = setTimeout(flush, remaining); return; }
      const cursor = currentCursor.current;
      const message: CursorMessage = {
        version: 1, sessionId: ownId, name: peerName(identityRef.current.name), sequence: ++sequence.current,
        cursor: { ...cursor, ...(cursor.stroke?.length && Date.now() - strokeUpdatedAt.current >= STROKE_TTL_MS ? { stroke: [] } : {}) },
      };
      lastSentAt = Date.now();
      // This is deliberately a WebSocket send on a subscribed private channel.
      // Never fall back to REST or publish a cursor while disconnected.
      void channel.send({ type: "broadcast", event: "cursor", payload: message }).catch(() => {});
    };
    send.current = flush;
    const track = async () => {
      if (disposed || !subscribed || document.visibilityState !== "visible" || !identityRef.current) return;
      try {
        const status = await channel.track({ sessionId: ownId, name: peerName(identityRef.current.name), color: peerColor(ownId) });
        if (disposed) return;
        tracked = status === "ok";
        if (tracked && document.visibilityState !== "visible") { tracked = false; void channel.untrack().catch(() => {}); }
        if (tracked) flush();
      } catch { tracked = false; }
    };
    retrack.current = track;
    const syncMembers = () => {
      if (disposed) return;
      const next = presenceVisitors(channel.presenceState(), ownId);
      members = new Set(next.map(visitor => visitor.sessionId));
      setVisitors(document.visibilityState === "visible" ? next : []);
      updatePeers();
    };
    channel
      .on("presence", { event: "sync" }, syncMembers)
      .on("broadcast", { event: "cursor" }, ({ payload }: { payload: unknown }) => {
        if (disposed || document.visibilityState !== "visible") return;
        const decoded = decodeCursorMessage(payload, Date.now());
        if (!decoded || decoded.peer.sessionId === ownId || !members.has(decoded.peer.sessionId)) return;
        if (decoded.sequence <= (versions.get(decoded.peer.sessionId) ?? -1)) return;
        if (!received.has(decoded.peer.sessionId) && received.size >= MAX_VISIBLE_PEERS) return;
        versions.set(decoded.peer.sessionId, decoded.sequence);
        received.set(decoded.peer.sessionId, decoded.peer);
        updatePeers();
      })
      .subscribe(status => {
        if (disposed) return;
        subscribed = status === "SUBSCRIBED";
        setConnected(subscribed);
        if (subscribed) void track();
        else { tracked = false; members.clear(); received.clear(); versions.clear(); setPeers([]); setVisitors([]); }
      });
    const visible = () => {
      if (document.visibilityState === "visible") { syncMembers(); void track(); }
      else {
        tracked = false;
        if (queued) { clearTimeout(queued); queued = undefined; }
        setPeers([]); setVisitors([]);
        if (subscribed) void channel.untrack().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", visible);
    const sweep = setInterval(updatePeers, 1_000);
    const heartbeat = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (tracked) flush(); else if (subscribed) void track();
    }, CURSOR_HEARTBEAT_MS);
    return () => {
      disposed = true; send.current = null; retrack.current = null;
      if (queued) clearTimeout(queued);
      clearInterval(sweep); clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visible);
      void supabase.removeChannel(channel);
    };
  }, [admitted, identity?.id]);

  useEffect(() => { void retrack.current?.(); }, [identity?.name]);

  return { peers, visitors, connected, publish };
}
