"use client";

import { ArrowRight, Check, Globe2, Image as ImageIcon, Link2, Shuffle, Type } from "./pixel-icons";
import { useRef, useState, type CSSProperties } from "react";
import { PixelToolIcon } from "./pixel-tool-icon";
import type { Memory, MemoryType, SceneId } from "@/lib/types";
import { PAPER_COLORS } from "@/lib/scenes";
import { originalLabel } from "@/lib/client/memory-presentation";

export interface MemoryDraft {
  clientId: string; type: MemoryType; title: string; body: string; url: string; color: string;
  isBuildInvitation?: boolean;
  file: File | null; previewUrl: string | null; assetId?: string; inspiredBy?: string; paintOperationId?: string; editId?: string; expectedVersion?: number;
}
export function newDraft(inspiredBy?: string, paintOperationId?: string): MemoryDraft {
  return { clientId: crypto.randomUUID(), type: "text", title: "", body: "", url: "", color: PAPER_COLORS[0], file: null, previewUrl: null, inspiredBy, paintOperationId };
}

const PAPER_NAMES = ["Butter", "Lilac", "Blush", "Peach", "Ice"];
const WRITING_PROMPTS = [
  "Invent a job for the campus goose.",
  "What is the least useful thing you know?",
  "Give an ordinary object a dramatic backstory.",
  "What tiny thing deserves a monument?",
  "Leave a sentence someone else can finish.",
];

export function MemoryComposer({ draft, onChange, parent, sceneId, onSceneChange, onOriginal, onPreview, busy, error }: {
  draft: MemoryDraft; onChange: (draft: MemoryDraft) => void; parent?: Memory; sceneId: SceneId; onSceneChange: (id: SceneId) => void;
  onOriginal: (id: string) => void; onPreview: () => void; busy: string; error: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState<{ draftId: string; index: number } | null>(null);
  const canShowPrompt = draft.type === "text" && !draft.isBuildInvitation && !draft.editId && !draft.inspiredBy && !parent && !draft.title.trim() && !draft.body.trim();
  const activePrompt = prompt?.draftId === draft.clientId ? prompt.index : null;
  const change = (next: Partial<MemoryDraft>) => onChange({ ...draft, ...next });
  const chooseFile = (file: File | undefined) => {
    if (!file || busy) return;
    const previewUrl = URL.createObjectURL(file);
    change({ file, previewUrl, assetId: undefined });
  };
  return <form className="composer" data-kind={draft.type} style={{ "--draft-paper": draft.color } as CSSProperties} onSubmit={(event) => { event.preventDefault(); onPreview(); }}>
    <div className="public-label"><Globe2 size={16} />Public on the canvas</div>
    {parent ? <div className="lineage"><span>Building on @{parent.authorName}</span><button type="button" disabled={!!busy} onClick={() => onOriginal(parent.id)} aria-label={`Read original: ${originalLabel(parent)}`}><span>{originalLabel(parent)}</span><ArrowRight size={14} /></button><small>Your contribution will link back here.</small></div> : null}
    {!draft.editId ? <div className="type-switch" aria-label="Kind of memory">{([{ id: "text", label: "Text", icon: Type }, { id: "image", label: "Image", icon: ImageIcon }, { id: "link", label: "Link", icon: Link2 }] as const).map(({ id, label, icon: Icon }) => <button type="button" disabled={!!busy} key={id} aria-pressed={draft.type === id} onClick={() => change({ type: id })}><Icon size={18} />{label}</button>)}</div> : null}
    <label className="build-invitation-toggle"><input type="checkbox" checked={!!draft.isBuildInvitation} onChange={event=>change({isBuildInvitation:event.target.checked})} disabled={!!busy} /><span>Invite people to build here{draft.isBuildInvitation?<small>Listed in Together. Uncheck to close the invitation.</small>:null}</span></label>
    {draft.type === "link" ? <label className="field">Link<input disabled={!!busy} type="url" value={draft.url} onChange={(event) => change({ url: event.target.value })} placeholder="https://…" maxLength={2000} /></label> : null}
    <div className={`composer-artifact composer-${draft.type === "image" ? "photo" : draft.type === "text" ? "sheet" : "link-note"}`}>
      {draft.type === "image" ? <div className={`upload-box${draft.previewUrl ? " has-image" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!draft.editId) chooseFile(event.dataTransfer.files[0]); }}>
        {draft.previewUrl ? <img src={draft.previewUrl} alt="Your image preview" /> : <><PixelToolIcon tool="photo" /><span>A photo, screenshot, or drawing</span><small>PNG, JPEG or WebP · up to 5 MB</small></>}
        {!draft.editId ? <button type="button" disabled={!!busy} className="button button-secondary" onClick={() => fileInput.current?.click()}>{draft.file ? "Choose another image" : "Choose an image"}</button> : null}
        <input ref={fileInput} type="file" className="visually-hidden" accept="image/png,image/jpeg,image/webp" aria-label="Choose image" onChange={(event) => chooseFile(event.target.files?.[0])} disabled={!!draft.editId || !!busy} />
        {draft.file ? <span className="upload-filename">{draft.file.name}</span> : null}
      </div> : null}
      <label className="field composer-writing">{draft.isBuildInvitation ? "What can people help make?" : draft.type === "text" ? (parent ? "What did it bring to mind?" : "Your memory or idea") : "The story behind it"}<textarea disabled={!!busy} value={draft.body} onChange={(event) => change({ body: event.target.value })} maxLength={2000} rows={draft.type === "text" ? 5 : 3} placeholder={draft.isBuildInvitation ? "Give this goose an interview outfit…" : parent ? "Add your response…" : draft.type === "image" ? "Add a caption…" : "Write something…"} /><span className="field-counter" aria-hidden="true">{draft.body.length}/2000</span></label>
      <label className="field composer-title">{draft.type === "text" ? "A title, if you want" : "A short title"}<input disabled={!!busy} value={draft.title} onChange={(event) => change({ title: event.target.value })} maxLength={80} placeholder="Give this a name" /></label>
    </div>
    {draft.type === "text" ? <div className="paper-picker"><span>Paper</span><div>{PAPER_COLORS.map((color, index) => <button type="button" disabled={!!busy} key={color} className="paper-sample" style={{ "--sample-paper": color } as CSSProperties} aria-pressed={draft.color === color} aria-label={`${PAPER_NAMES[index]} paper`} onClick={() => change({ color })}><span className="paper-sample-sheet" aria-hidden="true" />{draft.color === color ? <Check size={13} /> : null}</button>)}</div></div> : null}
    {canShowPrompt ? <div className={`composer-prompt${activePrompt !== null ? " is-open" : ""}`}>
      {activePrompt !== null ? <div className="composer-prompt-copy"><span>Prompt</span><p aria-live="polite">{WRITING_PROMPTS[activePrompt]}</p></div> : null}
      <button type="button" disabled={!!busy} onClick={() => setPrompt({ draftId: draft.clientId, index: activePrompt === null ? 0 : (activePrompt + 1) % WRITING_PROMPTS.length })}><Shuffle size={16} />{activePrompt === null ? "Need a prompt?" : "Another prompt"}</button>
    </div> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button type="submit" className="button button-primary button-full" disabled={!!busy}>{busy || (draft.editId ? "Save changes" : "Choose its place")}{!busy ? <ArrowRight size={16} /> : <span className="spinner" />}</button>
    {draft.editId ? <p className="fine-print">Position and connections stay unchanged.</p> : null}
  </form>;
}
