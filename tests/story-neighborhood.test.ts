import { describe, expect, it } from "vitest";
import { floatingStoryPosition, neighborhoodCamera } from "../src/lib/client/story-neighborhood";

const source={x:4300,y:240,width:205,height:110};
describe("spatial story discovery",()=>{
  it.each([{width:1440,height:844},{width:390,height:788},{width:320,height:684}])("keeps the original in view with neighbors at $width px",viewport=>{
    const camera=neighborhoodCamera(source,[source,{...source,x:4550},{...source,x:-59000}],viewport);
    const x=camera.x+(source.x+source.width/2)*camera.z;
    const y=camera.y+(source.y+source.height/2)*camera.z;
    expect(camera.z).toBeGreaterThanOrEqual(.6);expect(camera.z).toBeLessThanOrEqual(.9);
    expect(x).toBeGreaterThan(70);expect(x).toBeLessThan(viewport.width-70);
    expect(y).toBeGreaterThan(100);expect(y).toBeLessThan(viewport.height-220);
  });
  it("reserves space above the phone composer for a signed-coordinate original",()=>{
    const anchor={...source,x:-59000,y:59000},viewport={width:390,height:788};
    const camera=neighborhoodCamera(anchor,[anchor],viewport,"compose");
    expect(camera.y+(anchor.y+anchor.height)*camera.z).toBeLessThan(300);
    const overlay=floatingStoryPosition(camera,anchor,viewport,{width:374,height:400},"compose");
    expect(overlay.x).toBe(8);expect(overlay.y+400).toBeLessThanOrEqual(714);
  });
  it("keeps a complete photo above the taller short-phone reply sheet",()=>{
    const photo={x:-59000,y:59000,width:142,height:161},viewport={width:320,height:584};
    const camera=neighborhoodCamera(photo,[photo],viewport,"compose");
    const overlay=floatingStoryPosition(camera,photo,viewport,{width:304,height:384},"compose");
    expect(camera.y+photo.y*camera.z).toBeGreaterThanOrEqual(8);
    expect(camera.y+(photo.y+photo.height)*camera.z).toBeLessThanOrEqual(overlay.y-8);
  });
  it.each([{width:1440,height:844},{width:390,height:788},{width:320,height:480}])("keeps a floating editor inside a $width px viewport",viewport=>{
    const result=floatingStoryPosition({x:-90000,y:90000,z:1.2},source,viewport,{width:Math.min(294,viewport.width-16),height:Math.min(350,viewport.height-160)},"compose");
    expect(result.x).toBeGreaterThanOrEqual(8);expect(result.y).toBeGreaterThanOrEqual(8);
    expect(result.x+Math.min(294,viewport.width-16)).toBeLessThanOrEqual(viewport.width-8);
    expect(result.y+Math.min(350,viewport.height-160)).toBeLessThanOrEqual(viewport.height-74);
  });
  it("offers the side with room beside the source on desktop",()=>{
    const camera=neighborhoodCamera(source,[source],{width:1440,height:844});
    const result=floatingStoryPosition(camera,source,{width:1440,height:844},{width:294,height:220},"peek");
    expect(result.x).toBeGreaterThan(camera.x+(source.x+source.width)*camera.z);
  });
});
