import { z } from "zod";
import type { MemoryDraft } from "@/components/memory-composer";
import type { Memory, Pixel, SceneId } from "../types";
import { SHAPES, type ShapeId } from "../scenes";
import { WORLD_MIN, WORLD_MAX, GRID_SIZE } from "../world-bounds";
import { MAX_ZOOM, MIN_ZOOM } from "./canvas-geometry";
import type { SharedPlace } from "./shared-place";

export interface RecoveryScope { worldId:string; epoch:number; actorId:string }
export type RecoveryPlacement = {kind:"memory";x:number;y:number;sceneId:SceneId} | {kind:"paint";x:number;y:number;shape:ShapeId;color:string;opId:string};
export interface RecoveryInput {
  draft:MemoryDraft|null; brush:Pixel[]; brushOperationId:string|null; sceneId:SceneId;
  joinedBuildId:string|null; pending:RecoveryPlacement|null; camera:SharedPlace|null;
}
export type StoredDraft=Omit<MemoryDraft,"file"|"previewUrl">&{needsFile:boolean;fileName?:string};
export interface ContributionRecovery extends Omit<RecoveryInput,"draft"> {
  version:1;id:string;scope:RecoveryScope;updatedAt:number;draft:StoredDraft|null;photoToken?:string;
}
type RecoveryStorage=Pick<Storage,"length"|"key"|"getItem"|"setItem"|"removeItem">;
const uuid=z.string().uuid(), color=z.string().regex(/^#[0-9a-f]{6}$/i);
const coord=z.number().finite().min(WORLD_MIN).max(WORLD_MAX);
const scene=z.enum(["mixtape","pond","garden"]);
const storedDraft=z.object({
  clientId:uuid,type:z.enum(["text","image","link"]),title:z.string().max(80),body:z.string().max(2000),url:z.string().max(2000),color,
  isBuildInvitation:z.boolean().optional(),assetId:uuid.optional(),inspiredBy:uuid.optional(),paintOperationId:uuid.optional(),
  editId:uuid.optional(),expectedVersion:z.number().int().positive().optional(),needsFile:z.boolean(),fileName:z.string().max(255).optional(),
});
const schema=z.object({
  version:z.literal(1),id:uuid,scope:z.object({worldId:z.string().min(1).max(100),epoch:z.number().int().nonnegative(),actorId:z.string().min(1).max(100)}),updatedAt:z.number().int().min(0).max(8640000000000000),
  draft:storedDraft.nullable(),brush:z.array(z.object({x:z.number().int().min(WORLD_MIN/GRID_SIZE).max(Math.floor(WORLD_MAX/GRID_SIZE)),y:z.number().int().min(WORLD_MIN/GRID_SIZE).max(Math.floor(WORLD_MAX/GRID_SIZE)),color})).max(144),
  brushOperationId:uuid.nullable(),sceneId:scene,joinedBuildId:uuid.nullable(),
  pending:z.discriminatedUnion("kind",[
    z.object({kind:z.literal("memory"),x:coord,y:coord,sceneId:scene}),
    z.object({kind:z.literal("paint"),x:coord,y:coord,shape:z.enum(Object.keys(SHAPES) as [ShapeId,...ShapeId[]]),color,opId:uuid}),
  ]).nullable(),
  camera:z.object({x:coord,y:coord,z:z.number().min(MIN_ZOOM).max(MAX_ZOOM),memoryId:uuid.optional()}).nullable(),photoToken:uuid.optional(),
});
export function hasDraftWork(draft:MemoryDraft|null):boolean {
  return !!draft&&!!(draft.title.trim()||draft.body.trim()||draft.url.trim()||draft.file||draft.assetId||draft.editId||draft.inspiredBy||draft.paintOperationId||draft.isBuildInvitation);
}
/** A stale edit is an unpublished copy, never a silent overwrite of newer work.
 * Missing build-on sources retain their payload for idempotent retries. */
export function prepareRecoveredDraft(draft:MemoryDraft|null,memories:readonly Pick<Memory,"id"|"authorId"|"version">[],actorId:string):{draft:MemoryDraft|null;detached:boolean}{
  if(!draft?.editId)return {draft,detached:false};
  const current=memories.find(memory=>memory.id===draft.editId);
  if(current&&current.authorId===actorId&&current.version===draft.expectedVersion)return {draft,detached:false};
  return {draft:{...draft,clientId:crypto.randomUUID(),editId:undefined,expectedVersion:undefined,...(draft.type==="image"?{previewUrl:draft.file?draft.previewUrl:null,assetId:undefined}:{})},detached:true};
}
export function createRecovery(scope:RecoveryScope,id:string,input:RecoveryInput,updatedAt:number,photoToken?:string):ContributionRecovery|null {
  if(!hasDraftWork(input.draft)&&!input.brush.length&&!input.pending)return null;
  const draft=input.draft?((({file,previewUrl,...rest})=>({...rest,needsFile:!!file,...(file?{fileName:file.name.slice(0,255)}:{})}))(input.draft)):null;
  const parsed=schema.safeParse({version:1,id,scope,updatedAt,...input,draft,photoToken});
  return parsed.success?parsed.data:null;
}
export function decodeRecovery(raw:string|null,scope:RecoveryScope):ContributionRecovery|null {
  if(!raw||raw.length>40000)return null;
  try {
    const value=schema.safeParse(JSON.parse(raw));
    if(!value.success||value.data.scope.worldId!==scope.worldId||value.data.scope.epoch!==scope.epoch||value.data.scope.actorId!==scope.actorId)return null;
    return value.data;
  }catch{return null;}
}
const prefix=(scope:RecoveryScope)=>`memory-box:work:v1:${encodeURIComponent(scope.worldId)}:${scope.epoch}:${encodeURIComponent(scope.actorId)}:`;
export const recoveryKey=(scope:RecoveryScope,id:string)=>prefix(scope)+id;
export function readRecoveries(storage:RecoveryStorage,scope:RecoveryScope):ContributionRecovery[] {
  const records:ContributionRecovery[]=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);if(!key?.startsWith(prefix(scope)))continue;
    const record=decodeRecovery(storage.getItem(key),scope);if(record&&key===recoveryKey(scope,record.id))records.push(record);
  }
  return records.sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
}
export function writeRecovery(storage:RecoveryStorage,record:ContributionRecovery):boolean {
  try{storage.setItem(recoveryKey(record.scope,record.id),JSON.stringify(record));return true;}catch{return false;}
}
export function removeRecovery(storage:RecoveryStorage,scope:RecoveryScope,id:string):boolean {
  try{storage.removeItem(recoveryKey(scope,id));return true;}catch{return false;}
}

