import {describe,expect,it} from "vitest";
import type {Memory,WorldSnapshot} from "../src/lib/types";
import type {LivePeer} from "../src/lib/client/presence-state";
import {worldAreas} from "../src/lib/client/world-atlas";
import {activityChanges,placeSignals} from "../src/lib/client/world-activity";

const memory=(id:string,x=8000):Memory=>({id,authorId:null,authorName:"Visitor",type:"text",title:"Moon lake",body:"Bring a cheese boat.",url:null,imageUrl:null,color:"#FFE9AF",x,y:3000,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:false});
const world=(changes:Partial<WorldSnapshot>={}):WorldSnapshot=>({worldId:"commons",revision:10,epoch:1,width:1200,height:720,gridSize:6,paintingPaused:false,memories:[memory("a")],pixels:[],events:[],...changes});
const painter=(changes:Partial<LivePeer>={}):LivePeer=>({sessionId:"peer",name:"Visitor",x:8100,y:3050,tool:"paint",stroke:[{x:1350,y:508,color:"#123456"}],color:"#8760BB",updatedAt:10000,...changes});

describe("actual spatial activity",()=>{
  it("keeps initial history, unchanged polls, old revisions and epoch/world changes quiet",()=>{
    const initial=world(),areas=worldAreas(initial.memories,[]);
    expect(activityChanges(null,initial,areas,10000)).toEqual([]);
    for(const next of [initial,{...initial,revision:9},{...initial,revision:11,epoch:2},{...initial,revision:11,worldId:"other"}])expect(activityChanges(initial,next,areas,10000)).toEqual([]);
  });
  it("marks a real new original at its own location, and its later actual edit",()=>{
    const before=world(),next=world({revision:11,memories:[...before.memories,memory("b",12000)]}),areas=worldAreas(next.memories,[]);
    const changes=activityChanges(before,next,areas,10000);
    expect(changes).toHaveLength(1);expect(changes[0]).toMatchObject({kind:"memory",memoryId:"b",expiresAt:22000});
    expect(changes[0].x).toBeGreaterThanOrEqual(12000);expect(changes[0].x).toBeLessThan(12210);
    expect(changes[0].areaId).toBe("place:6:2");
    const edited={...next,revision:12,memories:next.memories.map(m=>m.id==="b"?{...m,version:2}:m)};
    expect(activityChanges(next,edited,areas,11000)[0]).toMatchObject({memoryId:"b",expiresAt:23000});
  });
  it("never turns new starter data or an indexing-only refresh into a new original",()=>{
    const before=world(),next=world({revision:11,memories:[...before.memories,{...memory("seed"),isSeed:true}]});
    expect(activityChanges(before,next,worldAreas(next.memories,[]),10000)).toEqual([]);
    expect(activityChanges(before,{...before,revision:11,memories:before.memories.map(m=>({...m,indexStatus:"pending" as const}))},worldAreas(before.memories,[]),10000)).toEqual([]);
  });
  it("uses accepted cell revisions and actual grid coordinates for new-pixel destinations",()=>{
    const before=world(),next=world({revision:12,pixels:[{x:1000,y:-500,color:"#123456",revision:11},{x:1001,y:-500,color:"#FFFFFF",revision:9}]});
    const changes=activityChanges(before,next,worldAreas(next.memories,next.pixels),10000);
    expect(changes).toHaveLength(1);expect(changes[0]).toMatchObject({kind:"paint",x:6003,y:-2997,expiresAt:22000});
    expect(activityChanges(next,{...next,revision:13},worldAreas(next.memories,next.pixels),11000)).toEqual([]);
  });
  it("requires a fresh real stroke for Painting and drops it at its actual expiry",()=>{
    const data=world(),areas=worldAreas(data.memories,[]);
    expect(placeSignals([], [painter()],areas,10000)[0]).toMatchObject({kind:"painting",painters:1,x:8100,y:3050});
    for(const peer of [painter({stroke:[]}),painter({tool:"wander"}),painter({updatedAt:12001}),painter({updatedAt:8000})])expect(placeSignals([],[peer],areas,10000)).toEqual([]);
    expect(placeSignals([],[painter()],areas,12000)).toEqual([]);
  });
  it("counts current painters once per place and prefers that live destination over a recent original",()=>{
    const before=world({memories:[]}),next=world({revision:11}),areas=worldAreas(next.memories,[]),changes=activityChanges(before,next,areas,10000);
    const signals=placeSignals(changes,[painter(),painter({sessionId:"other",x:8150})],areas,10000);
    expect(signals).toHaveLength(1);expect(signals[0]).toMatchObject({kind:"painting",painters:2});
  });
  it("expires recent markers, rejects withdrawn sources and bounds the visible places to six",()=>{
    const before=world({memories:[]}),next=world({revision:11,memories:Array.from({length:9},(_,i)=>memory(`m${i}`,6000+i*2200))}),areas=worldAreas(next.memories,[]);
    const changes=activityChanges(before,next,areas,10000);
    expect(placeSignals(changes,[],areas,10000)).toHaveLength(6);
    expect(placeSignals(changes,[],areas,22000)).toEqual([]);
    expect(placeSignals(changes,[],worldAreas([],[]),10000)).toEqual([]);
    const stillOccupied=areas.map(area=>({...area,memoryIds:[]}));
    expect(placeSignals(changes,[],stillOccupied,10000)).toEqual([]);
  });
});
