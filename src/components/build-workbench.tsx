import type {Memory} from "@/lib/types";
import {originalLabel} from "@/lib/client/memory-presentation";
import {ArrowLeft,ArrowUpRight,Image as ImageIcon,MapPin,Paintbrush,Plus} from "./pixel-icons";

export function BuildWorkbench({memory,compact=false,onPaint,onNote,onPhoto,onRead,onShare,onTogether}:{
  memory?:Memory;compact?:boolean;onPaint:()=>void;onNote:()=>void;onPhoto:()=>void;onRead:()=>void;onShare:()=>void;onTogether:()=>void;
}) {
  if(!memory?.isBuildInvitation)return <div className="build-workbench build-unavailable">
    <p role="status">{memory?"This invitation is closed.":"This invitation is no longer available."}</p>
    <p className="fine-print">The shared canvas and other people’s contributions stay in place.</p>
    {memory?<button type="button" className="text-button" onClick={onRead}>Read original<ArrowUpRight size={14}/></button>:null}
    <button type="button" className="button button-secondary" onClick={onTogether}><ArrowLeft size={14}/>Other builds</button>
  </div>;
  return <div className="build-workbench" data-build-id={memory.id}>
    <div id={`build-details-${memory.id}`} className="build-details" hidden={compact}>
    <h3>{originalLabel(memory)}</h3>
    <p className="build-author">@{memory.authorName} · Open invitation</p>
    {memory.type==="image"&&memory.imageUrl?<img className="build-reference" src={memory.imageUrl} alt={memory.title||`Photo by ${memory.authorName}`}/>:null}
    <p className="build-request">{memory.body}</p>
    </div>
    <div className={`build-tools${compact?" is-compact":""}`}>
      <button type="button" className="button button-primary" aria-label="Paint here" onClick={onPaint}><Paintbrush size={16}/>{compact?"Paint":"Paint here"}</button>
      <button type="button" className="button button-secondary" aria-label="Add a note" onClick={onNote}><Plus size={16}/>{compact?"Note":"Add a note"}</button>
      <button type="button" className="button button-secondary" aria-label="Leave a photo" onClick={onPhoto}><ImageIcon size={16}/>{compact?"Photo":"Leave a photo"}</button>
    </div>
    {!compact?<>
    <p className="fine-print">Paint on the shared pixels. Notes and photos link back here.</p>
    <div className="build-links"><button type="button" className="text-button" onClick={onRead}>Read original<ArrowUpRight size={14}/></button><button type="button" className="text-button" onClick={onShare}><MapPin size={14}/>Meet here</button></div>
    <button type="button" className="text-button" onClick={onTogether}><ArrowLeft size={14}/>Other builds</button>
    </>:null}
  </div>;
}
