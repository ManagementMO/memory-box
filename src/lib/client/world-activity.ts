import type {WorldSnapshot} from "../types";
import {memorySize} from "../scenes";
import {GRID_SIZE} from "../world-bounds";
import {STROKE_TTL_MS,type LivePeer} from "./presence-state";
import {geographicPlaceId,type WorldArea} from "./world-atlas";

export const ACTIVITY_TTL_MS=12000;
export interface PlaceSignal {
  id:string;areaId:string;x:number;y:number;
  kind:"memory"|"paint"|"painting";expiresAt:number;memoryId?:string;painters?:number;
}

/** A baseline snapshot is history. Only accepted later revisions can be new. */
export function activityChanges(previous:WorldSnapshot|null,next:WorldSnapshot,areas:readonly WorldArea[],now:number):PlaceSignal[]{
  if(!previous||previous.worldId!==next.worldId||previous.epoch!==next.epoch||next.revision<=previous.revision)return [];
  const places=new Map(areas.map(area=>[area.id,area])),changes=new Map<string,PlaceSignal>();
  for(const pixel of next.pixels){
    if(!Number.isSafeInteger(pixel.revision)||pixel.revision!<=previous.revision||pixel.revision!>next.revision)continue;
    const point={x:pixel.x*GRID_SIZE+GRID_SIZE/2,y:pixel.y*GRID_SIZE+GRID_SIZE/2},areaId=geographicPlaceId(point);
    if(!places.has(areaId)||changes.has(areaId))continue;
    changes.set(areaId,{id:`paint:${areaId}:${next.revision}`,areaId,...point,kind:"paint",expiresAt:now+ACTIVITY_TTL_MS});
  }
  const known=new Map(previous.memories.map(memory=>[memory.id,memory.version]));
  const memoryAreas=new Map(areas.flatMap(area=>area.memoryIds.map(id=>[id,area.id] as const)));
  const changed=next.memories.filter(memory=>!memory.isSeed&&known.get(memory.id)!==memory.version).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
  for(const memory of changed){
    const areaId=memoryAreas.get(memory.id);if(!areaId)continue;
    const size=memorySize(memory);
    changes.set(areaId,{id:`memory:${memory.id}:${memory.version}`,areaId,x:memory.x+size.width/2,y:memory.y+size.height/2,kind:"memory",memoryId:memory.id,expiresAt:now+ACTIVITY_TTL_MS});
  }
  return [...changes.values()].slice(-24);
}

export function placeSignals(changes:readonly PlaceSignal[],peers:readonly LivePeer[],areas:readonly WorldArea[],now:number):PlaceSignal[]{
  const places=new Map(areas.map(area=>[area.id,area])),signals=new Map<string,PlaceSignal>();
  for(const signal of [...changes].sort((a,b)=>a.expiresAt-b.expiresAt)){
    const area=places.get(signal.areaId);
    if(!area||signal.expiresAt<=now||signal.expiresAt>now+ACTIVITY_TTL_MS||signal.memoryId&&!area.memoryIds.includes(signal.memoryId))continue;
    signals.set(signal.areaId,signal);
  }
  const seen=new Set<string>();
  for(const peer of peers){
    if(seen.has(peer.sessionId)||peer.tool!=="paint"||!peer.stroke?.length||peer.updatedAt>now||now-peer.updatedAt>=STROKE_TTL_MS)continue;
    seen.add(peer.sessionId);
    const cell=peer.stroke[peer.stroke.length-1],point={x:cell.x*GRID_SIZE+GRID_SIZE/2,y:cell.y*GRID_SIZE+GRID_SIZE/2};
    const areaId=geographicPlaceId(point);if(!places.has(areaId))continue;
    const previous=signals.get(areaId);
    signals.set(areaId,{id:`painting:${areaId}`,areaId,...point,kind:"painting",painters:(previous?.kind==="painting"?previous.painters??0:0)+1,expiresAt:Math.max(peer.updatedAt+STROKE_TTL_MS,previous?.kind==="painting"?previous.expiresAt:0)});
  }
  return [...signals.values()].sort((a,b)=>Number(b.kind==="painting")-Number(a.kind==="painting")||b.expiresAt-a.expiresAt||a.areaId.localeCompare(b.areaId)).slice(0,6);
}

export const signalDescription=(signal:PlaceSignal)=>signal.kind==="painting"?signal.painters&&signal.painters>1?`${signal.painters} painting`:"Painting":signal.kind==="memory"?"New original":"New pixels";
