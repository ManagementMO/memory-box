"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {BoxMark} from "./box-mark";
import {ArrowLeft,ArrowUpRight,Check,Flag,Image as ImageIcon,MapPin,Undo2} from "./pixel-icons";
import {getBrowserSupabase} from "@/lib/client/supabase";
import {operatorPhoto,operatorQueueRequest,operatorRequest,OperatorRequestError} from "@/lib/client/operator-request";
import {GRID_SIZE} from "@/lib/world-bounds";
import type {OperatorQueue,OperatorReport,OperatorReportReview,OperatorSource} from "@/lib/operator-types";
import styles from "./operator-review.module.css";

type PendingAction={action:"hide"|"restore";memoryId:string}|{action:"resolve"|"dismiss";reportId:string;requestId:string};
type ReadFailure={status:number;message:string};
const date=(value:string)=>new Date(value).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});
const safeLink=(url:string|null)=>url&&/^https?:\/\//i.test(url)?url:null;
function placeLink(report:OperatorReport):string|null {
  if(report.source)return `/#at=${report.source.x},${report.source.y},1&memory=${report.source.id}`;
  const area=report.bounds;
  return area?`/#at=${(area.x+area.width/2)*GRID_SIZE},${(area.y+area.height/2)*GRID_SIZE},1`:null;
}

function ReviewPhoto({source}:{source:OperatorSource}){
  const [requested,setRequested]=useState(false);
  const [url,setUrl]=useState<string|null>(null);
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!requested)return;
    if(source.seedImageUrl){setUrl(source.seedImageUrl);return;}
    const controller=new AbortController();let objectUrl:string|undefined;
    setFailed(false);
    void operatorPhoto(source.id,controller.signal).then(blob=>{
      if(controller.signal.aborted)return;
      objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[source.id,source.seedImageUrl,requested,attempt]);
  if(!requested)return <button className={styles.button} onClick={()=>setRequested(true)}><ImageIcon size={18}/>Load photo</button>;
  if(failed)return <div className={styles.photoFailure}><p role="status">Photo could not be loaded.</p><button className={styles.button} onClick={()=>{setUrl(null);setFailed(false);setAttempt(value=>value+1);}}>Retry photo</button></div>;
  return url?<img className={styles.photo} src={url} alt={source.body||source.title||"Reported photo"} onError={()=>setFailed(true)}/>:<p role="status">Loading photo…</p>;
}

