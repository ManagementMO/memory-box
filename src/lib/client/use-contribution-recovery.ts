"use client";

import { useEffect, useRef, useState } from "react";
import { createRecovery, decodeRecovery, hasDraftWork, loadRecoveryPhoto, readRecoveries, recoveryKey, removeRecovery, removeRecoveryPhoto, saveRecoveryPhoto, writeRecovery, type ContributionRecovery, type RecoveryInput, type RecoveryScope } from "./contribution-recovery";
import {acquireRecoveryLease} from "./recovery-lease";

export function useContributionRecovery(scope:RecoveryScope|null,input:RecoveryInput){
  const [records,setRecords]=useState<ContributionRecovery[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"saved"|"unavailable">("loading");
  const [photoStatus,setPhotoStatus]=useState<"none"|"saving"|"saved"|"missing">("none");
  const [bindingVersion,setBindingVersion]=useState(0);
  const [copyRequiredId,setCopyRequiredId]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  const active=useRef<{scopeKey:string;id:string}|null>(null);
  const ownLease=useRef<(()=>void)|null>(null);
  const photo=useRef<{file:File;token:string;pending:boolean;saved:boolean}|null>(null);
  const changedScopeWithWork=useRef(false);
  const latest=useRef({scope,input});latest.current={scope,input};
  const scopeKey=scope?`${scope.worldId}:${scope.epoch}:${scope.actorId}`:"";
  // Blob/File identity is tracked separately; no file bytes or object URLs enter JSON.
  const signature=JSON.stringify({...input,draft:input.draft?{...input.draft,file:undefined,previewUrl:undefined}:null});
  const read=()=>{
    const current=latest.current.scope;if(!current)return;
    try{setRecords(readRecoveries(localStorage,current).filter(record=>record.id!==active.current?.id));}
    catch{setStatus("unavailable");}
  };
  useEffect(()=>{
    if(!scopeKey){setRecords([]);return;}
    const current=latest.current.input;
    changedScopeWithWork.current=!!active.current&&active.current.scopeKey!==scopeKey&&!!(hasDraftWork(current.draft)||current.brush.length||current.pending);
    const id=active.current?.scopeKey===scopeKey?active.current.id:crypto.randomUUID();
    active.current={scopeKey,id};photo.current=null;
    let disposed=false;
    void acquireRecoveryLease(recoveryKey(latest.current.scope!,id)).then(release=>{
      if(disposed||active.current?.id!==id)release?.();else ownLease.current=release;
    });
    setCopyRequiredId(null);setNotice("");setPhotoStatus("none");setStatus(changedScopeWithWork.current?"unavailable":"ready");read();
    const changed=(event:StorageEvent)=>{if(event.key===null||event.key.startsWith("memory-box:work:v1:"))read();};
    window.addEventListener("storage",changed);return()=>{disposed=true;ownLease.current?.();ownLease.current=null;window.removeEventListener("storage",changed);};
    // Scope values are encoded in the primitive key; no subscription per keystroke.
  },[scopeKey]);

  useEffect(()=>{
    if(!scope||!active.current||active.current.scopeKey!==scopeKey)return;
    if(changedScopeWithWork.current){
      if(hasDraftWork(input.draft)||input.brush.length||input.pending)return;
      changedScopeWithWork.current=false;
    }
    const {id}=active.current,key=recoveryKey(scope,id);
    const file=input.draft?.file;
    if(file&&photo.current?.file!==file)photo.current={file,token:crypto.randomUUID(),pending:false,saved:false};
    if(!file)photo.current=null;
    const record=createRecovery(scope,id,input,Date.now(),photo.current?.token);
    try{
      if(!record){
        if(!removeRecovery(localStorage,scope,id)){setStatus("unavailable");return;}
        void removeRecoveryPhoto(key);setStatus("ready");setPhotoStatus("none");return;
      }
      if(!writeRecovery(localStorage,record)){setStatus("unavailable");return;}
      setStatus("saved");
      if(file&&photo.current){
        if(photo.current.saved){setPhotoStatus("saved");return;}
        if(photo.current.pending)return;
        const token=photo.current.token;
        photo.current.pending=true;
        setPhotoStatus("saving");
        void saveRecoveryPhoto(key,token,file).then(saved=>{
          if(active.current?.id!==id||photo.current?.token!==token)return;
          photo.current.pending=false;photo.current.saved=saved;
          setPhotoStatus(saved?"saved":"missing");
        });
      }else{setPhotoStatus("none");}
    }catch{setStatus("unavailable");}
  },[scopeKey,signature,input.draft?.file,bindingVersion]);

  async function restore(record:ContributionRecovery,asCopy=false):Promise<(RecoveryInput&{missingPhoto:boolean;copied:boolean})|null>{
    const current=latest.current.scope;if(!current||!active.current)return null;
    const currentKey=active.current.scopeKey;
    let stored:ContributionRecovery|null;
    try{stored=decodeRecovery(localStorage.getItem(recoveryKey(current,record.id)),current);}catch{setStatus("unavailable");return null;}
    if(!stored)return null;
    const release=await acquireRecoveryLease(recoveryKey(current,stored.id));
    if(!release&&!asCopy){setCopyRequiredId(record.id);setNotice("This draft may be open in another tab, or this browser cannot claim it. A separate copy gets new save IDs. Check whether the original was posted before publishing a copy.");return null;}
    const file=stored.draft?.needsFile&&stored.photoToken?await loadRecoveryPhoto(recoveryKey(current,stored.id),stored.photoToken):null;
    if(active.current?.scopeKey!==currentKey){release?.();return null;}
    if(release){ownLease.current?.();ownLease.current=release;active.current={scopeKey:currentKey,id:stored.id};photo.current=file&&stored.photoToken?{file,token:stored.photoToken,pending:false,saved:true}:null;}
    setCopyRequiredId(null);setNotice("");
    const {draft,brush,brushOperationId,sceneId,joinedBuildId,pending,camera}=stored;
    read();
    const restored=draft?{...draft,file,previewUrl:file?URL.createObjectURL(file):null}:null;
    return {brush,brushOperationId:release?brushOperationId:null,sceneId,joinedBuildId,pending:!release&&pending?.kind==="paint"?{...pending,opId:crypto.randomUUID()}:pending,camera,draft:!release&&restored?{...restored,clientId:crypto.randomUUID(),editId:undefined,expectedVersion:undefined,assetId:undefined}:restored,missingPhoto:!!draft?.needsFile&&!file,copied:!release};
  }
  async function discard(record:ContributionRecovery){
    const current=latest.current.scope;if(!current||record.scope.worldId!==current.worldId||record.scope.epoch!==current.epoch||record.scope.actorId!==current.actorId)return;
    const release=await acquireRecoveryLease(recoveryKey(current,record.id));
    if(typeof navigator.locks?.request==="function"&&!release){setNotice("This work is open in another tab. Close or discard it there first.");return;}
    try{if(!removeRecovery(localStorage,current,record.id)){setStatus("unavailable");return;}void removeRecoveryPhoto(recoveryKey(current,record.id));setNotice("");read();}catch{setStatus("unavailable");}finally{release?.();}
  }
  function rebind(){
    const current=latest.current.scope;if(!current)return;
    ownLease.current?.();ownLease.current=null;photo.current=null;
    const id=crypto.randomUUID();active.current={scopeKey,id};changedScopeWithWork.current=false;
    void acquireRecoveryLease(recoveryKey(current,id)).then(release=>{if(active.current?.id===id)ownLease.current=release;else release?.();});
    setStatus("ready");
    setBindingVersion(value=>value+1);
  }
  return {records,status,photoStatus,restore,discard,scopeChanged:changedScopeWithWork.current,rebind,copyRequiredId,notice};
}
