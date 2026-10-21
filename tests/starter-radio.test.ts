import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { makeRadioPlan, radioCandidates, SOURCE_OPERATION } from "../scripts/refresh-starter-radio";

describe("guarded starter artwork planning",()=>{
  it("maps five-unit SVG pixels onto six-unit world cells without interpolation",async()=>{
    const pixels=await radioCandidates(readFileSync('public/starter-radio.svg'));
    const art=pixels.filter(p=>p.insertable);
    expect(art).toHaveLength(1778);
    expect(art.every(p=>p.x>=45&&p.x<129&&p.y>=30&&p.y<90)).toBe(true);
    expect(new Set(pixels.map(p=>`${p.x},${p.y}`)).size).toBe(pixels.length);
    expect(pixels.some(p=>p.x===50&&p.y===73)).toBe(false);
  });
  it("preserves all other owners including null-owned white, while only absent art can be inserted",()=>{
    const candidates=[{x:50,y:40,color:'#FFFFFF',insertable:false},{x:51,y:40,color:'#EDE6FF',insertable:true},{x:52,y:40,color:'#EDE6FF',insertable:true},{x:53,y:40,color:'#EDE6FF',insertable:true},{x:54,y:40,color:'#FFFFFF',insertable:false},{x:55,y:40,color:'#EDE6FF',insertable:true}];
    const rows=[{x:50,y:40,color:'#263633',operationId:SOURCE_OPERATION,revision:0},{x:51,y:40,color:'#FFFFFF',operationId:null,revision:10},{x:52,y:40,color:'#FFFFFF',operationId:'visitor',revision:11}];
    const plan=makeRadioPlan(Buffer.from('fixture'),candidates,rows,12,1);
    expect(plan.counts).toEqual({candidates:6,art:4,replaceSeed:1,insertArt:2,preserveOtherOwner:2,absentClear:1});
  });
});
