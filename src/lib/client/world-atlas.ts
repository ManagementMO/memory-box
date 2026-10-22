import type { Memory, Pixel } from "../types";
import { memorySize } from "../scenes";
import { GRID_SIZE, WORLD_MAX, WORLD_MIN } from "../world-bounds";
import type { FramePoint, Point } from "./canvas-geometry";
import { occupiedBounds } from "./canvas-geometry";
import { originalLabel } from "./memory-presentation";
import { intersects, spatialIndex, type WorldRect } from "./spatial-index";

export type AreaEmblem="goose"|"tape"|"cat"|"bread"|"train"|"soup"|"spark"|"flag";
export interface WorldArea extends WorldRect {
  id:string; title:string; color:string; emblem:AreaEmblem;
  memoryIds:string[]; pixelCount:number; openBuilds:number; sourceId?:string;
}
const LANDMARKS=[
  {id:"waterloo",title:"Waterloo",x:4300,y:300,reach:1700,color:"#FFE5AC",emblem:"goose"},
  {id:"commons",title:"The mixtape commons",x:560,y:350,reach:620,color:"#E9DDF9",emblem:"tape"},
  {id:"cat",title:"Cat country",x:-400,y:350,reach:620,color:"#FFDDE7",emblem:"cat"},
  {id:"bread",title:"The bread bus",x:1650,y:-100,reach:620,color:"#FFE4CB",emblem:"bread"},
  {id:"train",title:"The night train",x:1660,y:750,reach:620,color:"#DCEBFB",emblem:"train"},
  {id:"soup",title:"Soup, eventually",x:-300,y:1120,reach:620,color:"#FFECC1",emblem:"soup"},
  {id:"bag-goose",title:"Off to somewhere",x:820,y:-400,reach:620,color:"#E7E1FC",emblem:"spark"},
] as const;
const PLACE_WIDTH=1800,PLACE_HEIGHT=1500;
const COLORS=["#E9DDF9","#FFDDE7","#DCEBFB","#FFE4CB","#FFECC1"];
const coordinateKey=(p:Point)=>`place:${Math.floor(p.x/PLACE_WIDTH)}:${Math.floor(p.y/PLACE_HEIGHT)}`;

function region(p:Point){
  let nearest:typeof LANDMARKS[number]|undefined,distance=Infinity;
  for(const landmark of LANDMARKS){const d=Math.hypot(landmark.x-p.x,landmark.y-p.y);if(d<=landmark.reach&&d<distance){nearest=landmark;distance=d;}}
  return nearest?.id??coordinateKey(p);
}

