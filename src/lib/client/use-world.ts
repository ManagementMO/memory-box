"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionIdentity, WorldNotice, WorldSnapshot } from "@/lib/types";
import { publicApi } from "./api";
import { getBrowserSupabase, guestSession, identityFromSession, safeConnectionFailure } from "./supabase";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline" | "error";
interface SnapshotRequest {
  generation: number;
  controller: AbortController;
  promise: Promise<WorldSnapshot | null>;
  resolve: (snapshot: WorldSnapshot | null) => void;
}

export function useWorld() {
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState("");
  const [restart, setRestart] = useState(0);
  const mounted = useRef(false);
  const generation = useRef(0);
  const loading = useRef<SnapshotRequest | null>(null);
  const queued = useRef<SnapshotRequest | null>(null);
  const subscribed = useRef(false);
  const admissionError = useRef("");
  const worldRef = useRef<WorldSnapshot | null>(null);

  const refresh = useCallback(async (): Promise<WorldSnapshot | null> => {
    if (!mounted.current) return null;
    const createRequest = (): SnapshotRequest => {
      let resolve!: SnapshotRequest["resolve"];
      const promise = new Promise<WorldSnapshot | null>(done => { resolve = done; });
      return { generation: generation.current, controller: new AbortController(), promise, resolve };
    };
    const startRequest = (active: SnapshotRequest) => {
      loading.current = active;
      const isCurrent = () => mounted.current && generation.current === active.generation && !active.controller.signal.aborted;
      const request = async (): Promise<WorldSnapshot | null> => {
        try {
          const next = await publicApi<WorldSnapshot>("/api/world", { signal: active.controller.signal });
          if (!isCurrent()) return null;
          const current = worldRef.current;
          if (!current || next.epoch > current.epoch || (next.epoch === current.epoch && next.revision >= current.revision)) {
            worldRef.current = next;
            setWorld(next);
          }
          setError(admissionError.current);
          if (subscribed.current && navigator.onLine) setConnection("live");
          return worldRef.current;
        } catch (cause) {
          if (!isCurrent()) return null;
          setError(cause instanceof Error ? cause.message : "The world couldn’t be loaded.");
          setConnection(navigator.onLine ? "error" : "offline");
          return null;
        }
      };
      void request().then(result => {
        if (loading.current === active) {
          const next = queued.current;
          queued.current = null;
          loading.current = null;
          // Install the next request before releasing waiters. Later notices may
          // queue another fetch, but cannot extend this caller's freshness horizon.
          if (next && isCurrent()) startRequest(next);
          else next?.resolve(null);
        }
        active.resolve(result);
      });
    };
    // A caller arriving during an older fetch needs one begun after its call.
    // All callers waiting on that next fetch share it, not every later notice.
    if (loading.current) {
      queued.current ??= createRequest();
      return queued.current.promise;
    }
    const active = createRequest();
    startRequest(active);
    return active.promise;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const currentGeneration = ++generation.current;
    let disposed = false;
    let admitted = true;
    let disposeChannel: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    admissionError.current = "";
    setConnection("connecting");
    async function connect() {
      let phase = "guest-session";
      try {
        const session = await guestSession();
        if (disposed) return;
        const supabase = getBrowserSupabase();
        setIdentity(identityFromSession(session));
        phase = "realtime-auth";
        await supabase.realtime.setAuth(session.access_token);
        if (disposed) return;
        phase = "subscribe-world";
        const channel = supabase.channel("world:commons", { config: { private: true } });
        const scheduleRefresh = () => {
          if (disposed || !admitted || timer) return;
          timer = setTimeout(() => { timer = undefined; void refresh(); }, 80);
        };
        channel.on("broadcast", { event: "changed" }, ({ payload }: { payload: WorldNotice }) => {
          if (typeof payload?.revision !== "number") return;
          scheduleRefresh();
        }).subscribe((status) => {
          if (disposed || !admitted) return;
          subscribed.current = status === "SUBSCRIBED";
          if (status === "SUBSCRIBED") void refresh();
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection(navigator.onLine ? "reconnecting" : "offline");
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
          if (disposed || !admitted) return;
          if (!next) {
            admitted = false;
            subscribed.current = false;
            setIdentity(null);
            if (timer) { clearTimeout(timer); timer = undefined; }
            disposeChannel?.();
            disposeChannel = undefined;
            admissionError.current = "Your guest session ended. Reconnect to contribute or ask.";
            setError(admissionError.current);
            setConnection(navigator.onLine ? "error" : "offline");
            return;
          }
          setIdentity((previous) => previous?.id === next.user.id ? { ...identityFromSession(next), name: previous.name } : identityFromSession(next));
          void supabase.realtime.setAuth(next.access_token);
        });
        disposeChannel = () => { listener.subscription.unsubscribe(); void supabase.removeChannel(channel); };
        phase = "refresh-world";
        await refresh();
      } catch (cause) {
        if (!disposed) {
          console.warn("[Memory Box] live connection failed", { phase, ...safeConnectionFailure(cause) });
          admissionError.current = "You can explore the commons. Joining the live world is unavailable right now. Try reconnecting to contribute or ask."; setError(admissionError.current); setConnection(navigator.onLine ? "error" : "offline");
        }
      }
    }
    const offline = () => { setConnection("offline"); };
    const online = () => { setConnection("reconnecting"); void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    void refresh();
    void connect();
    const poll = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); }, 15_000);
    return () => {
      disposed = true; mounted.current = false; subscribed.current = false;
      if (generation.current === currentGeneration) ++generation.current;
      if (loading.current?.generation === currentGeneration) {
        loading.current.controller.abort();
        loading.current.resolve(null);
        loading.current = null;
      }
      if (queued.current?.generation === currentGeneration) {
        queued.current.controller.abort();
        queued.current.resolve(null);
        queued.current = null;
      }
      if (timer) clearTimeout(timer);
      clearInterval(poll); disposeChannel?.();
      window.removeEventListener("offline", offline); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, restart]);

  const retry = useCallback(() => setRestart((n) => n + 1), []);
  return { world, identity, setIdentity, connection, error, refresh, retry };
}
