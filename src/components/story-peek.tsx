import { ArrowRight, StickyNote, Plus, X } from "./pixel-icons";
import { useEffect, useRef, type CSSProperties } from "react";
import type { Memory } from "@/lib/types";

export function StoryPeek({memory,onRead,onBuild,onNext,onClose}:{memory:Memory;onRead:()=>void;onBuild:()=>void;onNext:()=>void;onClose:()=>void}) {
  const element=useRef<HTMLElement>(null);
  useEffect(()=>{element.current?.focus({preventScroll:true});},[memory.id]);
  return <section ref={element} tabIndex={-1} className="story-peek" aria-label="Story preview" data-story-id={memory.id} style={{"--peek-paper":memory.color} as CSSProperties}>
    <div className="story-peek-header"><span>@{memory.authorName}</span><button type="button" className="icon-button" onClick={onClose} aria-label="Close story preview"><X size={16}/></button></div>
    {memory.type==="image"&&memory.imageUrl?<img className="story-peek-photo" src={memory.imageUrl} alt={memory.title||`Photo by ${memory.authorName}`} />:null}
    {memory.title?<h2>{memory.title}</h2>:null}
    {memory.body?<p className="story-peek-copy">{memory.body}</p>:null}
    <div className="story-peek-actions">
      <button type="button" className="button button-secondary" onClick={onRead}><StickyNote size={15}/>Read</button>
      <button type="button" className="button button-primary" onClick={onBuild}><Plus size={15}/>Build on</button>
      <button type="button" className="button button-secondary" onClick={onNext} aria-label="Wander to another story"><ArrowRight size={16}/></button>
    </div>
  </section>;
}
