"use client";

import { getBrowserSupabase, guestSession } from "./supabase";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}

export async function publicApi<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof payload?.error === "string" ? payload.error : "The commons couldn’t be loaded. Please try again.", response.status);
  return payload as T;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await guestSession();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(typeof payload?.error === "string" ? payload.error : "That didn’t go through. Please try again.", response.status);
  }
  return payload as T;
}

export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
  const prepared = await api<{ assetId: string; path: string; token: string }>("/api/uploads", {
    method: "POST", body: JSON.stringify({ name: file.name, mime: file.type, size: file.size }),
  });
  const { error } = await getBrowserSupabase().storage.from("memory-staging").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
  if (error) throw new Error("Your image didn’t finish uploading. Keep this draft and try again.");
  return prepared.assetId;
}
