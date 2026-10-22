import { describe, expect, it } from "vitest";
import { canvasLevel, initialCampusCamera, presetCamera } from "../src/lib/client/canvas-levels";
import { screenToWorld } from "../src/lib/client/canvas-geometry";
import { WATERLOO_ARRIVAL } from "../src/lib/waterloo-landmarks";

describe("three distances in one shared place", () => {
  it.each([{width:1440,height:784},{width:390,height:739},{width:320,height:635}])("preserves the world center across all three presets at $width px", viewport => {
    let camera = {x:-2740,y:811,z:.73};
    const middle = {x:viewport.width/2,y:viewport.height/2};
    const origin = screenToWorld(camera,middle);
    const scales: number[]=[];
    for(const level of ["whole","wander","close"] as const){
      camera=presetCamera(camera,viewport,level);scales.push(camera.z);
      expect(screenToWorld(camera,middle).x).toBeCloseTo(origin.x,8);
      expect(screenToWorld(camera,middle).y).toBeCloseTo(origin.y,8);
      expect(canvasLevel(camera.z)).toBe(level);
    }
    expect(scales[2]).toBeGreaterThan(scales[1]*1.5);
    expect(scales[1]).toBeGreaterThan(scales[0]*1.5);
  });
  it("starts a narrow campus visit close enough to see the shared drawing without inventing an absent campus",()=>{
    const viewport={width:390,height:739};
    expect(initialCampusCamera([],viewport)).toBeNull();
    expect(initialCampusCamera([{id:WATERLOO_ARRIVAL.anchorMemoryId,isSeed:false}],viewport)).toBeNull();
    const camera=initialCampusCamera([{id:WATERLOO_ARRIVAL.anchorMemoryId,isSeed:true}],viewport)!;
    expect(camera.z).toBeGreaterThan(.65);
    const gooseHead={x:4190*camera.z+camera.x,y:180*camera.z+camera.y};
    expect(gooseHead.x).toBeGreaterThan(35);expect(gooseHead.x).toBeLessThan(355);
    expect(gooseHead.y).toBeGreaterThan(100);expect(gooseHead.y).toBeLessThan(500);
  });
  it("tracks manually zoomed cameras as well as preset buttons",()=>{
    expect(canvasLevel(.08)).toBe("whole");expect(canvasLevel(.5)).toBe("whole");
    expect(canvasLevel(.72)).toBe("wander");expect(canvasLevel(1.1)).toBe("wander");
    expect(canvasLevel(1.7)).toBe("close");expect(canvasLevel(6)).toBe("close");
  });
});