/** File bytes stay in the browser, separately from synchronous text/paint recovery. */
function photoTransaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore,set:(value:T)=>void)=>void,fallback:T):Promise<T>{
  return new Promise(resolve=>{
    if(typeof indexedDB==="undefined"){resolve(fallback);return;}
    let db:IDBDatabase|undefined,done=false,value=fallback;
    const finish=(result:T)=>{if(done)return;done=true;clearTimeout(timeout);db?.close();resolve(result);};
    const timeout=setTimeout(()=>finish(fallback),3000);
    try{
      const open=indexedDB.open("memory-box-local-work",1);
      open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains("photos"))open.result.createObjectStore("photos");};
      open.onerror=()=>finish(fallback);open.onblocked=()=>finish(fallback);
      open.onsuccess=()=>{
        db=open.result;if(done){db.close();return;}
        db.onversionchange=()=>db?.close();
        try{
          const tx=db.transaction("photos",mode);tx.oncomplete=()=>finish(value);tx.onabort=()=>finish(fallback);tx.onerror=()=>finish(fallback);
          operation(tx.objectStore("photos"),result=>{value=result;});
        }catch{finish(fallback);}
      };
    }catch{finish(fallback);}
  });
}
export function saveRecoveryPhoto(key:string,token:string,file:File):Promise<boolean>{
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5*1024*1024)return Promise.resolve(false);
  return photoTransaction("readwrite",(store,set)=>{const request=store.put({token,file},key);request.onsuccess=()=>set(true);},false);
}
export function loadRecoveryPhoto(key:string,token:string):Promise<File|null>{
  return photoTransaction<File|null>("readonly",(store,set)=>{const request=store.get(key);request.onsuccess=()=>{const value=request.result;if(value?.token===token&&value.file instanceof File&&value.file.size<=5*1024*1024)set(value.file);};},null);
}
export function removeRecoveryPhoto(key:string):Promise<boolean>{
  return photoTransaction("readwrite",(store,set)=>{const request=store.delete(key);request.onsuccess=()=>set(true);},false);
}
