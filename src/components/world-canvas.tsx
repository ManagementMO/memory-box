"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Compass, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Memory, Pixel, SceneId, WorldSnapshot } from "@/lib/types";
import { memorySize, SCENES, SCENE_LABELS } from "@/lib/scenes";
import { MemoryCard } from "./memory-card";

export interface CameraCommand { key: number; type: "fit" | "focus" | "frame"; points?: { x: number; y: number; width?: number; height?: number }[] }
export interface PendingPlacement { kind: "paint" | "memory"; x: number; y: number; pixels?: Pixel[]; memory?: Memory }

export function WorldCanvas({ world, selectedId, foundIds, activeScene, onScene, onOpen, pending, onPosition, command, children }: {
  world: WorldSnapshot; selectedId: string | null; foundIds: string[]; activeScene: SceneId; onScene: (id: SceneId) => void;
  onOpen: (id: string) => void; pending: PendingPlacement | null; onPosition: (x: number, y: number) => void; command: CameraCommand;
  children?: React.ReactNode;
}) {
  const board = useRef<HTMLDivElement>(null), transformed = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const camera = useRef({ x: 0, y: 0, z: 0.8 });
  const drag = useRef<{ pointer: number; x: number; y: number; cx: number; cy: number } | null>(null);
  const initialized = useRef(false);
  const [zoom, setZoom] = useState(80), [panOpen, setPanOpen] = useState(false);
  const memoryMap = new Map(world.memories.map((memory) => [memory.id, memory]));
  const applyCamera = useCallback(() => {
    const element = board.current;
    if (element) {
      const worldWidth = 1200 * camera.current.z, worldHeight = 720 * camera.current.z;
      camera.current.x = worldWidth < element.clientWidth ? (element.clientWidth - worldWidth) / 2 : Math.min(40, Math.max(element.clientWidth - worldWidth - 40, camera.current.x));
      camera.current.y = worldHeight < element.clientHeight ? (element.clientHeight - worldHeight) / 2 : Math.min(40, Math.max(element.clientHeight - worldHeight - 40, camera.current.y));
    }
    const { x, y, z } = camera.current;
    if (transformed.current) { transformed.current.style.transform = `translate(${x}px,${y}px) scale(${z})`; transformed.current.dataset.small = String(z < 0.65); }
    setZoom(Math.round(z * 100));
  }, []);
  const fit = useCallback(() => {
    const element = board.current;
    if (!element) return;
    const z = Math.max(0.22, Math.min((element.clientWidth - 50) / 1200, (element.clientHeight - 75) / 720, 1.05));
    camera.current = { x: (element.clientWidth - 1200 * z) / 2, y: (element.clientHeight - 720 * z) / 2 + 14, z };
    applyCamera();
  }, [applyCamera]);
  const framePoints = useCallback((points: { x: number; y: number; width?: number; height?: number }[], single = false) => {
    const element = board.current;
    if (!element || !points.length) return;
    const left = Math.min(...points.map((p) => p.x)), top = Math.min(...points.map((p) => p.y));
    const right = Math.max(...points.map((p) => p.x + (p.width ?? 200))), bottom = Math.max(...points.map((p) => p.y + (p.height ?? 120)));
    const z = single ? Math.min(1.08, Math.max(0.7, (element.clientWidth - 40) / 500)) : Math.min(1, Math.max(.26, Math.min((element.clientWidth - 90) / Math.max(200, right - left), (element.clientHeight - 130) / Math.max(160, bottom - top))));
    camera.current = { x: element.clientWidth / 2 - (left + right) / 2 * z, y: element.clientHeight / 2 - (top + bottom) / 2 * z + 24, z };
    applyCamera();
  }, [applyCamera]);

  const entryView = useCallback(() => {
    if (board.current && board.current.clientWidth < 700) framePoints([{ x: 400, y: 180, width: 400, height: 500 }]);
    else fit();
  }, [fit, framePoints]);

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    let oldWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (!initialized.current) { initialized.current = true; entryView(); }
      else { camera.current.x += (element.clientWidth - oldWidth) / 2; applyCamera(); }
      oldWidth = element.clientWidth;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [applyCamera, entryView]);

  useEffect(() => {
    if (command.key === 0) entryView();
    else if (command.type === "fit") fit();
    else if (command.points?.length) framePoints(command.points, command.type === "focus");
  }, [command, entryView, fit, framePoints]);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const context = target.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 1200, 720);
    world.pixels.forEach((pixel) => { context.fillStyle = pixel.color; context.fillRect(pixel.x * 6, pixel.y * 6, 6, 6); });
    if (pending?.pixels) {
      context.globalAlpha = .72;
      pending.pixels.forEach((pixel) => { context.fillStyle = pixel.color; context.fillRect(pixel.x * 6, pixel.y * 6, 6, 6); });
      context.globalAlpha = 1;
      const xs = pending.pixels.map((pixel) => pixel.x), ys = pending.pixels.map((pixel) => pixel.y);
      if (xs.length) { context.strokeStyle = "#354FB2"; context.lineWidth = 2; context.setLineDash([5, 4]); context.strokeRect(Math.min(...xs) * 6 - 5, Math.min(...ys) * 6 - 5, (Math.max(...xs) - Math.min(...xs) + 1) * 6 + 10, (Math.max(...ys) - Math.min(...ys) + 1) * 6 + 10); context.setLineDash([]); }
    }
  }, [world.pixels, pending]);

  const zoomBy = (multiplier: number) => {
    const element = board.current;
    if (!element) return;
    const current = camera.current, cx = element.clientWidth / 2, cy = element.clientHeight / 2;
    const wx = (cx - current.x) / current.z, wy = (cy - current.y) / current.z;
    current.z = Math.max(.22, Math.min(1.8, current.z * multiplier)); current.x = cx - wx * current.z; current.y = cy - wy * current.z;
    applyCamera();
  };
  const move = (x: number, y: number) => { camera.current.x += x; camera.current.y += y; applyCamera(); };
  const relationships = world.memories.filter((memory) => memory.inspiredBy && (memory.id === selectedId || memory.inspiredBy === selectedId || (foundIds.includes(memory.id) && foundIds.includes(memory.inspiredBy))));

  return <div className={`world-board${pending ? " is-placing" : ""}`} ref={board} role="region" aria-label="The shared Memory Box world" onPointerDown={(event) => {
    if (event.target instanceof Element && event.target.closest("button, input, textarea, select, .canvas-overlay")) return;
    if (pending) {
      const box = event.currentTarget.getBoundingClientRect(), { x, y, z } = camera.current;
      onPosition((event.clientX - box.left - x) / z, (event.clientY - box.top - y) / z);
      event.preventDefault(); return;
    }
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, cx: camera.current.x, cy: camera.current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={(event) => {
    const previous = drag.current;
    if (!previous || event.pointerId !== previous.pointer) return;
    camera.current.x = previous.cx + event.clientX - previous.x; camera.current.y = previous.cy + event.clientY - previous.y; applyCamera();
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <div className="world-transformed" ref={transformed}>
      <canvas ref={canvas} width="1200" height="720" aria-label="Shared pixel artwork, made by contributors" role="img" />
      <svg className="memory-threads" width="1200" height="720" aria-hidden="true">{relationships.map((memory) => {
        const original = memoryMap.get(memory.inspiredBy!);
        if (!original) return null;
        const a = memorySize(original), b = memorySize(memory), x1 = original.x + a.width / 2, y1 = original.y + a.height, x2 = memory.x + b.width / 2, y2 = memory.y + b.height;
        return <path key={memory.id} d={`M${x1},${y1} C${x1},${Math.max(y1, y2) + 40} ${x2},${Math.max(y1, y2) + 40} ${x2},${y2}`} />;
      })}</svg>
      {SCENES.map((scene) => <button type="button" className={`scene-label${activeScene === scene.id ? " is-current" : ""}`} key={scene.id} style={{ left: SCENE_LABELS[scene.id].x, top: SCENE_LABELS[scene.id].y }} onClick={() => onScene(scene.id)}>{scene.title}<ArrowUpRight size={13} /></button>)}
      {world.memories.map((memory) => <MemoryCard key={memory.id} memory={memory} selected={selectedId === memory.id} number={foundIds.includes(memory.id) ? foundIds.indexOf(memory.id) + 1 : undefined} dimmed={foundIds.length > 0 && !foundIds.includes(memory.id)} parentName={memory.inspiredBy ? memoryMap.get(memory.inspiredBy)?.authorName : undefined} onOpen={() => { if (!pending) onOpen(memory.id); }} />)}
      {pending?.memory ? <MemoryCard memory={pending.memory} pending parentName={pending.memory.inspiredBy ? memoryMap.get(pending.memory.inspiredBy)?.authorName : undefined} /> : null}
    </div>
    {children}
    <div className="canvas-zoom canvas-overlay">
      <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out"><Minus size={17} /></button>
      <span>{zoom}%</span>
      <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in"><Plus size={17} /></button>
      <span className="zoom-divider" />
      <button type="button" onClick={fit} aria-label="See the whole commons"><Maximize2 size={16} /></button>
      <button type="button" onClick={() => setPanOpen(!panOpen)} aria-label="Move the view" aria-expanded={panOpen}><Compass size={17} /></button>
      {panOpen ? <div className="pan-controls"><button type="button" aria-label="Pan up" onClick={() => move(0, 100)}><ArrowUp size={17} /></button><button type="button" aria-label="Pan left" onClick={() => move(100, 0)}><ArrowLeft size={17} /></button><button type="button" aria-label="Pan down" onClick={() => move(0, -100)}><ArrowDown size={17} /></button><button type="button" aria-label="Pan right" onClick={() => move(-100, 0)}><ArrowRight size={17} /></button></div> : null}
    </div>
    <div className="canvas-footnote canvas-overlay">Small additions. Something made together.</div>
  </div>;
}
