import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIVING_MEMORIES, LIVING_PIXELS } from "../src/lib/living-world";
import { WATERLOO_ARRIVAL, WATERLOO_LANDMARKS } from "../src/lib/waterloo-landmarks";
import { WATERLOO_EVENT_ID, WATERLOO_MEMORIES, WATERLOO_OPERATION_ID, WATERLOO_PIXELS, WATERLOO_SEED_MARKER } from "../src/lib/waterloo-world";
import { isCellPoint, isWorldPoint } from "../src/lib/world-bounds";
import { memorySize, sceneForPoint } from "../src/lib/scenes";
import { buildWaterlooSeedSql, waterlooSeedHash, waterlooSeedSummary } from "../scripts/seed-waterloo-world";
import { livingSeedHash } from "../scripts/seed-living-world";

describe("fictional Waterloo starter neighborhood",()=>{
  it("keeps existing starter payloads intact and uses a separate stable identity family",()=>{
    expect(livingSeedHash()).toBe("b29d54bd7471f3cffcba82225e014f3f8c6cefc9e9d54bb86784b0da28310001");
    expect(WATERLOO_MEMORIES).toHaveLength(24);
    const ids=new Set(WATERLOO_MEMORIES.map(memory=>memory.id));
    expect(ids.size).toBe(WATERLOO_MEMORIES.length);
    for(const memory of WATERLOO_MEMORIES){
      expect(memory.id).toMatch(/^20000000-0000-4000-8000-\d{12}$/);
      expect(LIVING_MEMORIES.some(existing=>existing.id===memory.id)).toBe(false);
      expect(isWorldPoint(memory.x,memory.y)).toBe(true);
      expect(memory.title.length).toBeLessThanOrEqual(100);expect(memory.body.length).toBeGreaterThan(30);expect(memory.body.length).toBeLessThanOrEqual(2000);
      expect(memory.sceneId).toBe(sceneForPoint(memory.x,memory.y));
      if(memory.inspiredBy){expect(ids.has(memory.inspiredBy)).toBe(true);expect(memory.inspiredBy<memory.id).toBe(true);}
    }
    expect(WATERLOO_MEMORIES.filter(memory=>memory.inspiredBy).length).toBeGreaterThanOrEqual(10);
    expect(new Set(WATERLOO_MEMORIES.map(memory=>memory.body)).size).toBe(24);
  });
  it("bundles four authored illustrations without external active content",()=>{
    const images=WATERLOO_MEMORIES.filter(memory=>memory.imageUrl);
    expect(images).toHaveLength(4);
    for(const memory of images){
      expect(memory.type).toBe("image");expect(memory.imageUrl).toMatch(/^\/starter-world\/uw-[a-z-]+\.svg$/);
      expect(existsSync(`public${memory.imageUrl}`)).toBe(true);
      expect(readFileSync(`public${memory.imageUrl}`,"utf8")).not.toMatch(/<script|<foreignObject|https?:\/\/(?!www.w3.org)/i);
    }
    expect(waterlooSeedSummary()).toMatchObject({memories:24,images:4,marker:WATERLOO_SEED_MARKER});
  });
  it("frames the campus neighborhood and every original while retaining the global world",()=>{
    expect(WATERLOO_MEMORIES.some(memory=>memory.id===WATERLOO_ARRIVAL.anchorMemoryId)).toBe(true);
    for(const memory of WATERLOO_MEMORIES){
      const size=memorySize(memory);
      expect(memory.x).toBeGreaterThanOrEqual(WATERLOO_ARRIVAL.x);expect(memory.y).toBeGreaterThanOrEqual(WATERLOO_ARRIVAL.y);
      expect(memory.x+size.width).toBeLessThanOrEqual(WATERLOO_ARRIVAL.x+WATERLOO_ARRIVAL.width);
      expect(memory.y+size.height).toBeLessThanOrEqual(WATERLOO_ARRIVAL.y+WATERLOO_ARRIVAL.height);
      for(const previous of LIVING_MEMORIES){
        const previousSize=memorySize(previous);
        expect(memory.x<previous.x+previousSize.width&&memory.x+size.width>previous.x&&memory.y<previous.y+previousSize.height&&memory.y+size.height>previous.y).toBe(false);
      }
    }
    expect(WATERLOO_LANDMARKS).toHaveLength(5);
    for(const place of WATERLOO_LANDMARKS){
      expect(place.sceneId).toBe(sceneForPoint(place.x,place.y));
      expect(WATERLOO_PIXELS.some(pixel=>pixel.x*6>=place.x&&pixel.x*6<place.x+place.width&&pixel.y*6>=place.y&&pixel.y*6<place.y+place.height)).toBe(true);
    }
  });
  it("leaves real drawable gaps and never proposes overwriting the old starter cells",()=>{
    expect(WATERLOO_PIXELS.length).toBeGreaterThan(3000);expect(WATERLOO_PIXELS.length).toBeLessThan(10000);
    const old=new Set(LIVING_PIXELS.map(pixel=>`${pixel.x},${pixel.y}`));
    expect(new Set(WATERLOO_PIXELS.map(pixel=>`${pixel.x},${pixel.y}`)).size).toBe(WATERLOO_PIXELS.length);
    for(const pixel of WATERLOO_PIXELS){expect(isCellPoint(pixel.x,pixel.y)).toBe(true);expect(pixel.color).toMatch(/^#[0-9A-F]{6}$/);expect(old.has(`${pixel.x},${pixel.y}`)).toBe(false);}
    const has=(x:number,y:number)=>WATERLOO_PIXELS.some(pixel=>pixel.x===x/6&&pixel.y===y/6);
    expect(has(3492,198)).toBe(false); // Missing end of the separate pink tie.
    expect(has(3996,960)).toBe(false); // Open last train body/window area.
    expect(WATERLOO_PIXELS.find(pixel=>pixel.x===4890/6&&pixel.y===882/6)?.color).toBe("#F5E7B4"); // Fourth sauce line stops before this part of the plate.
  });
});

describe("insert-only Waterloo seed preparation",()=>{
  it("is atomic, provenance-guarded and a successful repeat never restores changed content",()=>{
    const sql=buildWaterlooSeedSql();
    expect(sql).toContain("where id='commons' for update");expect(sql).toContain("on conflict(world_id,x,y) do nothing");expect(sql).toContain("on conflict(id) do nothing");
    expect(sql).not.toMatch(/delete from|truncate|update public\.cells|update public\.memories|do update set/i);
    expect(sql).toContain("WATERLOO_SEED_MARKER_CONFLICT");expect(sql).toContain("WATERLOO_SEED_MEMORY_CONFLICT");
    expect(sql).toContain("'already-applied'");expect(sql).toContain("'changed',0");
    expect(sql).toContain(`prior.request_hash is distinct from '${waterlooSeedHash()}'`);
    expect(sql).toContain(`m.client_id is distinct from '${WATERLOO_SEED_MARKER}:'||m.id::text`);
    expect(sql).toContain("m.author_id is not null");expect(sql).toContain("m.world_id is distinct from 'commons'");
    expect(sql).toContain(WATERLOO_OPERATION_ID);expect(sql).toContain(WATERLOO_EVENT_ID);
    expect(sql).toContain("'published',true,'pending'");expect(sql).toContain("'Waterloo starter artwork'");
    expect(sql).toContain("where m.visibility='published' and m.is_seed and m.author_id is null and m.world_id='commons'");
    expect(sql).toContain(`and m.client_id='${WATERLOO_SEED_MARKER}:'||m.id::text and m.request_hash='${waterlooSeedHash()}'`);
    expect(waterlooSeedHash()).toMatch(/^[0-9a-f]{64}$/);
  });
  it("never loads credentials or executes a remote database operation",()=>{
    const script=readFileSync("scripts/seed-waterloo-world.ts","utf8");
    expect(script).not.toMatch(/process\.loadEnvFile|createClient\(|adminClient\(|fetch\(|exec\(/);
    expect(script).toContain('flag:"wx"');
  });
});
