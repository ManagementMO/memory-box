import type {WorldSnapshot} from "../types";

export type SnapshotHead=Omit<WorldSnapshot,"pixels">;
const MAX_PIXEL_CACHE_AGE_MS=60_000;
type Version=Pick<WorldSnapshot,"worldId"|"revision"|"epoch">;
const valid=(value:Version)=>value&&typeof value.worldId==="string"&&value.worldId.length>0&&Number.isSafeInteger(value.revision)&&value.revision>=0&&Number.isSafeInteger(value.epoch)&&value.epoch>=1;
const same=(a:Version,b:Version)=>a.worldId===b.worldId&&a.epoch===b.epoch&&a.revision===b.revision;
const reaches=(value:Version,floor:Version)=>valid(value)&&value.worldId===floor.worldId&&(value.epoch>floor.epoch||value.epoch===floor.epoch&&value.revision>=floor.revision);

/** Per-instance reuse of public pixel serialization. Originals are always fresh.
 * Each caller first observes its own database version. An older in-flight load
 * cannot satisfy a call that began after a mutation. A failed head never falls
 * back to cached content, including during the final source check for Ask.
 */
export function createSnapshotReader({readHead,load,now=Date.now}:{readHead:()=>Promise<SnapshotHead>;load:()=>Promise<WorldSnapshot>;now?:()=>number}){
  let cached:{value:WorldSnapshot;at:number}|undefined;
  let flight:Promise<WorldSnapshot>|undefined;
  const begin=(floor:Version)=>{
    const job=Promise.resolve().then(load).then(value=>{
      if(!reaches(value,floor))throw new Error("The snapshot did not reach its observed database version.");
      cached={value,at:now()};return value;
    }).finally(()=>{if(flight===job)flight=undefined;});
    flight=job;return job;
  };
  const answer=(value:WorldSnapshot,head:SnapshotHead)=>structuredClone(same(value,head)?{...head,pixels:value.pixels}:value);
  return async()=>{
    const head=await readHead();
    if(!valid(head))throw new Error("The snapshot header is invalid.");
    const age=cached?now()-cached.at:Infinity;
    if(cached&&age>=0&&age<MAX_PIXEL_CACHE_AGE_MS&&reaches(cached.value,head))return answer(cached.value,head);
    // One pre-existing flight can have started before this caller's head read.
    // Any subsequent primary-database load starts after its freshness floor.
    for(let attempt=0;attempt<2;attempt++){
      const value=await(flight??begin(head));
      if(reaches(value,head))return answer(value,head);
    }
    throw new Error("The snapshot could not reach its observed database version.");
  };
}
