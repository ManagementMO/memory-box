import { describe, expect, it } from "vitest";
import type { Memory, Pixel } from "../src/lib/types";
import { areaAtPoint, atlasArrivalBounds, chooseWorldStory, newPlaceGround, worldAreas } from "../src/lib/client/world-atlas";
import { WORLD_MAX, WORLD_MIN } from "../src/lib/world-bounds";

const original = (id:string,x:number,y:number,changes:Partial<Memory>={}):Memory => ({
  id,x,y,title:id,body:"An actual contribution",authorId:"visitor",authorName:"Visitor",type:"text",url:null,imageUrl:null,
  sceneId:"mixtape",color:"#FFD3E3",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:false,...changes,
});

describe("a world of real places",()=>{
  it("does not invent occupied places in an empty world",()=>expect(worldAreas([],[])).toEqual([]));
  it("assigns every original and pixel once without moving authored coordinates",()=>{
    const memories=[original("campus",4300,220),original("tape",560,320),original("cat",-510,310),original("far",-25000,19000)];
    const pixels:Pixel[]=[{x:720,y:50,color:"#FFFFFF"},{x:-4200,y:3200,color:"#E4D8FB"},{x:9900,y:-9900,color:"#FFED9C"}];
    const before=structuredClone({memories,pixels}),areas=worldAreas(memories,pixels);
    expect(areas.flatMap(a=>a.memoryIds).sort()).toEqual(memories.map(m=>m.id).sort());
    expect(areas.reduce((sum,a)=>sum+a.pixelCount,0)).toBe(pixels.length);
    expect({memories,pixels}).toEqual(before);
    expect(areas.find(a=>a.id==="waterloo")?.title).toBe("Waterloo");
    expect(areas.every(a=>a.width<4000&&a.height<4000)).toBe(true);
  });
  it("keeps a distant place named by its actual oldest original, even after invitation closure",()=>{
    const root=original("root",-25000,19000,{title:"Moon lake",isBuildInvitation:true});
    const child=original("reply",-24800,19100,{title:"A boat",inspiredBy:"root",createdAt:"2026-10-22T13:00:00Z"});
    const area=worldAreas([child,root],[])[0];
    expect(area.title).toBe("Moon lake");expect(area.sourceId).toBe("root");expect(area.openBuilds).toBe(1);
    const closed=worldAreas([{...root,isBuildInvitation:false},child],[])[0];
    expect(closed.id).toBe(area.id);expect(closed.title).toBe(area.title);expect(closed.openBuilds).toBe(0);
    expect(areaAtPoint([area],{x:root.x+100,y:root.y+50})?.id).toBe(area.id);
    expect(areaAtPoint([area],{x:0,y:0})).toBeNull();
  });
  it("keeps surviving artwork discoverable after the last original disappears",()=>{
    const pixels=[{x:-4100,y:3200,color:"#E4D8FB"}];
    const areas=worldAreas([],pixels);
    expect(areas).toHaveLength(1);expect(areas[0].pixelCount).toBe(1);expect(areas[0].memoryIds).toEqual([]);
    expect(areas[0].sourceId).toBeUndefined();expect(areas[0].title).toBe("Pixel clearing");
  });
  it("finds bounded open ground without landing on existing art, at both world extremes",()=>{
    for(const anchor of [{x:4300,y:240},{x:WORLD_MIN,y:WORLD_MIN},{x:WORLD_MAX,y:WORLD_MAX}]){
      const memories=[original("existing",anchor.x-100,anchor.y-50)];
      const pixels=[{x:Math.floor(anchor.x/6),y:Math.floor(anchor.y/6),color:"#FFFFFF"}];
      const areas=worldAreas(memories,pixels),point=newPlaceGround(areas,memories,pixels,anchor)!;
      expect(point).not.toBeNull();expect(point.x).toBeGreaterThanOrEqual(WORLD_MIN);expect(point.y).toBeGreaterThanOrEqual(WORLD_MIN);
      expect(point.x+point.width!).toBeLessThanOrEqual(WORLD_MAX+1);expect(point.y+point.height!).toBeLessThanOrEqual(WORLD_MAX+1);
      expect(areas.every(a=>point.x>=a.x+a.width+80||point.x+point.width!<=a.x-80||point.y>=a.y+a.height+80||point.y+point.height!<=a.y-80)).toBe(true);
    }
  });
  it("does not send a visitor to hidden occupied ground or beyond a fully occupied plane",()=>{
    const occupied={id:"all",title:"Occupied",x:WORLD_MIN,y:WORLD_MIN,width:120000,height:120000,memoryIds:[],pixelCount:1,openBuilds:0,color:"#E4D8FB",emblem:"flag" as const};
    expect(newPlaceGround([occupied],[],[],{x:0,y:0})).toBeNull();
  });
  it("starts a distinct place, rather than renaming an occupied geographic cell",()=>{
    const memories=[original("existing",4300,220)];const areas=worldAreas(memories,[]);
    const ground=newPlaceGround(areas,memories,[],{x:4300,y:240})!;
    const created=original("new",ground.x+200,ground.y+180,{title:"New place",isBuildInvitation:true});
    const after=worldAreas([...memories,created],[]),place=after.find(a=>a.memoryIds.includes(created.id))!;
    expect(place.id).toMatch(/^place:/);expect(place.title).toBe("New place");expect(place.memoryIds).toEqual([created.id]);
  });
  it("gives another place a turn before repeating stories in a dense neighborhood",()=>{
    const memories=[...Array.from({length:100},(_,i)=>original(`dense-${i}`,400+i,300)),original("remote",28000,24000)];
    const areas=worldAreas(memories,[]);
    const next=chooseWorldStory(memories,areas,[],"dense-0",()=>0);
    expect(next?.id).toBe("remote");
    const unseen=chooseWorldStory(memories,areas,["remote","dense-0"],"remote",()=>0);
    expect(unseen?.id).not.toBe("remote");expect(unseen?.id).not.toBe("dense-0");
    expect(chooseWorldStory([],[],[],null)).toBeNull();
  });
  it("preserves community-first discovery before falling back to fictional starters",()=>{
    const seed=original("starter",-500,300,{isSeed:true});const community=original("visitor",28000,24000);
    const memories=[seed,community],areas=worldAreas(memories,[]);
    expect(chooseWorldStory(memories,areas,[],null,()=>0)?.id).toBe(community.id);
    expect(chooseWorldStory(memories,areas,[community.id],community.id,()=>0)?.id).toBe(seed.id);
  });
  it("arrives with whole nearby places in view, without letting an extreme outlier empty the welcome",()=>{
    const core=[original("a",-650,-600),original("b",560,320),original("c",5200,800)];
    const areas=worldAreas(core,[]),bounds=atlasArrivalBounds(areas)!;
    expect(areas.every(a=>a.x>=bounds.x&&a.y>=bounds.y&&a.x+a.width<=bounds.x+bounds.width!&&a.y+a.height<=bounds.y+bounds.height!)).toBe(true);
    const extended=atlasArrivalBounds(worldAreas([...core,original("outlier",59900,59900)],[]))!;
    expect(extended.width).toBeLessThan(16000);expect(extended.height).toBeLessThan(12000);
    expect(atlasArrivalBounds([])).toBeNull();
  });
});
