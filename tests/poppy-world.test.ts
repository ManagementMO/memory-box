import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { POPPY_MEMORIES,POPPY_PIXELS } from "../src/lib/poppy-world";
import { WATERLOO_MEMORIES } from "../src/lib/waterloo-world";
import { buildPoppySeedSql,poppySeedHash } from "../scripts/seed-poppy-world";
import { waterlooSeedHash } from "../scripts/seed-waterloo-world";
import { trustedSeedImagePath } from "../src/lib/server/trusted-seed-image";

describe("approved poppy starter addition",()=>{
  it("uses a distinct cohort and leaves the prior frozen campus payload intact",()=>{
    const old=new Set(WATERLOO_MEMORIES.map(m=>m.id));
    expect(POPPY_MEMORIES.every(m=>!old.has(m.id))).toBe(true);
    expect(waterlooSeedHash()).toBe("ac362f13f9cee128e7d6023c722f037342dd29d5db65098d421c2102917e7123");
    expect(poppySeedHash()).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(POPPY_PIXELS.map(p=>`${p.x},${p.y}`)).size).toBe(POPPY_PIXELS.length);
    expect(POPPY_PIXELS.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&/^#[A-F0-9]{6}$/.test(p.color))).toBe(true);
  });
  it("keeps a build-on linked to its actual starter and discloses the generated photo",()=>{
    expect(POPPY_MEMORIES.filter(m=>m.inspiredBy).every(m=>POPPY_MEMORIES.some(parent=>parent.id===m.inspiredBy))).toBe(true);
    const photo=POPPY_MEMORIES.find(m=>m.type==="image")!;
    expect(photo.body).toContain("generated starter photo");
    expect(trustedSeedImagePath({...photo,isSeed:true})).toBe("starter-world/uw-after-hours.svg");
    expect(trustedSeedImagePath({...photo,isSeed:false})).toBeNull();
  });
  it("rasterizes the actual self-contained photo through the existing starter pipeline",async()=>{
    const svg=readFileSync("public/starter-world/uw-after-hours.svg");
    expect(svg.toString()).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    const {data,info}=await sharp(svg).resize(40,30).removeAlpha().raw().toBuffer({resolveWithObject:true});
    expect(info.width).toBe(40);expect(info.height).toBe(30);
    const values=[...data];expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(100);
    const webp=await sharp(svg).webp().toBuffer();expect(webp.length).toBeGreaterThan(1000);
  });
});
