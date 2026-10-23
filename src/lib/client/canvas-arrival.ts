import type {Memory,WorldSnapshot} from "../types";
import {memorySize} from "../scenes";
import {frameCamera,type Camera} from "./canvas-geometry";
import {atlasArrivalBounds,type WorldArea} from "./world-atlas";
import {sharedPlaceCamera,sharedPlaceFromCamera} from "./shared-place";

type Viewport={width:number;height:number};
type Scope=Pick<WorldSnapshot,"worldId"|"epoch">;
export const CANVAS_VIEW_KEY="memory-box:canvas-view:v1";

/** Arrival is a view of stored work; neither geography nor originals move. */
export function initialWorldCamera(world:WorldSnapshot,areas:readonly WorldArea[],viewport:Viewport):Camera{
  if(viewport.width>700)return frameCamera([atlasArrivalBounds(areas)??{x:0,y:0,width:1200,height:720}],viewport,{padding:64,maxZoom:.4});
  const byId=new Map(world.memories.map(memory=>[memory.id,memory]));
  const members=(area:WorldArea)=>area.memoryIds.map(id=>byId.get(id)).filter((m):m is Memory=>!!m);
  const meaningful=(memory:Memory)=>!!(memory.title.trim()||memory.body.trim());
  const contributed=(memories:Memory[])=>memories.filter(memory=>!memory.isSeed&&meaningful(memory)).length;
  const ranked=areas.map(area=>({area,memories:members(area)})).sort((a,b)=>
    Number(contributed(b.memories)>0)-Number(contributed(a.memories)>0)
    ||contributed(b.memories)-contributed(a.memories)
    ||b.memories.length-a.memories.length||b.area.pixelCount-a.area.pixelCount||a.area.id.localeCompare(b.area.id));
  const place=ranked[0];
  const anchor=place?.memories.sort((a,b)=>Number(meaningful(b))-Number(meaningful(a))||Number(a.isSeed)-Number(b.isSeed)||Number(!!a.inspiredBy)-Number(!!b.inspiredBy)||Number(!!b.isBuildInvitation)-Number(!!a.isBuildInvitation)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))[0];
  if(anchor){
    const size=memorySize(anchor),z=.78;
    return {x:viewport.width/2-(anchor.x+size.width/2)*z,y:viewport.height*.44-(anchor.y+size.height/2)*z,z};
  }
  if(place){const z=.74;return{x:viewport.width/2-(place.area.x+place.area.width/2)*z,y:viewport.height*.44-(place.area.y+place.area.height/2)*z,z};}
  return frameCamera([{x:0,y:0,width:1200,height:720}],viewport,{padding:35,maxZoom:.74});
}

/** Only public geography is saved; the record contains no session or query. */
export function encodeCanvasView(world:Scope,camera:Camera&Viewport):string|null{
  const place=sharedPlaceFromCamera(camera);if(!place)return null;
  return JSON.stringify({version:1,worldId:world.worldId,epoch:world.epoch,x:Number(place.x.toFixed(2)),y:Number(place.y.toFixed(2)),z:Number(place.z.toFixed(4))});
}

export function decodeCanvasView(raw:string|null,world:Scope,viewport:Viewport):Camera|null{
  if(!raw||raw.length>512)return null;
  try{
    const value=JSON.parse(raw);
    if(!value||Array.isArray(value)||value.version!==1||value.worldId!==world.worldId||value.epoch!==world.epoch)return null;
    return sharedPlaceCamera({x:value.x,y:value.y,z:value.z},viewport);
  }catch{return null;}
}
