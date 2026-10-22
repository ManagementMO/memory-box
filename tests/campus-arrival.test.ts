import { describe,expect,it } from "vitest";
import { campusArrival } from "../src/lib/client/campus-arrival";
import { WATERLOO_ARRIVAL } from "../src/lib/waterloo-landmarks";
import { frameCamera,occupiedBounds } from "../src/lib/client/canvas-geometry";

describe("persisted campus arrival",()=>{
  it("falls back when the import anchor is absent, withdrawn or not labeled a starter",()=>{
    expect(campusArrival([])).toBeNull();
    expect(campusArrival([{id:WATERLOO_ARRIVAL.anchorMemoryId,isSeed:false}])).toBeNull();
    expect(campusArrival([{id:"another-original",isSeed:true}])).toBeNull();
  });
  it("frames the actual campus neighborhood without dropping older world content",()=>{
    const arrival=campusArrival([{id:WATERLOO_ARRIVAL.anchorMemoryId,isSeed:true}])!;
    const camera=frameCamera([arrival],{width:390,height:739},{padding:24});
    expect(camera.z).toBeGreaterThan(.1);
    expect(camera.x+arrival.x*camera.z).toBeGreaterThanOrEqual(23.9);
    expect(occupiedBounds([arrival,{x:-600,y:-630,width:200,height:110}],[])!.x).toBe(-600);
  });
});
