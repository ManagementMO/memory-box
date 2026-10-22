"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { WorldSnapshot } from "@/lib/types";
import { memorySize } from "@/lib/scenes";
import { GRID_SIZE } from "@/lib/world-bounds";

/** A live, read-only crop around the shared center, not an exported snapshot. */
export function PlacePreview({ world, place }: {
  world: WorldSnapshot;
  place: { x: number; y: number; z: number; memoryId?: string };
}) {
  const container = useRef<HTMLDivElement>(null);
  const pixels = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(320);
  const height = width * 5 / 8;
  const scale = place.z * width / 720;
  const left = place.x - 360 / place.z;
  const top = place.y - 225 / place.z;
  const right = place.x + 360 / place.z;
  const bottom = place.y + 225 / place.z;
  const visibleMemories = useMemo(() => world.memories.filter(memory => {
    const size = memorySize(memory);
    return memory.x < right && memory.x + size.width > left && memory.y < bottom && memory.y + size.height > top;
  }), [world.memories, left, top, right, bottom]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth > 0) setWidth(element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = pixels.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    for (const pixel of world.pixels) {
      const x = pixel.x * GRID_SIZE, y = pixel.y * GRID_SIZE;
      if (x + GRID_SIZE <= left || x >= right || y + GRID_SIZE <= top || y >= bottom) continue;
      context.fillStyle = pixel.color;
      context.fillRect((x - left) * scale, (y - top) * scale, GRID_SIZE * scale, GRID_SIZE * scale);
    }
  }, [world.pixels, width, height, scale, left, top, right, bottom]);

  return <div ref={container} className="place-preview" aria-hidden="true" style={{ position: "relative", aspectRatio: "8 / 5", overflow: "hidden", pointerEvents: "none" }}>
    <canvas ref={pixels} className="place-preview-pixels" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    {visibleMemories.map(memory => {
      const size = memorySize(memory);
      const style = {
        position: "absolute", left: (memory.x - left) * scale, top: (memory.y - top) * scale,
        width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "top left",
        background: memory.color, overflow: "hidden", padding: 12, boxSizing: "border-box",
      } satisfies CSSProperties;
      return <div className={`place-preview-memory place-preview-${memory.type}${memory.id === place.memoryId ? " is-linked" : ""}`} key={memory.id} style={style}>
        {memory.type === "image" ? <>
          <div className="place-preview-photo" style={{ height: 105, overflow: "hidden", background: "#fffdfa" }}>
            {memory.imageUrl ? <img key={memory.imageUrl} src={memory.imageUrl} alt="" draggable={false} onError={event => { event.currentTarget.style.visibility = "hidden"; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
          </div>
          <span className="place-preview-copy" style={{ display: "block", fontSize: 11, lineHeight: 1.3, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{memory.title}</span>
        </> : <span className="place-preview-copy" style={{ display: "block", fontSize: 15, lineHeight: 1.3, maxHeight: 60, overflow: "hidden", overflowWrap: "anywhere" }}>{memory.title || memory.body}</span>}
        <span className="place-preview-author" style={{ display: "block", fontSize: 10, lineHeight: 1.3, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>@{memory.authorName}</span>
      </div>;
    })}
    <svg className="place-preview-marker" viewBox="0 0 24 24" width="24" height="24" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
      <path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="#fffdfa" strokeWidth="5" />
      <path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" />
    </svg>
  </div>;
}
