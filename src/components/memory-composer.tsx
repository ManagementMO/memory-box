"use client";

import { ArrowRight, Globe2, Image as ImageIcon, ImagePlus, Link2, Type, X } from "./pixel-icons";
import { useRef } from "react";
import type { Memory, MemoryType, SceneId } from "@/lib/types";
import { PAPER_COLORS } from "@/lib/scenes";

export interface MemoryDraft {
  clientId: string; type: MemoryType; title: string; body: string; url: string; color: string;
  file: File | null; previewUrl: string | null; assetId?: string; inspiredBy?: string; paintOperationId?: string; editId?: string; expectedVersion?: number;
}
export function newDraft(inspiredBy?: string, paintOperationId?: string): MemoryDraft {
  return { clientId: crypto.randomUUID(), type: "text", title: "", body: "", url: "", color: PAPER_COLORS[0], file: null, previewUrl: null, inspiredBy, paintOperationId };
}

export function MemoryComposer({ draft, onChange, parent, sceneId, onSceneChange, onOriginal, onPreview, busy, error }: {
  draft: MemoryDraft; onChange: (draft: MemoryDraft) => void; parent?: Memory; sceneId: SceneId; onSceneChange: (id: SceneId) => void;
  onOriginal: (id: string) => void; onPreview: () => void; busy: string; error: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const change = (next: Partial<MemoryDraft>) => onChange({ ...draft, ...next });
  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    change({ file, previewUrl, assetId: undefined });
  };
  return <form className="composer" onSubmit={(event) => { event.preventDefault(); onPreview(); }}>
    <div className="public-label"><Globe2 size={16} />Public on the canvas</div>
    {parent ? <div className="lineage"><span>Building on @{parent.authorName}</span><button type="button" onClick={() => onOriginal(parent.id)}>{parent.title || parent.body.slice(0, 55)}<ArrowRight size={14} /></button><small>Your contribution will link back here.</small></div> : null}
    {!draft.editId ? <div className="type-switch" aria-label="Kind of memory">{([{ id: "text", label: "Text", icon: Type }, { id: "image", label: "Image", icon: ImageIcon }, { id: "link", label: "Link", icon: Link2 }] as const).map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={draft.type === id} onClick={() => change({ type: id })}><Icon size={18} />{label}</button>)}</div> : null}
    {draft.type === "image" ? <>
      <div className={`upload-box${draft.previewUrl ? " has-image" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!draft.editId) chooseFile(event.dataTransfer.files[0]); }}>
        {draft.previewUrl ? <img src={draft.previewUrl} alt="Your image preview" /> : <><ImagePlus size={28} /><span>A photo, screenshot, or drawing</span><small>PNG, JPEG or WebP · up to 5 MB</small></>}
        {!draft.editId ? <button type="button" className="button button-secondary" onClick={() => fileInput.current?.click()}>{draft.file ? "Choose another image" : "Choose an image"}</button> : null}
        <input ref={fileInput} type="file" className="visually-hidden" accept="image/png,image/jpeg,image/webp" aria-label="Choose image" onChange={(event) => chooseFile(event.target.files?.[0])} disabled={!!draft.editId} />
        {draft.file ? <span className="upload-filename">{draft.file.name}</span> : null}
      </div>
    </> : null}
    {draft.type === "link" ? <label className="field">Link<input type="url" value={draft.url} onChange={(event) => change({ url: event.target.value })} placeholder="https://…" maxLength={2000} /></label> : null}
    <label className="field">{draft.type === "text" ? "A title, if you want" : "A short title"}<input value={draft.title} onChange={(event) => change({ title: event.target.value })} maxLength={80} placeholder="Give this a name" /></label>
    <label className="field">{draft.type === "text" ? (parent ? "What did it bring to mind?" : "Your memory or idea") : "The story behind it"}<textarea value={draft.body} onChange={(event) => change({ body: event.target.value })} maxLength={2000} rows={5} placeholder={parent ? "Add your response…" : draft.type === "image" ? "Add a caption…" : "Write something…"} /><span className="field-counter" aria-hidden="true">{draft.body.length}/2000</span></label>
    {draft.type === "text" ? <div className="paper-picker"><span>Paper</span><div>{PAPER_COLORS.map((color, index) => <button type="button" key={color} className="color-swatch" style={{ background: color }} aria-pressed={draft.color === color} aria-label={`${["Butter", "Lilac", "Blush", "Peach", "Ice"][index]} paper`} onClick={() => change({ color })} />)}</div></div> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button type="submit" className="button button-primary button-full" disabled={!!busy}>{busy || (draft.editId ? "Save changes" : "Choose its place")}{!busy ? <ArrowRight size={16} /> : <span className="spinner" />}</button>
    {draft.editId ? <p className="fine-print">Position and connections stay unchanged.</p> : null}
  </form>;
}
