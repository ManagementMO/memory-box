"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Compass, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Memory, Pixel, SceneId, WorldSnapshot } from "@/lib/types";
import { memorySize, SCENES, SCENE_LABELS } from "@/lib/scenes";
import { CELL_MIN, CELL_MAX, GRID_SIZE } from "@/lib/world-bounds";
import { frameCamera, mergePaintCells, rasterLine, screenToWorld, zoomCameraAt, type Camera, type FramePoint, type Point } from "@/lib/client/canvas-geometry";
import { MemoryCard } from "./memory-card";

export interface CameraView extends Camera { width: number; height: number }
export interface CameraCommand { key: number; type: "fit" | "focus" | "frame" | "restore"; points?: FramePoint[]; camera?: CameraView }
export interface PendingPlacement { kind: "paint" | "memory"; x: number; y: number; pixels?: Pixel[]; memory?: Memory }
export interface BrushState { enabled: boolean; color: string; cells: Pixel[]; disabled: boolean; onChange: (cells: Pixel[]) => void }
interface Gesture { kind: "pan" | "paint" | "pinch"; start: Point; camera: Camera; moved: boolean; previousCell?: Point; distance?: number; anchor?: Point }

export function WorldCanvas({ world, selectedId, foundIds, activeScene, onScene, onOpen, pending, onPosition, command, brush, onCameraChange, children }: {
  world: WorldSnapshot; selectedId: string | null; foundIds: string[]; activeScene: SceneId; onScene: (id: SceneId) => void;
  onOpen: (id: string) => void; pending: PendingPlacement | null; onPosition: (x: number, y: number) => void; command: CameraCommand;
  brush?: BrushState; onCameraChange?: (camera: CameraView) => void; children?: React.ReactNode;
}) {
  const board = useRef<HTMLDivElement>(null), transformed = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const coordinate = useRef<HTMLSpanElement>(null), miniView = useRef<SVGRectElement>(null);
  const camera = useRef<Camera>({ x: 0, y: 0, z: .8 });
  const viewport = useRef({ width: 0, height: 0 }), initialized = useRef(false);
  const pointers = useRef(new Map<number, Point>()), gesture = useRef<Gesture | null>(null), stroke = useRef<Pixel[]>([]);
  const latest = useRef({ world, pending, brush, onCameraChange });
  latest.current = { world, pending, brush, onCameraChange };
  const [zoom, setZoom] = useState(80), [panOpen, setPanOpen] = useState(false), [gestureNotice, setGestureNotice] = useState("");

  const draw = useCallback(() => {
    const target = canvas.current, element = board.current;
    if (!target || !element) return;
    const context = target.getContext("2d");
    if (!context) return;
    const width = element.clientWidth, height = element.clientHeight, ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (target.width !== Math.round(width * ratio) || target.height !== Math.round(height * ratio)) { target.width = Math.round(width * ratio); target.height = Math.round(height * ratio); }
    context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, target.width, target.height);
    const c = camera.current, data = latest.current;
    context.imageSmoothingEnabled = false;
    context.setTransform(ratio * c.z, 0, 0, ratio * c.z, ratio * c.x, ratio * c.y);
    const left = -c.x / c.z, top = -c.y / c.z, right = (width - c.x) / c.z, bottom = (height - c.y) / c.z;
    const visible = (pixel: Pixel) => pixel.x * GRID_SIZE + GRID_SIZE >= left && pixel.x * GRID_SIZE <= right && pixel.y * GRID_SIZE + GRID_SIZE >= top && pixel.y * GRID_SIZE <= bottom;
    const paint = (cells: Pixel[], opacity = 1) => { context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = opacity; for (const pixel of cells) if (visible(pixel)) { context.fillStyle = pixel.color; const x = Math.round((pixel.x * GRID_SIZE * c.z + c.x) * ratio), y = Math.round((pixel.y * GRID_SIZE * c.z + c.y) * ratio), right = Math.round(((pixel.x + 1) * GRID_SIZE * c.z + c.x) * ratio), bottom = Math.round(((pixel.y + 1) * GRID_SIZE * c.z + c.y) * ratio); context.fillRect(x, y, right - x, bottom - y); } context.globalAlpha = 1; context.setTransform(ratio * c.z, 0, 0, ratio * c.z, ratio * c.x, ratio * c.y); };
    paint(data.world.pixels);
    const preview = mergePaintCells(data.brush?.cells ?? [], stroke.current);
    paint(preview, .65);
    context.strokeStyle = "#6F84D7"; context.lineWidth = 1 / c.z;
    for (const pixel of preview) if (visible(pixel)) context.strokeRect(pixel.x * GRID_SIZE, pixel.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    if (data.pending?.pixels) {
      paint(data.pending.pixels, .65);
      const xs = data.pending.pixels.map(pixel => pixel.x), ys = data.pending.pixels.map(pixel => pixel.y);
      if (xs.length) {
        context.setLineDash([5 / c.z, 4 / c.z]);
        context.strokeRect(Math.min(...xs) * GRID_SIZE - 3, Math.min(...ys) * GRID_SIZE - 3, (Math.max(...xs) - Math.min(...xs) + 1) * GRID_SIZE + 6, (Math.max(...ys) - Math.min(...ys) + 1) * GRID_SIZE + 6);
        context.setLineDash([]);
      }
    }
    if (data.brush?.enabled && c.z >= 1.5) {
      context.beginPath(); context.lineWidth = .5 / c.z; context.strokeStyle = "#A6B2DB55";
      for (let x = Math.floor(left / GRID_SIZE) * GRID_SIZE; x <= right; x += GRID_SIZE) { context.moveTo(x, top); context.lineTo(x, bottom); }
      for (let y = Math.floor(top / GRID_SIZE) * GRID_SIZE; y <= bottom; y += GRID_SIZE) { context.moveTo(left, y); context.lineTo(right, y); }
      context.stroke();
    }
  }, []);

  const applyCamera = useCallback(() => {
    const element = board.current;
    if (!element) return;
    const { x, y, z } = camera.current;
    // No entry-board clamp: a camera can explore signed sparse world coordinates.
    if (transformed.current) {
      transformed.current.style.transform = `translate(${x}px,${y}px) scale(${z})`;
      transformed.current.style.setProperty("--camera-zoom", String(z));
      transformed.current.dataset.small = String(z < .9);
      transformed.current.dataset.overview = String(z < .5);
      transformed.current.dataset.map = String(z < .15);
    }
    element.dataset.cameraX = String(x); element.dataset.cameraY = String(y); element.dataset.cameraZoom = String(z);
    element.style.setProperty("--grid-x", `${x}px`); element.style.setProperty("--grid-y", `${y}px`);
    const center = screenToWorld(camera.current, { x: element.clientWidth / 2, y: element.clientHeight / 2 });
    if (coordinate.current) coordinate.current.textContent = `x ${Math.round(center.x).toLocaleString()} · y ${Math.round(center.y).toLocaleString()}`;
    if (miniView.current) {
      miniView.current.setAttribute("x", String(-x / z)); miniView.current.setAttribute("y", String(-y / z));
      miniView.current.setAttribute("width", String(element.clientWidth / z)); miniView.current.setAttribute("height", String(element.clientHeight / z));
    }
    viewport.current = { width: element.clientWidth, height: element.clientHeight };
    latest.current.onCameraChange?.({ ...camera.current, ...viewport.current });
    setZoom(z < .01 ? Math.round(z * 1000) / 10 : Math.round(z * 100)); draw();
  }, [draw]);

  const framePoints = useCallback((points: FramePoint[], single = false) => {
    const element = board.current;
    if (!element || !points.length) return;
    camera.current = frameCamera(points, { width: element.clientWidth, height: element.clientHeight }, { padding: 42, maxZoom: single ? 1.1 : 1 });
    applyCamera();
  }, [applyCamera]);

  const entryView = useCallback(() => {
    const element = board.current;
    if (!element) return;
    // These are the original landmark bounds, not the writable plane's limits.
    framePoints(element.clientWidth < 700 ? [{ x: 300, y: 150, width: 660, height: 550 }] : [{ x: 0, y: 0, width: 1200, height: 720 }]);
  }, [framePoints]);

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (!initialized.current) { initialized.current = true; entryView(); }
      else {
        camera.current.x += (element.clientWidth - viewport.current.width) / 2;
        camera.current.y += (element.clientHeight - viewport.current.height) / 2;
        applyCamera();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [applyCamera, entryView]);

  useEffect(() => {
    if (command.type === "restore" && command.camera && board.current) {
      camera.current = { ...command.camera, x: command.camera.x + (board.current.clientWidth - command.camera.width) / 2, y: command.camera.y + (board.current.clientHeight - command.camera.height) / 2 };
      applyCamera();
    } else if (command.type === "fit" || command.key === 0) entryView();
    else if (command.points?.length) framePoints(command.points, command.type === "focus");
  }, [command, entryView, framePoints, applyCamera]);

  useEffect(() => { draw(); }, [world.pixels, pending, brush?.cells, brush?.enabled, draw]);
  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest(".canvas-overlay")) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        camera.current = zoomCameraAt(camera.current, Math.exp(-event.deltaY * .008), { x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else { camera.current.x -= event.deltaX; camera.current.y -= event.deltaY; }
      applyCamera();
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [applyCamera]);

  const zoomBy = (multiplier: number) => {
    if (!board.current) return;
    camera.current = zoomCameraAt(camera.current, multiplier, { x: board.current.clientWidth / 2, y: board.current.clientHeight / 2 });
    applyCamera();
  };
  const move = (x: number, y: number) => { camera.current.x += x; camera.current.y += y; applyCamera(); };
  const localPoint = (point: Point) => { const rect = board.current!.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; };
  const paintAt = (point: Point) => {
    const g = gesture.current, currentBrush = latest.current.brush;
    if (!g || !currentBrush?.enabled || currentBrush.disabled) return;
    const worldPoint = screenToWorld(camera.current, localPoint(point)), cell = { x: Math.floor(worldPoint.x / GRID_SIZE), y: Math.floor(worldPoint.y / GRID_SIZE) };
    const points = rasterLine(g.previousCell ?? cell, cell).filter(p => p.x >= CELL_MIN && p.x <= CELL_MAX && p.y >= CELL_MIN && p.y <= CELL_MAX);
    if (!points.length) { setGestureNotice("You’ve reached this pilot’s drawing limit. Pan back toward the commons."); return; }
    stroke.current = mergePaintCells(stroke.current, points.map(p => ({ ...p, color: currentBrush.color })));
    g.previousCell = cell; draw();
  };
  const finish = (pointerId: number, cancelled: boolean) => {
    const g = gesture.current, point = pointers.current.get(pointerId);
    pointers.current.delete(pointerId);
    if (!pointers.current.size) {
      if (g?.kind === "paint" && !cancelled && latest.current.brush && !latest.current.brush.disabled) latest.current.brush.onChange(mergePaintCells(latest.current.brush.cells, stroke.current));
      if (g?.kind === "pan" && !g.moved && !cancelled && point && pending) { const worldPoint = screenToWorld(camera.current, localPoint(point)); onPosition(worldPoint.x, worldPoint.y); }
      gesture.current = null; stroke.current = []; draw();
    } else { gesture.current = null; stroke.current = []; draw(); }
  };

  const memoryMap = new Map(world.memories.map(memory => [memory.id, memory]));
  const relationships = world.memories.filter(memory => memory.inspiredBy && (memory.id === selectedId || memory.inspiredBy === selectedId || (foundIds.includes(memory.id) && foundIds.includes(memory.inspiredBy))));
  const latestPaint = world.events.find(event => event.kind === "paint" && !event.isSeed);

  return <div className={`world-board${pending ? " is-placing" : ""}${brush?.enabled ? " is-brushing" : ""}`} ref={board} role="region" aria-label="The shared Memory Box world" data-world-revision={world.revision} data-tool={brush?.enabled ? "brush" : "hand"}
    onPointerDown={event => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button,input,textarea,select,.canvas-overlay"))) return;
      const point = { x: event.clientX, y: event.clientY }; pointers.current.set(event.pointerId, point); event.currentTarget.setPointerCapture(event.pointerId); setGestureNotice("");
      if (pointers.current.size === 2) {
        stroke.current = []; draw();
        const [a, b] = [...pointers.current.values()], middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gesture.current = { kind: "pinch", start: middle, camera: { ...camera.current }, moved: true, distance: Math.hypot(b.x - a.x, b.y - a.y), anchor: screenToWorld(camera.current, localPoint(middle)) };
      } else if (pointers.current.size === 1) {
        const kind = brush?.enabled && !brush.disabled && !event.shiftKey && !event.altKey ? "paint" : "pan";
        gesture.current = { kind, start: point, camera: { ...camera.current }, moved: false }; stroke.current = [];
        if (kind === "paint") paintAt(point);
      }
    }}
    onPointerMove={event => {
      if (!pointers.current.has(event.pointerId)) return;
      const point = { x: event.clientX, y: event.clientY }; pointers.current.set(event.pointerId, point);
      const g = gesture.current;
      if (!g) return;
      if (g.kind === "pinch" && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()], middle = localPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const next = zoomCameraAt(g.camera, Math.hypot(b.x - a.x, b.y - a.y) / Math.max(g.distance!, 1), localPoint(g.start));
        camera.current = { x: middle.x - g.anchor!.x * next.z, y: middle.y - g.anchor!.y * next.z, z: next.z }; applyCamera();
      } else if (g.kind === "paint") paintAt(point);
      else { const dx = point.x - g.start.x, dy = point.y - g.start.y; g.moved ||= Math.hypot(dx, dy) > 5; camera.current = { ...g.camera, x: g.camera.x + dx, y: g.camera.y + dy }; applyCamera(); }
    }} onPointerUp={event => finish(event.pointerId, false)} onPointerCancel={event => finish(event.pointerId, true)} onLostPointerCapture={event => { if (pointers.current.has(event.pointerId)) finish(event.pointerId, true); }}>
    <canvas ref={canvas} className="world-pixels" aria-label="Shared pixel artwork, made by contributors" role="img" />
    <div className="world-transformed" ref={transformed}>
      <svg className="memory-threads" width="1200" height="720" aria-hidden="true">{relationships.map(memory => {
        const original = memoryMap.get(memory.inspiredBy!);
        if (!original) return null;
        const a = memorySize(original), b = memorySize(memory), x1 = original.x + a.width / 2, y1 = original.y + a.height, x2 = memory.x + b.width / 2, y2 = memory.y + b.height;
        return <path key={memory.id} d={`M${x1},${y1} C${x1},${Math.max(y1, y2) + 40} ${x2},${Math.max(y1, y2) + 40} ${x2},${y2}`} />;
      })}</svg>
      {SCENES.map(scene => <button type="button" className={`scene-label${activeScene === scene.id ? " is-current" : ""}`} key={scene.id} style={{ left: SCENE_LABELS[scene.id].x, top: SCENE_LABELS[scene.id].y }} onClick={() => onScene(scene.id)}>{scene.title}<ArrowUpRight size={13} /></button>)}
      {world.memories.map(memory => <MemoryCard key={memory.id} memory={memory} selected={selectedId === memory.id} number={foundIds.includes(memory.id) ? foundIds.indexOf(memory.id) + 1 : undefined} dimmed={foundIds.length > 0 && !foundIds.includes(memory.id)} parentName={memory.inspiredBy ? memoryMap.get(memory.inspiredBy)?.authorName : undefined} onOpen={() => { if (!pending && !brush?.enabled) onOpen(memory.id); }} />)}
      {pending?.memory ? <MemoryCard memory={pending.memory} pending parentName={pending.memory.inspiredBy ? memoryMap.get(pending.memory.inspiredBy)?.authorName : undefined} /> : null}
    </div>
    <span className="world-coordinate canvas-overlay" ref={coordinate} aria-label="Coordinates of the center of the view" />
    <span className="canvas-guidance canvas-overlay">{gestureNotice || (zoom < 15 ? "Overview · tap a memory pin or zoom in" : brush?.enabled ? "Draw pixels · pinch to zoom · Shift + drag to pan" : pending ? "Tap to place · drag to explore" : "Drag to wander · pinch to zoom")}</span>
    {children}
    <div className="canvas-minimap canvas-overlay" aria-hidden="true"><svg viewBox="0 0 1200 720"><rect x="80" y="380" width="210" height="170" fill="#EAC8DC" /><rect x="360" y="240" width="430" height="230" fill="#CEC3EF" /><rect x="940" y="280" width="210" height="110" fill="#EEDB9C" /><rect ref={miniView} className="minimap-viewport" fill="#3659DB0A" stroke="#6D86DE" strokeWidth="12" /></svg></div>
    <div className="canvas-zoom canvas-overlay">
      <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out"><Minus size={17} /></button><span>{zoom}%</span><button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in"><Plus size={17} /></button><span className="zoom-divider" />
      <button type="button" onClick={entryView} aria-label="Return to the commons"><Maximize2 size={16} /></button><button type="button" onClick={() => setPanOpen(!panOpen)} aria-label="Move the view" aria-expanded={panOpen}><Compass size={17} /></button>
      {panOpen ? <div className="pan-controls"><button type="button" aria-label="Pan up" onClick={() => move(0, 100)}><ArrowUp size={17} /></button><button type="button" aria-label="Pan left" onClick={() => move(100, 0)}><ArrowLeft size={17} /></button><button type="button" aria-label="Pan down" onClick={() => move(0, -100)}><ArrowDown size={17} /></button><button type="button" aria-label="Pan right" onClick={() => move(-100, 0)}><ArrowRight size={17} /></button></div> : null}
    </div>
    <div className="canvas-footnote canvas-overlay">{latestPaint ? `@${latestPaint.authorName} · ${latestPaint.description}` : "A shared picture. Room for your next idea."}</div>
  </div>;
}
