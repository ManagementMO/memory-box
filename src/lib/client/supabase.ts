"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { SessionIdentity } from "@/lib/types";

let client: SupabaseClient | undefined;
let guestRequest: Promise<Session> | undefined;

/** Diagnostic fields only: never copy messages, URLs, headers, or auth payloads. */
export function safeConnectionFailure(cause: unknown) {
  const error = cause && typeof cause === "object" ? cause as { name?: unknown; code?: unknown; status?: unknown } : {};
  const name = typeof error.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name) ? error.name : "UnknownError";
  const code = typeof error.code === "string" && /^[A-Za-z0-9_]{1,64}$/.test(error.code) ? error.code : undefined;
  const status = typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 0 && error.status <= 599 ? error.status : undefined;
  return { name, ...(code ? { code } : {}), ...(status !== undefined ? { status } : {}) };
}

export function getBrowserSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("The live world is not connected yet. Please try again in a moment.");
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

export async function guestSession(): Promise<Session> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.auth.getSession().catch(cause => {
    console.warn("[Memory Box] guest admission failed", { phase: "restore-session", ...safeConnectionFailure(cause) });
    throw cause;
  });
  if (error) {
    console.warn("[Memory Box] guest admission failed", { phase: "restore-session", ...safeConnectionFailure(error) });
    throw error;
  }
  if (data.session) return data.session;
  if (!guestRequest) {
    guestRequest = supabase.auth.signInAnonymously().then(({ data: signedIn, error: signInError }) => {
      if (signInError) throw signInError;
      if (!signedIn.session) throw new Error("We couldn’t start your guest session. Please try again.");
      return signedIn.session;
    }).catch(cause => {
      console.warn("[Memory Box] guest admission failed", { phase: "create-guest", ...safeConnectionFailure(cause) });
      throw cause;
    }).finally(() => { guestRequest = undefined; });
  }
  return guestRequest;
}

export function identityFromSession(session: Session): SessionIdentity {
  return {
    id: session.user.id,
    name: typeof session.user.user_metadata?.name === "string" ? session.user.user_metadata.name : `guest-${session.user.id.slice(0, 4)}`,
    isAnonymous: session.user.is_anonymous ?? true,
  };
}
