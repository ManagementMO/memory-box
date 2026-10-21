import { describe, expect, it } from "vitest";
import { newMemoryInput, paintInput, uploadInput } from "../src/lib/server/validation";

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
    expect(paintInput.safeParse({opId:id,cells:[{x:200,y:0,color:"#ffffff"}]}).success).toBe(false);
    expect(paintInput.safeParse({opId:id,cells:[{x:199,y:119,color:"#354fb2"}]}).success).toBe(true);
  });
  it("rejects executable image formats and oversized upload declarations", () => {
    expect(uploadInput.safeParse({name:"x.svg",mime:"image/svg+xml",size:100}).success).toBe(false);
    expect(uploadInput.safeParse({name:"x.png",mime:"image/png",size:5*1024*1024+1}).success).toBe(false);
  });
});
