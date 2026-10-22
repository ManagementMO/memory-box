import type {Memory} from "@/lib/types";
import {originalLabel} from "@/lib/client/memory-presentation";
import {ArrowLeft,ArrowUpRight,Image as ImageIcon,MapPin,Paintbrush,Plus} from "./pixel-icons";

export function BuildWorkbench({memory,onPaint,onNote,onPhoto,onRead,onShare,onTogether}:{
  memory?:Memory;onPaint:()=>void;onNote:()=>void;onPhoto:()=>void;onRead:()=>void;onShare:()=>void;onTogether:()=>void;
}) {
  if(!memory?.isBuildInvitation)return <div className="build-workbench build-unavailable">
    <p role="status">{memory?"This invitation is closed.":"This invitation is no longer available."}</p>
    <p className="fine-print">The shared canvas and other people’s contributions stay in place.</p>
    {memory?<button type="button" className="text-button" onClick={onRead}>Read original<ArrowUpRight size={14}/></button>:null}
    <button type="button" className="button button-secondary" onClick={onTogether}><ArrowLeft size={14}/>Other builds</button>
  </div>;
  return <div className="build-workbench" data-build-id={memory.id}>
    <h3>{originalLabel(memory)}</h3>
    <p className="build-author">@{memory.authorName} · Open invitation</p>
    {memory.type==="image"&&memory.imageUrl?<img className="build-reference" src={memory.imageUrl} alt={memory.title||`Photo by ${memory.authorName}`}/>:null}
    <p className="build-request">{memory.body}</p>
    <div className="build-tools">
      <button type="button" className="button button-primary" onClick={onPaint}><Paintbrush size={16}/>Paint here</button>
      <button type="button" className="button button-secondary" onClick={onNote}><Plus size={16}/>Add a note</button>
      <button type="button" className="button button-secondary" onClick={onPhoto}><ImageIcon size={16}/>Leave a photo</button>
    </div>
    <p className="fine-print">Paint on the shared pixels. Notes and photos link back here.</p>
    <div className="build-links"><button type="button" className="text-button" onClick={onRead}>Read original<ArrowUpRight size={14}/></button><button type="button" className="text-button" onClick={onShare}><MapPin size={14}/>Meet here</button></div>
    <button type="button" className="text-button" onClick={onTogether}><ArrowLeft size={14}/>Other builds</button>
  </div>;
}
