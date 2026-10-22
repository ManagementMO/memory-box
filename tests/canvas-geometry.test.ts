import { describe, expect, it } from "vitest";
import { arrivalBounds, frameCamera, mergePaintCells, occupiedBounds, rasterLine, screenToWorld, storyCamera, zoomCameraAt } from "../src/lib/client/canvas-geometry";

describe("open-world camera", () => {
  it("converts viewport points to signed world coordinates", () => {
    expect(screenToWorld({ x: 200, y: 80, z: 2 }, { x: 0, y: 20 })).toEqual({ x: -100, y: -30 });
  });
  it("keeps the world point under the zoom anchor fixed", () => {
    const camera = { x: -450, y: 120, z: .6 }, point = { x: 290, y: 170 };
    expect(screenToWorld(zoomCameraAt(camera, 1.5, point), point)).toEqual(screenToWorld(camera, point));
  });
  it("frames distant signed originals without changing their coordinates", () => {
    const items = [{ x: -1200, y: -600, width: 200, height: 100 }, { x: 900, y: 300, width: 180, height: 160 }];
    const camera = frameCamera(items, { width: 1000, height: 650 }, { padding: 40, minZoom: .1, maxZoom: 1 });
    for (const item of items) {
      expect(item.x * camera.z + camera.x).toBeGreaterThanOrEqual(39.9);
      expect((item.x + item.width) * camera.z + camera.x).toBeLessThanOrEqual(960.1);
      expect(item.y * camera.z + camera.y).toBeGreaterThanOrEqual(39.9);
      expect((item.y + item.height) * camera.z + camera.y).toBeLessThanOrEqual(610.1);
    }
  });
  it("fits originals at opposite pilot edges in a mobile viewport", () => {
    const camera = frameCamera([{ x: -60000, y: -60000 }, { x: 59799, y: 59879 }], { width: 320, height: 480 });
    expect(camera.x - 60000 * camera.z).toBeGreaterThanOrEqual(39.9);
    expect(camera.x + 59999 * camera.z).toBeLessThanOrEqual(280.1);
    expect(camera.y - 60000 * camera.z).toBeGreaterThanOrEqual(39.9);
    expect(camera.y + 59999 * camera.z).toBeLessThanOrEqual(440.1);
    expect(zoomCameraAt(camera, 1.25, { x: 160, y: 240 }).z).toBeCloseTo(camera.z * 1.25);
  });
  it("frames authored fragments and pixel artwork together, including negative cells", () => {
    expect(occupiedBounds([{ x: 200, y: 100, width: 205, height: 110 }], [{ x: -40, y: -20, color: "#FFFFFF" }, { x: 150, y: 100, color: "#3659DB" }], 6)).toEqual({ x: -240, y: -120, width: 1146, height: 726 });
    expect(occupiedBounds([], [], 6)).toBeNull();
  });
  it("ignores invalid coordinates without losing other occupied content", () => {
    expect(occupiedBounds([{ x: NaN, y: 20 }, { x: 0, y: 0, width: 40, height: 20 }], [{ x: Infinity, y: 0, color: "#FFFFFF" }], 6)).toEqual({ x: 0, y: 0, width: 40, height: 20 });
  });
  it("keeps a selected mobile story above the bottom sheet", () => {
    const item = { x: 2600, y: -800, width: 205, height: 110 };
    const camera = storyCamera([item], { width: 390, height: 670 });
    expect(item.x * camera.z + camera.x).toBeGreaterThanOrEqual(27.9);
    expect((item.x + item.width) * camera.z + camera.x).toBeLessThanOrEqual(362.1);
    expect(item.y * camera.z + camera.y).toBeGreaterThanOrEqual(27.9);
    expect((item.y + item.height) * camera.z + camera.y).toBeLessThanOrEqual(280);
  });
  it("keeps a focused desktop original left of the floating reader at intermediate widths", () => {
    for(const width of [701,800,1024]) {
      const item={x:2600,y:-800,width:205,height:110};
      const camera=storyCamera([item],{width,height:650});
      expect(item.x*camera.z+camera.x).toBeGreaterThanOrEqual(27.9);
      expect((item.x+item.width)*camera.z+camera.x).toBeLessThan(width-355);
    }
  });
  it("arrives at the dense occupied core while the full hull still includes a distant contribution", () => {
    const core=Array.from({length:24},(_,i)=>({x:(i%6)*220,y:Math.floor(i/6)*150,width:205,height:110}));
    const pixels=[{x:9999,y:9999,color:"#FFFFFF"}];
    const arrival=arrivalBounds(core,pixels)!;
    expect(arrival.width).toBeLessThan(6000);expect(arrival.height).toBeLessThan(4500);
    expect(arrival.x).toBeLessThanOrEqual(0);
    expect(arrival.x+arrival.width!).toBeGreaterThanOrEqual(1305);
    expect(occupiedBounds(core,pixels)!.width).toBe(60000);
    expect(arrivalBounds([],[])).toBeNull();
  });
});

describe("staged shared paint", () => {
  it("fills gaps between pointer samples, including negative cells", () => {
    expect(rasterLine({ x: -2, y: 0 }, { x: 2, y: 0 })).toEqual([{ x: -2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(rasterLine({ x: 0, y: 0 }, { x: 3, y: 3 })).toHaveLength(4);
  });
  it("recolors a staged cell without duplicating it and never drops an earlier cell at the cap", () => {
    const previous = [{ x: 0, y: 0, color: "#3659DB" }, { x: -1, y: 0, color: "#FFFFFF" }];
    const next = mergePaintCells(previous, [{ x: 0, y: 0, color: "#E7ABC6" }, { x: 3, y: 3, color: "#3659DB" }], 2);
    expect(next).toEqual([{ x: 0, y: 0, color: "#E7ABC6" }, { x: -1, y: 0, color: "#FFFFFF" }]);
    expect(previous[0].color).toBe("#3659DB");
  });
  it("bounds extreme pointer jumps before producing huge temporary arrays", () => {
    expect(rasterLine({ x: -10000, y: 0 }, { x: 9999, y: 0 }, 144)).toHaveLength(144);
  });
});
