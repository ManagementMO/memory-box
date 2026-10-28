"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import {SAVED_PLACE_LABEL_LIMIT,SAVED_PLACES_LIMIT,type SavedPlaceChanges,type SavedPlaceWithChanges,type SavedPlacesStatus} from "../lib/client/saved-places";
import {ArrowUpRight,Check,MapPin,Pencil,Trash2,X} from "./pixel-icons";

export interface SavedPlacesPanelProps {
  places:readonly SavedPlaceWithChanges[];status:SavedPlacesStatus;error?:string|null;disabled?:boolean;
  onVisit:(place:SavedPlaceWithChanges)=>void;onRemove:(id:string)=>void|boolean;onRename:(id:string,label:string)=>void|boolean;
}

function changeDescription(changes:SavedPlaceChanges):string{
  if(changes.unavailable)return "This place belongs to another world.";
  if(changes.stale)return "Waiting for the current world view.";
  const parts:string[]=[];
  if(changes.newOriginals)parts.push(`${changes.newOriginals} new nearby original${changes.newOriginals===1?"":"s"}`);
  if(changes.changedOriginals)parts.push(`${changes.changedOriginals} updated original${changes.changedOriginals===1?"":"s"}`);
  if(changes.removedOriginals)parts.push(`${changes.removedOriginals} original${changes.removedOriginals===1?"":"s"} no longer available`);
  if(changes.newReplies)parts.push(`${changes.newReplies} new build-on${changes.newReplies===1?"":"s"}`);
  if(changes.paintedCells)parts.push(`${changes.paintedCells} painted cell${changes.paintedCells===1?"":"s"} changed`);
  if(changes.removedCells)parts.push(`${changes.removedCells} painted cell${changes.removedCells===1?"":"s"} removed`);
  return parts.length?parts.join(" · "):changes.limited?"No counted changes.":"No changes since your last visit.";
}

/** Shows only local names and current aggregate comparisons, never cached original bodies. */
export function SavedPlacesPanel({places,status,error,disabled,onVisit,onRemove,onRename}:SavedPlacesPanelProps){
  const [editing,setEditing]=useState<string|null>(null),[label,setLabel]=useState("");
  const editButtons=useRef(new Map<string,HTMLButtonElement>()),pendingFocus=useRef<string|null>(null);
  useEffect(()=>{
    if(editing&&!places.some(place=>place.id===editing))setEditing(null);
    if(!editing&&pendingFocus.current){editButtons.current.get(pendingFocus.current)?.focus();pendingFocus.current=null;}
  },[editing,places]);
  const cancel=()=>{pendingFocus.current=editing;setEditing(null);};
  const rename=(event:FormEvent,id:string)=>{
    event.preventDefault();if(disabled||!label.trim())return;
    if(onRename(id,label.trim())!==false){pendingFocus.current=id;setEditing(null);}
  };
  const unavailable=error??(status==="unavailable"?"Browser storage is unavailable. Places cannot be saved right now.":null);
  return <section className="saved-places-panel" aria-label="Saved places">
    <div className="saved-places-heading"><h3>Saved places</h3><span>{places.length}/{SAVED_PLACES_LIMIT}</span></div>
    <p className="saved-places-caption">In this browser. Changes since your last visit.</p>
    {unavailable?<p className="saved-places-status" role="status">{unavailable}</p>:null}
    {status==="corrupt"?<p className="saved-places-status" role="status">Some saved-place data could not be read. Valid places are still shown.</p>:null}
    {status==="loading"?<p className="saved-places-empty" role="status">Loading saved places…</p>:null}
    <ol className="saved-place-list">{places.map(place=><li className="saved-place-row" key={place.id} data-saved-place-id={place.id}>
      {editing===place.id?<form className="saved-place-rename" onSubmit={event=>rename(event,place.id)} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();cancel();}}}>
        <label><span>Place name</span><input aria-label="Place name" value={label} maxLength={SAVED_PLACE_LABEL_LIMIT} onChange={event=>setLabel(event.target.value)} autoFocus disabled={disabled}/></label>
        <div className="saved-place-edit-actions"><button className="saved-place-action" type="submit" aria-label="Save place name" disabled={disabled||!label.trim()}><Check size={16}/>Save name</button><button className="saved-place-action" type="button" aria-label="Cancel rename" onClick={cancel}><X size={16}/>Cancel</button></div>
      </form>:<>
        <button className="saved-place-visit" type="button" aria-label={`Visit ${place.label}`} onClick={()=>onVisit(place)} disabled={disabled||place.changes.unavailable}>
          <span className="saved-place-mark" data-changed={place.changes.hasChanges||undefined}><MapPin size={18}/></span>
          <span className="saved-place-label"><strong>{place.label}</strong><small>{Math.round(place.x)}, {Math.round(place.y)}</small></span><ArrowUpRight size={15}/>
        </button>
        <p className="saved-place-changes">{changeDescription(place.changes)}</p>
        {place.changes.limited?<p className="saved-place-caveat">Busy spot: memory changes may be incomplete.</p>:null}
        {place.changes.originalAvailable===false?<p className="saved-place-caveat">Original no longer available. The place is still here.</p>:null}
        <div className="saved-place-actions"><button ref={element=>{if(element)editButtons.current.set(place.id,element);else editButtons.current.delete(place.id);}} type="button" className="saved-place-action" aria-label={`Rename ${place.label}`} onClick={()=>{setLabel(place.label);setEditing(place.id);}} disabled={disabled}><Pencil size={14}/>Rename</button><button type="button" className="saved-place-action" aria-label={`Remove ${place.label}`} onClick={()=>onRemove(place.id)} disabled={disabled}><Trash2 size={14}/>Remove</button></div>
      </>}
    </li>)}</ol>
    {status==="ready"&&!places.length?<p className="saved-places-empty">Save a spot from the map or an original to find it again.</p>:null}
  </section>;
}
