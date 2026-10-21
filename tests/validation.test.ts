import { describe, expect, it } from "vitest";
import { newMemoryInput, paintInput, reportInput, uploadInput } from "../src/lib/server/validation";

const id = "53219ac5-08c8-4461-a448-b7e688571fa7";
describe("public contribution boundaries", () => {
  it("rejects script links rather than treating them as ordinary memories", () => {
    expect(newMemoryInput.safeParse({clientId:id,type:"link",body:"A link",url:"javascript:alert(1)",color:"#354fb2",x:400,y:300,sceneId:"mixtape"}).success).toBe(false);
  });
  it("requires original words for text and an owned asset reference for an image", () => {
    const base={clientId:id,body:"",color:"#354fb2",x:400,y:300,sceneId:"mixtape"};
    expect(newMemoryInput.safeParse({...base,type:"text"}).success).toBe(false);
    expect(newMemoryInput.safeParse({...base,type:"image"}).success).toBe(false);
    expect(newMemoryInput.safeParse({...base,type:"image",assetId:id}).success).toBe(true);
  });
  it("bounds painting by actual cells and rejects duplicates and outside coordinates", () => {
    expect(paintInput.safeParse({opId:id,cells:[{x:0,y:0,color:"#ffffff"},{x:0,y:0,color:"#000000"}]}).success).toBe(false);
    expect(paintInput.safeParse({opId:id,cells:[{x:200,y:0,color:"#ffffff"}]}).success).toBe(true);
    expect(paintInput.safeParse({opId:id,cells:[{x:199,y:119,color:"#354fb2"}]}).success).toBe(true);
  });
  it("accepts sparse signed paint throughout the pilot plane and rejects one cell past an edge", () => {
    for (const [x, y] of [[-10000,-10000],[9999,9999],[-1,120],[200,-1]]) {
      expect(paintInput.safeParse({opId:id,cells:[{x,y,color:"#ffffff"}]}).success).toBe(true);
    }
    for (const [x, y] of [[-10001,0],[10000,0],[0,-10001],[0,10000],[0.5,0]]) {
      expect(paintInput.safeParse({opId:id,cells:[{x,y,color:"#ffffff"}]}).success).toBe(false);
    }
  });
  it("accepts memories beyond the original board without allowing out-of-plane coordinates", () => {
    const memory={clientId:id,type:"text",body:"A new corner.",color:"#fff3bf",sceneId:"mixtape"};
    for (const [x,y] of [[-60000,-60000],[59999,59999],[-2400,4800]]) {
      expect(newMemoryInput.safeParse({...memory,x,y}).success).toBe(true);
    }
    for (const [x,y] of [[-60001,0],[60000,0],[0,-60001],[0,60000],[0,1.5]]) {
      expect(newMemoryInput.safeParse({...memory,x,y}).success).toBe(false);
    }
  });
  it("bounds report rectangles entirely inside the signed cell plane and caps clear size", () => {
    const report={reason:"Please review these pixels."};
    for (const bounds of [{x:-10000,y:-10000,width:200,height:120},{x:9999,y:9999,width:1,height:1},{x:-40,y:200,width:80,height:20}]) {
      expect(reportInput.safeParse({...report,bounds}).success).toBe(true);
    }
    for (const bounds of [{x:9999,y:0,width:2,height:1},{x:0,y:9999,width:1,height:2},{x:0,y:0,width:201,height:1},{x:-10001,y:0,width:1,height:1},{x:0,y:0,width:1.5,height:1}]) {
      expect(reportInput.safeParse({...report,bounds}).success).toBe(false);
    }
  });
  it("rejects executable image formats and oversized upload declarations", () => {
    expect(uploadInput.safeParse({name:"x.svg",mime:"image/svg+xml",size:100}).success).toBe(false);
    expect(uploadInput.safeParse({name:"x.png",mime:"image/png",size:5*1024*1024+1}).success).toBe(false);
  });
});