/** Places describe geographic occupancy, never an AI-imposed topic or group. */
export function worldAreas(memories:readonly Memory[],pixels:readonly Pixel[]):WorldArea[]{
  const groups=new Map<string,{memories:Memory[];count:number;left:number;top:number;right:number;bottom:number}>();
  const include=(key:string,r:WorldRect,memory?:Memory)=>{
    let group=groups.get(key);if(!group){group={memories:[],count:0,left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};groups.set(key,group);}
    group.left=Math.min(group.left,r.x);group.top=Math.min(group.top,r.y);group.right=Math.max(group.right,r.x+r.width);group.bottom=Math.max(group.bottom,r.y+r.height);
    if(memory)group.memories.push(memory);else group.count++;
  };
  for(const m of memories){const size=memorySize(m);include(region({x:m.x+size.width/2,y:m.y+size.height/2}),{...m,...size},m);}
  for(const p of pixels){const x=p.x*GRID_SIZE,y=p.y*GRID_SIZE;include(region({x:x+GRID_SIZE/2,y:y+GRID_SIZE/2}),{x,y,width:GRID_SIZE,height:GRID_SIZE});}
  return [...groups].map(([id,g]):WorldArea=>{
    const landmark=LANDMARKS.find(l=>l.id===id);
    const ordered=[...g.memories].sort((a,b)=>Number(!!a.inspiredBy)-Number(!!b.inspiredBy)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    const source=ordered[0];
    const tint=COLORS[Math.abs(id.split("").reduce((hash,char)=>(hash*31+char.charCodeAt(0))|0,0))%COLORS.length];
    const padding=90;
    const x=Math.max(WORLD_MIN,g.left-padding),y=Math.max(WORLD_MIN,g.top-padding);
    return {id,title:landmark?.title??(source?originalLabel(source):"Pixel clearing"),color:landmark?.color??tint,emblem:landmark?.emblem??"flag",
      x,y,width:Math.min(WORLD_MAX+1,g.right+padding)-x,height:Math.min(WORLD_MAX+1,g.bottom+padding)-y,
      memoryIds:g.memories.map(m=>m.id),pixelCount:g.count,openBuilds:g.memories.filter(m=>m.isBuildInvitation).length,...(source?{sourceId:source.id}:{})};
  }).sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
}

export function areaAtPoint(areas:readonly WorldArea[],p:Point):WorldArea|null{
  const candidates=areas.filter(a=>p.x>=a.x-80&&p.x<=a.x+a.width+80&&p.y>=a.y-80&&p.y<=a.y+a.height+80);
  return candidates.sort((a,b)=>Math.hypot(p.x-a.x-a.width/2,p.y-a.y-a.height/2)-Math.hypot(p.x-b.x-b.width/2,p.y-b.y-b.height/2))[0]??null;
}

/** Show complete nearby places. A legal mark at the world edge cannot turn
 * the first view into 120,000 units of empty space. The atlas still includes it. */
export function atlasArrivalBounds(areas:readonly WorldArea[]):FramePoint|null{
  const hull=occupiedBounds([...areas],[]);if(!hull)return null;
  if(hull.width!<=12000&&hull.height!<=9000)return hull;
  const weight=(a:WorldArea)=>a.memoryIds.length*300+a.pixelCount;
  const main=areas.reduce((best,a)=>weight(a)>weight(best)?a:best);
  const center={x:main.x+main.width/2,y:main.y+main.height/2};
  return occupiedBounds(areas.filter(a=>Math.abs(a.x+a.width/2-center.x)<6000&&Math.abs(a.y+a.height/2-center.y)<4500),[])??hull;
}

/** Bounded search over geographic cells; this is a camera suggestion, no write. */
export function newPlaceGround(areas:readonly WorldArea[],memories:readonly Memory[],pixels:readonly Pixel[],anchor:Point):FramePoint|null{
  const occupied=[...areas.map(a=>({x:a.x-80,y:a.y-80,width:a.width+160,height:a.height+160})),...memories.map(m=>({...m,...memorySize(m)})),...pixels.map(p=>({x:p.x*GRID_SIZE,y:p.y*GRID_SIZE,width:GRID_SIZE,height:GRID_SIZE}))];
  const index=spatialIndex(occupied,item=>item,1800);
  const cx=Math.floor((Number.isFinite(anchor.x)?anchor.x:0)/PLACE_WIDTH),cy=Math.floor((Number.isFinite(anchor.y)?anchor.y:0)/PLACE_HEIGHT);
  for(let radius=0;radius<=80;radius++){
    const candidates:{point:WorldRect;cell:WorldRect}[]=[];
    const visit=(dx:number,dy:number)=>{
      const x=(cx+dx)*PLACE_WIDTH+PLACE_WIDTH/2-300,y=(cy+dy)*PLACE_HEIGHT+PLACE_HEIGHT/2-240;
      if(x<WORLD_MIN||y<WORLD_MIN||x+600>WORLD_MAX+1||y+480>WORLD_MAX+1)return;
      const point={x,y,width:600,height:480};
      // A new place must remain outside a named landmark's territory and its
      // entire geographic cell must be empty, not merely the visible clearing.
      const key=coordinateKey({x:x+300,y:y+240});
      if([[0,0],[600,0],[0,480],[600,480],[300,240]].some(([dx,dy])=>region({x:x+dx,y:y+dy})!==key))return;
      candidates.push({point,cell:{x:(cx+dx)*PLACE_WIDTH,y:(cy+dy)*PLACE_HEIGHT,width:PLACE_WIDTH,height:PLACE_HEIGHT}});
    };
    for(let offset=-radius;offset<=radius;offset++){visit(offset,-radius);if(radius)visit(offset,radius);}
    for(let offset=-radius+1;offset<radius;offset++){visit(-radius,offset);visit(radius,offset);}
    candidates.sort((a,b)=>Math.hypot(a.point.x+300-anchor.x,a.point.y+240-anchor.y)-Math.hypot(b.point.x+300-anchor.x,b.point.y+240-anchor.y));
    const empty=candidates.find(({cell})=>!index.query(cell).some(item=>intersects(item,cell)));if(empty)return empty.point;
  }
  return null;
}

/** Each occupied place gets a turn; a dense place cannot drown out a small one. */
export function chooseWorldStory(memories:readonly Memory[],areas:readonly WorldArea[],visited:readonly string[],current:string|null,random:()=>number=Math.random):Memory|null{
  if(!memories.length)return null;
  const seen=new Set(visited),unseen=memories.filter(m=>m.id!==current&&!seen.has(m.id));
  const availableMemories=unseen.length?unseen:memories.filter(m=>m.id!==current);
  const contributed=availableMemories.filter(m=>!m.isSeed),pool=contributed.length?contributed:availableMemories;
  if(!pool.length)return memories[0];
  const ids=new Set(pool.map(m=>m.id)),currentArea=areas.find(a=>a.id===current||a.memoryIds.includes(current??""));
  const available=areas.map(area=>({area,ids:area.memoryIds.filter(id=>ids.has(id))})).filter(group=>group.ids.length);
  const elsewhere=available.filter(g=>g.area.id!==currentArea?.id),choices=elsewhere.length?elsewhere:available;
  const pick=<T,>(items:readonly T[])=>items[Math.max(0,Math.min(items.length-1,Math.floor(random()*items.length)))];
  if(!choices.length)return pick(pool);
  const id=pick(pick(choices).ids);return pool.find(m=>m.id===id)??null;
}
