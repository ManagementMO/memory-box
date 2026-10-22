import { describe, expect, it } from "vitest";
import { SHAPES, shapePixels, suggestedSpot, type ShapeId } from "../src/lib/scenes";
import type { Memory } from "../src/lib/types";

describe("sparse world placement", () => {
  it("keeps every playful stamp inside one durable paint operation", () => {
    for(const shape of Object.keys(SHAPES) as ShapeId[]) {
      const cells=shapePixels(shape,"#BDA9E9",-120,480);
      expect(cells.length).toBeGreaterThan(0);expect(cells.length).toBeLessThanOrEqual(144);
      expect(new Set(cells.map(c=>`${c.x},${c.y}`)).size).toBe(cells.length);
      expect(cells.every(c=>/^#[0-9A-F]{6}$/.test(c.color))).toBe(true);
    }
  });
  it("lets stamps cross the former board edges and appear at negative coordinates", () => {
    expect(shapePixels("pixel", "#FFFFFF", -6, -12)).toEqual([{x:-1,y:-2,color:"#FFFFFF"}]);
    expect(shapePixels("pixel", "#FFFFFF", 1200, 720)).toEqual([{x:200,y:120,color:"#FFFFFF"}]);
    expect(shapePixels("heart", "#FFFFFF", 3000, -3000).length).toBeGreaterThan(20);
  });
  it("never emits out-of-plane cells even for a stamp placed at the true pilot edge", () => {
    for (const point of [{x:-60000,y:-60000},{x:59994,y:59994}]) {
      const pixels=shapePixels("speaker", "#FFFFFF", point.x, point.y);
      expect(pixels.length).toBeGreaterThan(0);
      expect(pixels.every(pixel=>pixel.x>=-10000&&pixel.x<=9999&&pixel.y>=-10000&&pixel.y<=9999)).toBe(true);
    }
  });
  it("suggests a local free place beside a distant parent without scanning the whole plane", () => {
    const parent={id:"parent",type:"text",x:-4200,y:3600,sceneId:"pond"} as Memory;
    const point=suggestedSpot([parent],"pond","text",parent);
    expect(Math.hypot(point.x-parent.x,point.y-parent.y)).toBeLessThan(500);
    expect(point.x<parent.x+205+12&&point.x+205+12>parent.x&&point.y<parent.y+110+12&&point.y+110+12>parent.y).toBe(false);
  });
  it("uses the visible camera anchor for an unrelated new memory away from the entry area", () => {
    const point=suggestedSpot([],"garden","image",undefined,{x:12000,y:-9000});
    expect(Math.hypot(point.x-12000,point.y+9000)).toBeLessThan(300);
    const edge=suggestedSpot([],"garden","image",undefined,{x:59999,y:59999});
    expect(edge.x+142).toBeLessThanOrEqual(60000);
    expect(edge.y+161).toBeLessThanOrEqual(60000);
  });
});
