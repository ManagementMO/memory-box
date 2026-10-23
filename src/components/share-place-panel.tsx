"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldSnapshot } from "@/lib/types";
import type { SharedPlace } from "@/lib/client/shared-place";
import { sharedPlaceUrl } from "@/lib/client/shared-place";
import { ArrowLeft, Check, Copy, MapPin, Send } from "./pixel-icons";
import { PlacePreview } from "./place-preview";
import {measurement} from "@/lib/client/posthog-client";

export function SharePlacePanel({ world, place, onBack }: {
  world: WorldSnapshot; place: SharedPlace; onBack?: () => void;
}) {
  const [url, setUrl] = useState("");
  const [nativeShare, setNativeShare] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const original = world.memories.find(memory => memory.id === place.memoryId);
  useEffect(() => {
    try { setUrl(sharedPlaceUrl(window.location.href, place)); }
    catch { setUrl(""); setMessage("This spot can’t be shared. Close this panel and choose another spot."); return; }
    setNativeShare(typeof navigator.share === "function");
    setMessage(""); setCopied(false);
  }, [place]);
  const manualCopy = () => {
    input.current?.focus(); input.current?.select();
    setMessage("Select and copy the link.");
  };
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) { manualCopy(); return; }
      await navigator.clipboard.writeText(url);
      measurement.shared("copy");
      setCopied(true); setMessage("Link copied. Anyone with it can visit this spot.");
    } catch { manualCopy(); }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "Meet me in Memory Box", url });
      measurement.shared("native");
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) manualCopy();
    }
  };
  return <div className="share-place-panel">
    {onBack ? <button type="button" className="text-button back-link" onClick={onBack}><ArrowLeft size={14} />Back to original</button> : null}
    <div className="place-ticket">
      <PlacePreview world={world} place={place} />
      <div className="place-ticket-caption"><MapPin size={22} /><div><strong>{original ? original.title || original.body.slice(0, 60) : "This spot, in the same canvas"}</strong><span>{original ? `Original by @${original.authorName}` : `x ${Math.round(place.x).toLocaleString()} · y ${Math.round(place.y).toLocaleString()}`}</span></div></div>
    </div>
    <p className="share-description">{original ? "Opens this original with its author and build-ons." : "Send someone straight here to paint or leave something beside you."}</p>
    <div className="share-actions"><button type="button" className="button button-primary" onClick={() => void copy()} disabled={!url}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy link"}</button>{nativeShare ? <button type="button" className="button button-secondary" onClick={() => void share()} disabled={!url}><Send size={16} />Share…</button> : null}</div>
    <label className="field share-link-field">Link to this {place.memoryId ? "original" : "spot"}<input ref={input} readOnly value={url} onFocus={event => event.currentTarget.select()} spellCheck={false} /></label>
    <p className="share-feedback" role="status">{message}</p>
    <p className="fine-print">Public canvas. The link opens what’s here now, even after it changes.</p>
  </div>;
}
