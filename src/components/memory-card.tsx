import { ArrowUpRight, Image as ImageIcon, Link2, Quote } from "lucide-react";
import type { Memory } from "@/lib/types";
import { memorySize } from "@/lib/scenes";
import type { CSSProperties } from "react";

export function MemoryCard({ memory, selected, number, dimmed, parentName, onOpen, pending = false }: {
  memory: Memory; selected?: boolean; number?: number; dimmed?: boolean; parentName?: string; onOpen?: () => void; pending?: boolean;
}) {
  const size = memorySize(memory);
  const angle = ((memory.id.charCodeAt(memory.id.length - 1) || 0) % 5) - 2;
  const style = { left: memory.x, top: memory.y, width: size.width, height: size.height, "--memory-width": `${size.width}px`, "--memory-height": `${size.height}px`, "--paper": memory.color, "--tilt": `${angle}deg` } as CSSProperties;
  const content = <>
    <span className="memory-pin" aria-hidden="true">{memory.type === "image" ? <ImageIcon size={13} /> : memory.type === "link" ? <Link2 size={13} /> : <Quote size={13} />}</span>
    {memory.type === "image" ? <span className="memory-photo"><img src={memory.imageUrl ?? ""} alt={memory.title || "Uploaded memory"} draggable={false} /><span><strong className="memory-photo-title">{memory.title || "A little keepsake"}</strong><small className="memory-photo-author">@{memory.authorName}</small></span></span>
      : memory.type === "link" ? <span className="memory-link"><Link2 size={16} /><strong>{memory.title || memory.body}</strong><span>@{memory.authorName}</span></span>
        : <span className="memory-paper"><span className="memory-compact-title">{memory.title || memory.body.slice(0, 70)}</span><span className="memory-paper-copy">{memory.body || memory.title}</span><span className="memory-author">@{memory.authorName}</span></span>}
    {parentName ? <span className="memory-thread-tab">↳ from @{parentName}</span> : null}
    {number ? <span className="memory-number">{number}</span> : null}
  </>;
  const className = `memory-card ${memory.type}${selected ? " is-selected" : ""}${dimmed ? " is-dimmed" : ""}${pending ? " is-pending" : ""}`;
  return pending ? <div className={className} style={style}>{content}</div> : <button type="button" className={className} style={style} data-memory-id={memory.id} onClick={onOpen} aria-label={`${memory.title || memory.body.slice(0, 50)} — ${memory.type} by ${memory.authorName}`}>{content}</button>;
}

export function MemoryResult({ memory, index, onOpen, match }: { memory: Memory; index?: number; onOpen: () => void; match?: string }) {
  return <button type="button" className="memory-result" data-source-id={memory.id} onClick={onOpen}>
    <span className="result-thumb" style={{ background: memory.type === "text" ? memory.color : undefined }}>
      {memory.type === "image" && memory.imageUrl ? <img src={memory.imageUrl} alt="" /> : memory.type === "image" ? <ImageIcon size={18} /> : memory.type === "link" ? <Link2 size={18} /> : <Quote size={18} />}
    </span>
    <span className="result-copy"><span className="result-title">{index !== undefined ? <span className="result-number">{String(index + 1).padStart(2, "0")}</span> : null}{memory.title || memory.body.slice(0, 64)}</span><span className="result-meta">@{memory.authorName} · {memory.type}{memory.isSeed ? " · starter memory" : ""}</span>{match ? <span className="result-match">{match}</span> : null}</span>
    <ArrowUpRight size={14} className="result-arrow" />
  </button>;
}
