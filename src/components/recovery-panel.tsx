"use client";

import { useState } from "react";
import type { ContributionRecovery } from "@/lib/client/contribution-recovery";
import { ArrowRight, Image, Paintbrush, StickyNote, Trash2 } from "./pixel-icons";

export function RecoveryPanel({records,busy,onResume,onDiscard,copyRequiredId,notice}:{records:ContributionRecovery[];busy:boolean;onResume:(record:ContributionRecovery,asCopy?:boolean)=>void;onDiscard:(record:ContributionRecovery)=>void;copyRequiredId?:string|null;notice?:string}){
  const [confirm,setConfirm]=useState<string|null>(null);
  return <div className="recovery-list"><p className="panel-copy">Drafts and previews saved in this browser. Check the canvas if a save was interrupted.</p>
    {notice?<p className="panel-copy" role="status">{notice}</p>:null}
    {records.map(record=><div className="recovery-row" key={record.id}>
      <button type="button" className="resume-recovery" disabled={busy} onClick={()=>onResume(record,copyRequiredId===record.id)}>
        {record.draft?.type==="image"?<Image size={20}/>:record.draft?<StickyNote size={20}/>:<Paintbrush size={20}/>}
        <span><strong>{record.draft?.title.trim()||record.draft?.body.trim().slice(0,70)||record.draft?.fileName||"Pixel preview"}</strong><small>{copyRequiredId===record.id?"Make a separate copy · ":""}{record.brush.length?`${record.brush.length} preview pixels · `:""}{new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(record.updatedAt))}</small></span><ArrowRight size={16}/>
      </button>
      <button type="button" className="text-button recovery-remove" disabled={busy} aria-label={confirm===record.id?"Confirm discard of unfinished work":"Discard this unfinished work"} onClick={()=>{if(confirm===record.id){onDiscard(record);setConfirm(null);}else setConfirm(record.id);}}><Trash2 size={15}/>{confirm===record.id?"Discard for good?":"Discard"}</button>
    </div>)}
    {!records.length?<p className="panel-copy">No unfinished work to recover.</p>:null}
  </div>;
}
