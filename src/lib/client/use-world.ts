"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionIdentity, WorldNotice, WorldSnapshot } from "@/lib/types";
import { publicApi } from "./api";
import { getBrowserSupabase, guestSession, identityFromSession } from "./supabase";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline" | "error";

export function useWorld() {
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState("");
  const [restart, setRestart] = useState(0);
  const mounted = useRef(false);
  const loading = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const subscribed = useRef(false);
  const admissionError = useRef("");
  const worldRef = useRef<WorldSnapshot | null>(null);

  const refresh = useCallback(async () => {
    if (loading.current) { again.current = true; return loading.current; }
    const request = async () => {
      do {
        again.current = false;
        try {
          const next = await publicApi<WorldSnapshot>("/api/world");
          if (!mounted.current) return;
          const current = worldRef.current;
          if (!current || next.epoch > current.epoch || (next.epoch === current.epoch && next.revision >= current.revision)) {
            worldRef.current = next;
            setWorld(next);
          }
          setError(admissionError.current);
          if (subscribed.current && navigator.onLine) setConnection("live");
        } catch (cause) {
          if (!mounted.current) return;
          setError(cause instanceof Error ? cause.message : "The world couldn’t be loaded.");
          setConnection(navigator.onLine ? "error" : "offline");
        }
      } while (again.current && mounted.current);
    };
    loading.current = request().finally(() => { loading.current = null; });
    return loading.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let disposeChannel: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    admissionError.current = "";
    setConnection("connecting");
    async function connect() {
      try {
        const session = await guestSession();
        if (disposed) return;
        const supabase = getBrowserSupabase();
        setIdentity(identityFromSession(session));
        await supabase.realtime.setAuth(session.access_token);
        if (disposed) return;
        const channel = supabase.channel("world:commons", { config: { private: true } });
        const scheduleRefresh = () => {
          if (timer) return;
          timer = setTimeout(() => { timer = undefined; void refresh(); }, 80);
        };
        channel.on("broadcast", { event: "changed" }, ({ payload }: { payload: WorldNotice }) => {
          if (typeof payload?.revision !== "number") return;
          scheduleRefresh();
        }).subscribe((status) => {
          if (disposed) return;
          subscribed.current = status === "SUBSCRIBED";
          if (status === "SUBSCRIBED") void refresh();
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection(navigator.onLine ? "reconnecting" : "offline");
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
          if (next && !disposed) {
            setIdentity((previous) => previous?.id === next.user.id ? { ...identityFromSession(next), name: previous.name } : identityFromSession(next));
            void supabase.realtime.setAuth(next.access_token);
          }
        });
        disposeChannel = () => { listener.subscription.unsubscribe(); void supabase.removeChannel(channel); };
        await refresh();
      } catch (cause) {
        if (!disposed) { admissionError.current = "You can explore the commons. Joining the live world is unavailable right now. Try reconnecting to contribute or ask."; setError(admissionError.current); setConnection(navigator.onLine ? "error" : "offline"); }
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
      if (timer) clearTimeout(timer);
      clearInterval(poll); disposeChannel?.();
      window.removeEventListener("offline", offline); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, restart]);

  const retry = useCallback(() => setRestart((n) => n + 1), []);
  return { world, identity, setIdentity, connection, error, refresh, retry };
}
