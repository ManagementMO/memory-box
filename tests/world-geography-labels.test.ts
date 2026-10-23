import {describe,expect,it,vi} from "vitest";
import {clearLabelBox} from "../src/components/world-geography";
import {intersects,type WorldRect} from "../src/lib/client/spatial-index";

describe("geographic label clear space",()=>{
  const viewport={width:390,height:608},preferred={x:195,y:260};
  it("keeps the preferred slot when content and other labels leave it clear",()=>{
    expect(clearLabelBox(preferred,160,viewport,[],()=>false)).toEqual({x:115,y:260,width:160,height:44});
  });
  it("moves to nearby clear ground without covering an original or another label",()=>{
    const art:WorldRect={x:110,y:262,width:170,height:40};
    const prior:WorldRect={x:20,y:140,width:100,height:44};
    const result=clearLabelBox(preferred,160,viewport,[prior],rect=>intersects(art,rect));
    expect(result).not.toBeNull();expect(intersects(art,result!)).toBe(false);expect(intersects(prior,result!)).toBe(false);
    expect(Math.abs(result!.x-115)).toBeLessThanOrEqual(80);expect(Math.abs(result!.y-260)).toBeLessThanOrEqual(48);
  });
  it("hides a label when every bounded candidate is occupied",()=>{
    const blocked=vi.fn(()=>true);
    expect(clearLabelBox(preferred,160,viewport,[],blocked)).toBeNull();expect(blocked.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
