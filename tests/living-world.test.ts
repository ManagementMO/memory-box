import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIVING_MEMORIES, LIVING_PIXELS, LIVING_LANDMARKS, LIVING_OPERATION_ID, LIVING_SEED_MARKER } from "../src/lib/living-world";
import { isCellPoint, isWorldPoint } from "../src/lib/world-bounds";
import { buildLivingSeedSql, livingSeedHash } from "../scripts/seed-living-world";

describe("authored living-mosaic starter world", () => {
  it("has stable unique originals, actual local imagery, and valid original-to-response edges", () => {
    expect(LIVING_MEMORIES.length).toBeGreaterThanOrEqual(70); expect(LIVING_MEMORIES.length).toBeLessThanOrEqual(85);
    const ids = new Set(LIVING_MEMORIES.map(m => m.id));
    expect(ids.size).toBe(LIVING_MEMORIES.length);
    expect(new Set(LIVING_MEMORIES.map(m => `${m.x},${m.y}`)).size).toBe(LIVING_MEMORIES.length);
    expect(new Set(LIVING_MEMORIES.map(m => m.body)).size).toBe(LIVING_MEMORIES.length);
    for (const memory of LIVING_MEMORIES) {
      expect(memory.id).toMatch(/^10000000-0000-4000-8000-\d{12}$/);
      expect(isWorldPoint(memory.x, memory.y)).toBe(true);
      expect(memory.title.length).toBeLessThanOrEqual(100); expect(memory.body.length).toBeGreaterThan(15); expect(memory.body.length).toBeLessThanOrEqual(2000);
      if (memory.inspiredBy) { expect(ids.has(memory.inspiredBy)).toBe(true); expect(memory.inspiredBy < memory.id).toBe(true); }
      if (memory.imageUrl) {
        expect(memory.type).toBe("image"); expect(memory.imageUrl).toMatch(/^\/starter-world\/[a-z-]+\.svg$/);
        expect(existsSync(`public${memory.imageUrl}`)).toBe(true);
        const source = readFileSync(`public${memory.imageUrl}`, "utf8");
        expect(source).not.toMatch(/<script|<foreignObject|https?:\/\/(?!www.w3.org)/i);
      }
    }
    expect(LIVING_MEMORIES.filter(m => m.imageUrl)).toHaveLength(8);
    expect(LIVING_MEMORIES.filter(m => m.inspiredBy).length).toBeGreaterThan(20);
    const train=LIVING_LANDMARKS.find(place=>place.id==="night-train")!;
    for(const memory of LIVING_MEMORIES.filter(m=>m.title==="A train with nowhere to be" || m.title==="One stop before the sea"))expect(memory.sceneId).toBe(train.sceneId);
  });
  it("provides real editable pixel landmarks in a connected occupied field without expanding the write bounds", () => {
    expect(LIVING_PIXELS.length).toBeGreaterThan(3000); expect(LIVING_PIXELS.length).toBeLessThan(10000);
    expect(new Set(LIVING_PIXELS.map(p => `${p.x},${p.y}`)).size).toBe(LIVING_PIXELS.length);
    expect(LIVING_PIXELS.every(p => isCellPoint(p.x, p.y) && /^#[0-9A-F]{6}$/.test(p.color))).toBe(true);
    for (const landmark of LIVING_LANDMARKS) {
      expect(LIVING_PIXELS.some(p => p.x * 6 >= landmark.x && p.x * 6 <= landmark.x + landmark.width && p.y * 6 >= landmark.y && p.y * 6 <= landmark.y + landmark.height)).toBe(true);
    }
    const xs = LIVING_MEMORIES.map(m => m.x), ys = LIVING_MEMORIES.map(m => m.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2900);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1950);
    // The unfinished train genuinely leaves its last body/window area empty.
    expect(LIVING_PIXELS.some(p => p.x * 6 >= 1842 && p.x * 6 < 1914 && p.y * 6 >= 600 && p.y * 6 < 648)).toBe(false);
  });
});

describe("insert-only living-world seed transaction", () => {
  it("locks the authoritative world, never repaints a cell or replaces an original, and guards successful reruns", () => {
    const sql = buildLivingSeedSql();
    expect(sql).toContain("where id='commons' for update");
    expect(sql).toContain("on conflict(world_id,x,y) do nothing");
    expect(sql).toContain("on conflict(id) do nothing");
    expect(sql).not.toMatch(/delete from|truncate|update public\.cells|update public\.memories|do update set/i);
    expect(sql).toContain("'already-applied'"); expect(sql).toContain("LIVING_SEED_MARKER_CONFLICT");
    expect(sql).toContain(LIVING_OPERATION_ID); expect(sql).toContain(LIVING_SEED_MARKER);
    expect(sql).toContain("'published',true,'pending'");
    expect(sql).toContain("Starter artwork"); expect(sql).toContain("where m.visibility='published' and m.is_seed and m.author_id is null");
    expect(sql).toContain("or m.world_id<>'commons'");
    expect(sql).toContain(`or m.client_id<>'${LIVING_SEED_MARKER}:'||m.id::text or m.request_hash<>'${livingSeedHash()}'`);
    expect(sql).toContain("and m.world_id='commons'");
    expect(sql).toContain(`and m.client_id='${LIVING_SEED_MARKER}:'||m.id::text and m.request_hash='${livingSeedHash()}'`);
    expect(sql).not.toContain("m.client_id like"); expect(sql).not.toContain("m.client_id not like");
    expect(livingSeedHash()).toMatch(/^[0-9a-f]{64}$/);
    // Preparation does not open a secret-bearing database connection.
    const script = readFileSync("scripts/seed-living-world.ts", "utf8");
    expect(script).not.toMatch(/process\.loadEnvFile|createClient\(|adminClient\(/);
  });
});