export function OperatorReview(){
  const [queue,setQueue]=useState<OperatorQueue|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState<ReadFailure|null>(null);
  const [pending,setPending]=useState<PendingAction|null>(null);
  const [saving,setSaving]=useState(false);
  const [actionError,setActionError]=useState<string|null>(null);
  const [actionConflict,setActionConflict]=useState(false);
  const [notice,setNotice]=useState("");
  const controller=useRef<AbortController|null>(null);
  const readSequence=useRef(0);
  const authUserId=useRef<string|null|undefined>(undefined);
  const authGeneration=useRef(0);
  const actionSequence=useRef(0);
  const writing=useRef(false);
  const returnActionFocus=useRef(false);
  const confirm=useRef<HTMLButtonElement>(null);
  const actionButton=useRef<HTMLButtonElement>(null);
  const resolveButton=useRef<HTMLButtonElement>(null);
  const dismissButton=useRef<HTMLButtonElement>(null);
  const refreshButton=useRef<HTMLButtonElement>(null);
  const returnTarget=useRef<"visibility"|"resolve"|"dismiss"|"refresh">("visibility");
  const selected=queue?.reports.find(report=>report.id===selectedId)??queue?.reports[0]??null;
  const source=selected?.source;
  const link=selected?placeLink(selected):null;

  const refresh=useCallback(async()=>{
    controller.current?.abort();const requestController=new AbortController();controller.current=requestController;
    const sequence=++readSequence.current;
    setLoading(true);setLoadError(null);setPending(null);setActionError(null);setActionConflict(false);
    try {
      const admitted=await operatorQueueRequest(requestController.signal);
      if(requestController.signal.aborted||sequence!==readSequence.current)return;
      if(authUserId.current!==undefined&&authUserId.current!==admitted.userId){
        // Do not display a response under a different admitted identity even if
        // the browser's auth callback has not arrived yet.
        authUserId.current=admitted.userId;++authGeneration.current;++actionSequence.current;writing.current=false;
        setPending(null);setNotice("");setActionError(null);setActionConflict(false);setSaving(false);setSelectedId(null);
        throw new OperatorRequestError("Your session changed. Load the operator queue again.",401,"session_changed");
      }
      authUserId.current=admitted.userId;
      const next=admitted.queue;
      setQueue(next);setSelectedId(current=>next.reports.some(report=>report.id===current)?current:next.reports[0]?.id??null);
    } catch(error) {
      if(requestController.signal.aborted||sequence!==readSequence.current)return;
      const status=error instanceof OperatorRequestError?error.status:503;
      if(status===401||status===403)setQueue(null);
      setLoadError({status,message:error instanceof Error?error.message:"The queue could not be loaded. Try again."});
    } finally {if(!requestController.signal.aborted&&sequence===readSequence.current)setLoading(false);}
  },[]);

  useEffect(()=>{
    void refresh();
    let unsubscribe:(()=>void)|undefined;
    let reauthorize:ReturnType<typeof setTimeout>|undefined;
    try {
      const {data}=getBrowserSupabase().auth.onAuthStateChange((_event,session)=>{
        const nextId=session?.user.id??null;
        if(authUserId.current===nextId)return;
        authUserId.current=nextId;++authGeneration.current;++actionSequence.current;++readSequence.current;
        controller.current?.abort();writing.current=false;returnActionFocus.current=false;
        setQueue(null);setSelectedId(null);setPending(null);setSaving(false);setActionError(null);setActionConflict(false);setNotice("");
        if(reauthorize)clearTimeout(reauthorize);
        if(nextId){
          setLoading(true);setLoadError(null);
          // Supabase's callback must finish before another auth.getSession call.
          reauthorize=setTimeout(()=>void refresh(),0);
        }else{
          setLoading(false);setLoadError({status:401,message:"Use the browser session already approved as an operator."});
        }
      });
      unsubscribe=()=>data.subscription.unsubscribe();
    } catch { /* refresh presents missing client configuration as a load failure. */ }
    return ()=>{++authGeneration.current;++actionSequence.current;controller.current?.abort();if(reauthorize)clearTimeout(reauthorize);unsubscribe?.();};
  },[refresh]);
  useEffect(()=>{
    if(pending)confirm.current?.focus();
    else if(returnActionFocus.current&&!loading&&!saving){
      const target=returnTarget.current==="resolve"?resolveButton.current:returnTarget.current==="dismiss"?dismissButton.current:returnTarget.current==="refresh"?refreshButton.current:actionButton.current;
      if(target&&!target.disabled){target.focus();returnActionFocus.current=false;}
    }
  },[pending,loading,saving]);

  function cancelAction(){returnActionFocus.current=true;setPending(null);setActionError(null);}
  function beginReview(action:"resolve"|"dismiss"){
    if(!selected)return;
    returnTarget.current=action;setActionConflict(false);setActionError(null);
    setPending({action,reportId:selected.id,requestId:crypto.randomUUID()});
  }

  async function applyAction(){
    if(!pending||writing.current||loading||loadError||actionConflict)return;
    const generation=authGeneration.current,writeSequence=++actionSequence.current;
    writing.current=true;setSaving(true);setActionError(null);setNotice("");
    try {
      if("reportId" in pending){
        const acceptance=await operatorRequest<OperatorReportReview>({method:"POST",body:JSON.stringify(pending)});
        if(generation!==authGeneration.current)return;
        if(acceptance.reportId!==pending.reportId||acceptance.requestId!==pending.requestId||acceptance.state!==(pending.action==="resolve"?"resolved":"dismissed"))throw new Error("The review could not be confirmed. Refresh the queue before continuing.");
        setQueue(current=>current?{...current,reports:current.reports.filter(report=>report.id!==pending.reportId)}:current);
        setSelectedId(null);setNotice(pending.action==="resolve"?"Report resolved.":"Report dismissed.");returnTarget.current="refresh";
      }else{
        await operatorRequest({method:"POST",body:JSON.stringify(pending)});
        if(generation!==authGeneration.current)return;
        const visibility=pending.action==="hide"?"hidden":"published";
        setQueue(current=>current?{...current,reports:current.reports.map(report=>report.source?.id===pending.memoryId?{...report,source:{...report.source,visibility}}:report)}:current);
        setNotice(pending.action==="hide"?"Original hidden. Reports remain open.":"Original restored. Reports remain open.");
      }
      returnActionFocus.current=true;setPending(null);await refresh();
    } catch(error) {
      if(generation!==authGeneration.current)return;
      if(error instanceof OperatorRequestError&&(error.status===401||error.status===403)){
        setQueue(null);setPending(null);setLoadError({status:error.status,message:error.message});
      } else {
        setActionError(error instanceof Error?error.message:"The action could not be saved. Try again.");
        if(error instanceof OperatorRequestError&&(error.status===409||error.status===404))setActionConflict(true);
      }
    } finally {if(writeSequence===actionSequence.current){writing.current=false;setSaving(false);}}
  }
  function choose(id:string){setSelectedId(id);setPending(null);setActionError(null);setActionConflict(false);setNotice("");}
  const unavailableTitle=loadError?.status===401?"Operator session required":loadError?.status===403?"Operator access required":"Queue could not be loaded";

  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}><BoxMark/><span>Memory Box<small>Operator review</small></span></a>
      <a className={styles.button} href="/"><ArrowLeft size={18}/>Back to canvas</a>
    </header>
    <div className={styles.heading}><div><p className={styles.eyebrow}><Flag size={16}/>Review queue</p><h1>Open reports</h1><p>Review the context, then resolve or dismiss the report.</p></div>
      {queue&&<button ref={refreshButton} className={styles.button} onClick={()=>void refresh()} disabled={loading||saving}>{loading?"Refreshing…":"Refresh queue"}</button>}
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice||(loading?"Checking operator access and loading reports…":"")}</p>
    {loadError&&<section className={styles.error} role="alert"><h2>{queue?"Queue could not be refreshed":unavailableTitle}</h2><p>{loadError.message}</p>
      {queue&&<p>Shown source details may be out of date. Refresh before making a change.</p>}
      <button className={styles.button} onClick={()=>void refresh()} disabled={loading||saving}>Try again</button>
      {(loadError.status===401||loadError.status===403)&&<p className={styles.small}>Use the same browser session as an existing operator profile. This page cannot grant access.</p>}
    </section>}
    {!loading&&!loadError&&queue?.reports.length===0&&<section className={styles.empty}><Check size={28}/><h2>No open reports</h2><p>There are no open reports in this queue.</p></section>}
    {queue&&queue.reports.length>0&&<div className={styles.workspace} aria-busy={loading||saving}>
      <nav className={styles.list} aria-label="Open reports"><div className={styles.listHeading}><strong>{queue.reports.length}{queue.hasMore?"+":""} open</strong><span>Newest first</span></div>
        {queue.reports.map(report=><button type="button" key={report.id} aria-current={report.id===selected?.id?"true":undefined} disabled={saving} className={styles.report} onClick={()=>choose(report.id)}>
          <span className={styles.reportTitle}>{report.source?.title|| (report.memoryId?"Reported original":"Reported canvas area")}</span>
          <span className={styles.reasonPreview}>{report.reason}</span><time dateTime={report.createdAt}>{date(report.createdAt)}</time>
        </button>)}
      </nav>
      {selected&&<article className={styles.detail} aria-label="Report details">
        <section className={styles.reportReason}><p className={styles.eyebrow}>Report reason</p><p className={styles.prose}>{selected.reason}</p><time dateTime={selected.createdAt}>{date(selected.createdAt)}</time></section>
        {source?<section className={styles.source}>
          <div className={styles.sourceHeading}><p className={styles.eyebrow}>Current original · version {source.version}</p><span className={styles.badge} data-visibility={source.visibility}>{source.visibility==="published"?"Visible":"Hidden"}</span></div>
          <h2>{source.title|| (source.type==="image"?"Untitled photo":"Untitled original")}</h2><p className={styles.small}>By {source.authorName} · updated {date(source.updatedAt)}</p>
          {source.body&&<p className={styles.prose}>{source.body}</p>}
          {source.imageAvailable&&<ReviewPhoto key={`${source.id}:${source.version}`} source={source}/>}
          {safeLink(source.url)&&<a className={styles.external} href={safeLink(source.url)!} target="_blank" rel="noopener noreferrer">Open attached link<ArrowUpRight size={16}/></a>}
          <p className={styles.coordinates}><MapPin size={16}/>{source.x}, {source.y}{source.inspiredBy&&<span>· Built on another original</span>}</p>
          {link&&source.visibility==="published"&&<a className={styles.button} href={link} target="_blank" rel="noopener noreferrer">View on canvas<ArrowUpRight size={16}/></a>}
        </section>:<section className={styles.source}><h2>{selected.memoryId?"Original unavailable":"Reported canvas area"}</h2>
          <p>{selected.memoryId?"The original was withdrawn or is no longer available. Its content cannot be restored here.":"Review the marked area on the canvas. This queue does not clear pixels."}</p>
          {selected.bounds&&<><p className={styles.coordinates}>Cells {selected.bounds.x}, {selected.bounds.y} · {selected.bounds.width} × {selected.bounds.height}</p>{link&&<a className={styles.button} href={link} target="_blank" rel="noopener noreferrer">View area on canvas<ArrowUpRight size={16}/></a>}</>}
        </section>}
        <footer className={styles.actions}>
          {actionError&&<p className={styles.actionError} role="alert">{actionError}</p>}
          {pending?<section aria-label="Confirm moderation" className={styles.confirmation} onKeyDown={event=>{if(event.key==="Escape"&&!saving)cancelAction();}}>
            <strong>{pending.action==="hide"?"Hide this original?":pending.action==="restore"?"Restore this original?":pending.action==="resolve"?"Resolve this report?":"Dismiss this report?"}</strong><p>{pending.action==="hide"?"This removes it from the public canvas and search. You can restore it here. Reports remain open.":pending.action==="restore"?"This makes it public again. Search will update after indexing. Reports remain open.":pending.action==="resolve"?"This closes the report as resolved without changing the original or pixels.":"This closes the report as dismissed without changing the original or pixels."}</p>
            <div className={styles.actionRow}><button ref={confirm} className={`${styles.button} ${styles.primary}`} onClick={()=>void applyAction()} disabled={saving||loading||Boolean(loadError)||actionConflict}>{saving?"Saving…":`Confirm ${pending.action}`}</button><button className={styles.button} onClick={cancelAction} disabled={saving}>Cancel</button></div>
          </section>:<div className={styles.actionRow}>
            {source&&<button ref={actionButton} className={`${styles.button} ${styles.primary}`} disabled={loading||saving||Boolean(loadError)} onClick={()=>{returnTarget.current="visibility";setPending({action:source.visibility==="published"?"hide":"restore",memoryId:source.id});}}>
            {source.visibility==="hidden"?<Undo2 size={18}/>:<Flag size={18}/>} {source.visibility==="published"?"Hide original":"Restore original"}
            </button>}
            <button ref={resolveButton} className={styles.button} disabled={loading||saving||Boolean(loadError)} onClick={()=>beginReview("resolve")}><Check size={18}/>Resolve report</button>
            <button ref={dismissButton} className={styles.button} disabled={loading||saving||Boolean(loadError)} onClick={()=>beginReview("dismiss")}>Dismiss report</button>
          </div>}
        </footer>
        <p className={styles.limitation}>Report decisions are private. Resolving or dismissing does not change the original or pixels; hide or restore the original separately when needed.</p>
      </article>}
    </div>}
    {queue?.hasMore&&<p className={styles.small}>Showing the {queue.limit} newest open reports. Additional older reports are not shown in this view.</p>}
  </main>;
}
