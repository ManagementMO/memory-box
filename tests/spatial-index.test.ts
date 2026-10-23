import { describe, expect, it } from "vitest";
import { spatialIndex } from "../src/lib/client/spatial-index";

describe("sparse world queries",()=>{
  it("returns edge-touching signed objects once, retaining the original references",()=>{
    const items=[{x:-520,y:-520,width:530,height:530,id:"across"},{x:10,y:10,width:6,height:6,id:"edge"},{x:59000,y:59000,width:6,height:6,id:"far"}];
    const index=spatialIndex(items,item=>item,256),near=index.query({x:-1,y:-1,width:11,height:11});
    expect(new Set(near.map(i=>i.id))).toEqual(new Set(["across","edge"]));expect(near).toHaveLength(2);
    expect(near.find(i=>i.id==="across")).toBe(items[0]);
  });
  it("selects only local pixels out of a widely scattered field and handles full-world queries",()=>{
    const items=Array.from({length:10000},(_,i)=>({x:(i%100)*1100-55000,y:Math.floor(i/100)*1100-55000,width:6,height:6}));
    const index=spatialIndex(items,item=>item,256);
    expect(index.query({x:-55001,y:-55001,width:8,height:8})).toEqual([items[0]]);
    expect(index.query({x:-60000,y:-60000,width:120000,height:120000})).toHaveLength(10000);
    expect(index.query({x:100,y:100,width:10,height:10})).toEqual([]);
  });
  it("does not allocate a world-sized bucket grid for one huge rectangle",()=>{
    const huge={x:-60000,y:-60000,width:120000,height:120000};
    const index=spatialIndex([huge],item=>item,64);
    expect(index.query({x:-2,y:-2,width:4,height:4})).toEqual([huge]);
  });
  it("stops an occupancy query at its first hit without scanning the rest of a dense world",()=>{
    let reads=0;const items=Array.from({length:10000},(_,i)=>({x:i%100,y:Math.floor(i/100),width:1,height:1}));
    const index=spatialIndex(items,item=>{reads++;return item;},32);reads=0;
    expect(index.query({x:0,y:0,width:120000,height:120000},1)).toEqual([items[0]]);expect(reads).toBe(1);
    expect(index.query({x:0,y:0,width:120000,height:120000},0)).toEqual([]);
  });
});
