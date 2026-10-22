"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Compass, Maximize2, Minus, Plus } from "./pixel-icons";
import { ToolButton } from "./tool-button";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Memory, Pixel, SceneId, WorldSnapshot } from "@/lib/types";
import { memorySize } from "@/lib/scenes";
import { CELL_MIN, CELL_MAX, GRID_SIZE } from "@/lib/world-bounds";
import { arrivalBounds, frameCamera, mergePaintCells, occupiedBounds, rasterLine, screenToWorld, storyCamera, zoomCameraAt, type Camera, type FramePoint, type Point } from "@/lib/client/canvas-geometry";
import type { CursorUpdate, LivePeer } from "@/lib/client/presence-state";
import { campusArrival } from "@/lib/client/campus-arrival";
import { CANVAS_LEVELS, canvasLevel, initialCampusCamera, presetCamera, type CanvasLevel } from "@/lib/client/canvas-levels";
import { MemoryCard } from "./memory-card";

export interface CameraView extends Camera { width: number; height: number }
export interface CameraCommand { key: number; type: "fit" | "focus" | "frame" | "restore"; points?: FramePoint[]; camera?: CameraView }
export interface PendingPlacement { kind: "paint" | "memory"; x: number; y: number; pixels?: Pixel[]; memory?: Memory }
export interface BrushState { enabled: boolean; color: string; cells: Pixel[]; disabled: boolean; onChange: (cells: Pixel[]) => void }
interface Gesture { kind: "pan" | "paint" | "pinch"; start: Point; camera: Camera; moved: boolean; memoryId?: string; previousCell?: Point; distance?: number; anchor?: Point }

export function WorldCanvas({ world, selectedId, foundIds, onOpen, pending, onPosition, command, brush, onCameraChange, peers = [], onCursor, children }: {
  world: WorldSnapshot; selectedId: string | null; foundIds: string[]; activeScene: SceneId; onScene: (id: SceneId) => void;
  onOpen: (id: string) => void; pending: PendingPlacement | null; onPosition: (x: number, y: number) => void; command: CameraCommand;
  brush?: BrushState; onCameraChange?: (camera: CameraView) => void; peers?: LivePeer[]; onCursor?: (update: CursorUpdate) => void; children?: React.ReactNode;
}) {
  const board = useRef<HTMLDivElement>(null), transformed = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), cursorCanvas = useRef<HTMLCanvasElement>(null);
  const coordinate = useRef<HTMLSpanElement>(null), cameraAnimation = useRef<number | null>(null), lastPointer = useRef<Point | null>(null);
  const camera = useRef<Camera>({ x: 0, y: 0, z: .8 });
  const viewport = useRef({ width: 0, height: 0 }), initialized = useRef(false);
  const pointers = useRef(new Map<number, Point>()), gesture = useRef<Gesture | null>(null), stroke = useRef<Pixel[]>([]);
  const suppressCardClickUntil = useRef(0);
  const latest = useRef({ world, pending, brush, onCameraChange, peers, onCursor });
  latest.current = { world, pending, brush, onCameraChange, peers, onCursor };
  const [zoom, setZoom] = useState(80), [level,setLevel] = useState<CanvasLevel>("wander"), [panOpen, setPanOpen] = useState(false), [gestureNotice, setGestureNotice] = useState("");

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
    // Presence is a temporary preview. Only /api/paint can save shared pixels.
    const now = Date.now();
    for (const peer of data.peers) if (peer.tool === "paint" && peer.stroke?.length) {
      const opacity = .42 * Math.max(0, 1 - (now - peer.updatedAt) / 5000);
      if (opacity) paint(peer.stroke.slice(0, 128), opacity);
    }
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
    const cursorTarget = cursorCanvas.current, cursors = cursorTarget?.getContext("2d");
    if (!cursorTarget || !cursors) return;
    if (cursorTarget.width !== target.width || cursorTarget.height !== target.height) { cursorTarget.width = target.width; cursorTarget.height = target.height; }
    cursors.setTransform(1, 0, 0, 1, 0, 0); cursors.clearRect(0, 0, cursorTarget.width, cursorTarget.height); cursors.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!data.peers.length) return;
    const cursorFont = `500 11px ${getComputedStyle(element).fontFamily}`;
    for (const peer of data.peers) {
      const x = peer.x * c.z + c.x, y = peer.y * c.z + c.y, age = Math.max(0, now - peer.updatedAt);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width || y > height || age > 12_000) continue;
      cursors.save(); cursors.translate(x, y); cursors.globalAlpha = age > 7000 ? .55 : 1;
      cursors.fillStyle = peer.color; cursors.strokeStyle = "#FFFFFF"; cursors.lineWidth = 1.6;
      cursors.beginPath(); cursors.moveTo(0, 0); cursors.lineTo(3, 0); cursors.lineTo(3, 3); cursors.lineTo(6, 3); cursors.lineTo(6, 6); cursors.lineTo(9, 6); cursors.lineTo(9, 9); cursors.lineTo(12, 9); cursors.lineTo(12, 12); cursors.lineTo(7, 12); cursors.lineTo(7, 16); cursors.lineTo(4, 16); cursors.lineTo(4, 20); cursors.lineTo(0, 20); cursors.closePath(); cursors.fill(); cursors.stroke();
      const action = peer.tool === "paint" ? " · painting" : peer.tool === "note" ? " · adding a note" : "";
      const label = `${peer.name}${c.z > .35 ? action : ""}`;
      cursors.font = cursorFont;
      const labelWidth = Math.min(cursors.measureText(label).width + 16, Math.max(60, width - 16));
      const preferredX = x + labelWidth + 12 > width ? x - labelWidth + 6 : x + 9;
      const lx = Math.max(4, Math.min(width - labelWidth - 4, preferredX)) - x, ly = y + 48 > height ? -30 : 21;
      cursors.fillStyle = peer.color; cursors.beginPath(); cursors.roundRect(lx, ly, labelWidth, 25, 8); cursors.fill(); cursors.stroke();
      cursors.fillStyle = "#FFFFFF"; cursors.fillText(label, lx + 8, ly + 16, labelWidth - 16); cursors.restore();
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
      transformed.current.dataset.level = canvasLevel(z);
    }
    element.dataset.cameraX = String(x); element.dataset.cameraY = String(y); element.dataset.cameraZoom = String(z);
    element.dataset.zoomLevel = canvasLevel(z);setLevel(canvasLevel(z));
    element.style.setProperty("--grid-x", `${x}px`); element.style.setProperty("--grid-y", `${y}px`);
    const center = screenToWorld(camera.current, { x: element.clientWidth / 2, y: element.clientHeight / 2 });
    if (coordinate.current) coordinate.current.textContent = `x ${Math.round(center.x).toLocaleString()} · y ${Math.round(center.y).toLocaleString()}`;
    viewport.current = { width: element.clientWidth, height: element.clientHeight };
    latest.current.onCameraChange?.({ ...camera.current, ...viewport.current });
    setZoom(z < .01 ? Math.round(z * 1000) / 10 : Math.round(z * 100)); draw();
  }, [draw]);

  const stopCamera = useCallback(() => {
    if (cameraAnimation.current !== null) cancelAnimationFrame(cameraAnimation.current);
    cameraAnimation.current = null;
  }, []);
  const animateCamera = useCallback((target: Camera, animate = true) => {
    stopCamera();
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { camera.current = target; applyCamera(); return; }
    const start = { ...camera.current }, began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / 650), eased = 1 - (1 - progress) ** 4;
      camera.current = { x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased, z: start.z + (target.z - start.z) * eased };
      applyCamera();
      cameraAnimation.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    cameraAnimation.current = requestAnimationFrame(step);
  }, [applyCamera, stopCamera]);
  const framePoints = useCallback((points: FramePoint[], single = false) => {
    const element = board.current;
    if (!element || !points.length) return;
    const size = { width: element.clientWidth, height: element.clientHeight };
    animateCamera(single ? storyCamera(points, size) : frameCamera(points, size, { padding: 42, maxZoom: 1 }));
  }, [animateCamera]);

  const entryView = useCallback((animate = true, closerMobile = false) => {
    const element = board.current;
    if (!element) return;
    const occupied = (closerMobile?campusArrival(latest.current.world.memories):null) ?? (closerMobile ? arrivalBounds : occupiedBounds)(latest.current.world.memories.map(memory => ({ ...memory, ...memorySize(memory) })), latest.current.world.pixels, GRID_SIZE);
    const size = { width: element.clientWidth, height: element.clientHeight };
    const campus=closerMobile?initialCampusCamera(latest.current.world.memories,size):null;
    if(campus){animateCamera(campus,animate);return;}
    let target = frameCamera([occupied ?? { x: 0, y: 0, width: 1200, height: 720 }], size, { padding: element.clientWidth < 700 ? 24 : 48, maxZoom: .85 });
    if (closerMobile) target = zoomCameraAt(target, size.width < 700 ? 1.65 : Math.min(1.5, .85 / target.z), { x: size.width / 2, y: size.height / 2 });
    animateCamera(target, animate);
  }, [animateCamera]);

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      stopCamera();
      if (!initialized.current) { initialized.current = true; entryView(false, true); }
      else {
        camera.current.x += (element.clientWidth - viewport.current.width) / 2;
        camera.current.y += (element.clientHeight - viewport.current.height) / 2;
        applyCamera();
      }
    });
    observer.observe(element);
    return () => { observer.disconnect(); stopCamera(); };
  }, [applyCamera, entryView, stopCamera]);

  useEffect(() => {
    if (command.type === "restore" && command.camera && board.current) {
      animateCamera({ ...command.camera, x: command.camera.x + (board.current.clientWidth - command.camera.width) / 2, y: command.camera.y + (board.current.clientHeight - command.camera.height) / 2 });
    } else if (command.type === "fit" || command.key === 0) entryView(command.key !== 0, command.key === 0);
    else if (command.points?.length) framePoints(command.points, command.type === "focus");
  }, [command, entryView, framePoints, animateCamera]);

  useEffect(() => { draw(); }, [world.pixels, pending, brush?.cells, brush?.enabled, peers, draw]);
  useEffect(() => {
    if (!peers.length) return;
    const timer = setInterval(draw, 500);
    return () => clearInterval(timer);
  }, [peers.length, draw]);
  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest(".canvas-overlay")) return;
      event.preventDefault();
      stopCamera();
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        camera.current = zoomCameraAt(camera.current, Math.exp(-event.deltaY * .008), { x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else { camera.current.x -= event.deltaX; camera.current.y -= event.deltaY; }
      applyCamera();
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [applyCamera, stopCamera]);

  const zoomBy = (multiplier: number) => {
    if (!board.current) return;
    animateCamera(zoomCameraAt(camera.current, multiplier, { x: board.current.clientWidth / 2, y: board.current.clientHeight / 2 }));
  };
  const move = (x: number, y: number) => animateCamera({ ...camera.current, x: camera.current.x + x, y: camera.current.y + y });
  const localPoint = (point: Point) => { const rect = board.current!.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; };
  const publishPointer = useCallback((point: Point, preview?: Pixel[]) => {
    const element = board.current, data = latest.current;
    if (!element || !data.onCursor) return;
    const rect = element.getBoundingClientRect(), worldPoint = screenToWorld(camera.current, { x: point.x - rect.left, y: point.y - rect.top });
    const tool = data.brush?.enabled || data.pending?.kind === "paint" ? "paint" : data.pending?.kind === "memory" ? "note" : "wander";
    const cells = tool === "paint" ? preview ?? mergePaintCells(data.brush?.cells ?? [], stroke.current) : [];
    data.onCursor({ ...worldPoint, tool, stroke: cells.slice(-128) });
  }, []);
  useEffect(() => {
    if (lastPointer.current) publishPointer(lastPointer.current);
  }, [brush?.cells, brush?.enabled, pending, publishPointer]);
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
    if (board.current) delete board.current.dataset.gesture;
    const g = gesture.current, point = pointers.current.get(pointerId);
    if (g?.moved) suppressCardClickUntil.current = performance.now() + 500;
    pointers.current.delete(pointerId);
    if (!pointers.current.size) {
      if (g?.kind === "paint" && !cancelled && latest.current.brush && !latest.current.brush.disabled) {
        const cells = mergePaintCells(latest.current.brush.cells, stroke.current);
        latest.current.brush.onChange(cells);
        if (point) publishPointer(point, cells);
      } else if (point) publishPointer(point, latest.current.brush?.cells ?? []);
      if (g?.kind === "pan" && !g.moved && !cancelled && point && pending) { const worldPoint = screenToWorld(camera.current, localPoint(point)); onPosition(worldPoint.x, worldPoint.y); }
      gesture.current = null; stroke.current = []; draw();
    } else { gesture.current = null; stroke.current = []; draw(); }
  };

  const memoryMap = new Map(world.memories.map(memory => [memory.id, memory]));
  const relationships = world.memories.filter(memory => memory.inspiredBy && (memory.id === selectedId || memory.inspiredBy === selectedId || (foundIds.includes(memory.id) && foundIds.includes(memory.inspiredBy))));
  const latestPaint = world.events.find(event => event.kind === "paint" && !event.isSeed);

  return <div className={`world-board${pending ? " is-placing" : ""}${brush?.enabled ? " is-brushing" : ""}`} ref={board} role="region" aria-label="The shared Memory Box world" data-world-revision={world.revision} data-tool={brush?.enabled ? "brush" : "hand"}
    onClickCapture={event => {
      // A drag may still synthesize a click in some pointer implementations.
      // Native keyboard activation has detail=0 and always opens its original.
      if (event.detail !== 0 && performance.now() < suppressCardClickUntil.current && event.target instanceof Element && event.target.closest(".memory-card")) { event.preventDefault(); event.stopPropagation(); }
    }}
    onPointerDown={event => {
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>(".memory-card[data-memory-id]") : null;
      if (event.button !== 0 || (event.target instanceof Element && (event.target.closest("input,textarea,select,.canvas-overlay") || (!card && event.target.closest("button"))))) return;
      stopCamera();
      suppressCardClickUntil.current = 0;
      const point = { x: event.clientX, y: event.clientY }; pointers.current.set(event.pointerId, point); setGestureNotice("");
      // Capture only after a card drag crosses the threshold. A short tap stays
      // on the native button and opens once through its normal click handler.
      if (!card) event.currentTarget.setPointerCapture(event.pointerId);
      lastPointer.current = point;
      if (pointers.current.size === 2) {
        for (const pointerId of pointers.current.keys()) event.currentTarget.setPointerCapture(pointerId);
        stroke.current = []; draw();
        const [a, b] = [...pointers.current.values()], middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gesture.current = { kind: "pinch", start: middle, camera: { ...camera.current }, moved: true, distance: Math.hypot(b.x - a.x, b.y - a.y), anchor: screenToWorld(camera.current, localPoint(middle)) };
      } else if (pointers.current.size === 1) {
        const kind = brush?.enabled && !brush.disabled && !event.shiftKey && !event.altKey ? "paint" : "pan";
        event.currentTarget.dataset.gesture = kind;
        gesture.current = { kind, start: point, camera: { ...camera.current }, moved: false, memoryId: card?.dataset.memoryId }; stroke.current = [];
        if (kind === "paint") paintAt(point);
      }
      publishPointer(point);
    }}
    onPointerMove={event => {
      if (event.target instanceof Element && event.target.closest("input,textarea,select,.canvas-overlay")) return;
      const point = { x: event.clientX, y: event.clientY }; lastPointer.current = point;
      if (!pointers.current.has(event.pointerId)) { publishPointer(point); return; }
      pointers.current.set(event.pointerId, point);
      const g = gesture.current;
      if (!g) { publishPointer(point); return; }
      if (g.kind === "pinch" && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()], middle = localPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const next = zoomCameraAt(g.camera, Math.hypot(b.x - a.x, b.y - a.y) / Math.max(g.distance!, 1), localPoint(g.start));
        camera.current = { x: middle.x - g.anchor!.x * next.z, y: middle.y - g.anchor!.y * next.z, z: next.z }; applyCamera();
      } else if (g.kind === "paint") paintAt(point);
      else {
        const dx = point.x - g.start.x, dy = point.y - g.start.y;
        g.moved ||= Math.hypot(dx, dy) > 5;
        if (g.moved && g.memoryId && !event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
        camera.current = { ...g.camera, x: g.camera.x + dx, y: g.camera.y + dy }; applyCamera();
      }
      publishPointer(point);
    }} onPointerUp={event => finish(event.pointerId, false)} onPointerCancel={event => finish(event.pointerId, true)} onLostPointerCapture={event => { if (event.target === event.currentTarget && pointers.current.has(event.pointerId)) finish(event.pointerId, true); }}>
    <canvas ref={canvas} className="world-pixels" aria-label="Shared pixel artwork, made by contributors" role="img" />
    <div className="world-transformed" ref={transformed}>
      <svg className="memory-threads" width="1200" height="720" aria-hidden="true">{relationships.map(memory => {
        const original = memoryMap.get(memory.inspiredBy!);
        if (!original) return null;
        const a = memorySize(original), b = memorySize(memory), x1 = original.x + a.width / 2, y1 = original.y + a.height, x2 = memory.x + b.width / 2, y2 = memory.y + b.height;
        return <path key={memory.id} d={`M${x1},${y1} C${x1},${Math.max(y1, y2) + 40} ${x2},${Math.max(y1, y2) + 40} ${x2},${y2}`} />;
      })}</svg>
      {world.memories.map(memory => <MemoryCard key={memory.id} memory={memory} selected={selectedId === memory.id} number={foundIds.includes(memory.id) ? foundIds.indexOf(memory.id) + 1 : undefined} dimmed={foundIds.length > 0 && !foundIds.includes(memory.id)} parentName={memory.inspiredBy ? memoryMap.get(memory.inspiredBy)?.authorName : undefined} onOpen={() => { if (!pending && !brush?.enabled) onOpen(memory.id); }} />)}
      {pending?.memory ? <MemoryCard memory={pending.memory} pending parentName={pending.memory.inspiredBy ? memoryMap.get(pending.memory.inspiredBy)?.authorName : undefined} /> : null}
    </div>
    <canvas ref={cursorCanvas} className="world-cursors" aria-hidden="true" data-peer-cursors={JSON.stringify(peers.slice(0, 100).map(({ sessionId, x, y, color, tool }) => ({ sessionId, x, y, color, tool })))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 11 }} />
    <span className="world-coordinate canvas-overlay" ref={coordinate} aria-label="Coordinates of the center of the view" />
    <span className="canvas-guidance canvas-overlay">{gestureNotice || (zoom < 15 ? "The whole mosaic · zoom into a fragment" : brush?.enabled ? "Draw a preview · pinch to zoom · Shift + drag to pan" : pending ? "Tap to place · drag to explore" : "Drag to wander · pinch to zoom")}</span>
    {children}
    <div className="canvas-levels canvas-overlay" role="group" aria-label="Canvas zoom levels">
      {CANVAS_LEVELS.map(option=><button type="button" key={option.id} aria-label={option.description} aria-pressed={level===option.id} onClick={()=>{const element=board.current;if(element)animateCamera(presetCamera(camera.current,{width:element.clientWidth,height:element.clientHeight},option.id));}}>{option.label}</button>)}
    </div>
    <div className="canvas-zoom canvas-overlay">
      <ToolButton onClick={() => zoomBy(1 / 1.25)} label="Zoom out"><Minus size={24} /></ToolButton><span>{zoom}%</span><ToolButton onClick={() => zoomBy(1.25)} label="Zoom in"><Plus size={24} /></ToolButton><span className="zoom-divider" />
      <ToolButton onClick={() => entryView()} label="See the whole mosaic"><Maximize2 size={24} /></ToolButton><ToolButton onClick={() => setPanOpen(!panOpen)} label="Move the view" aria-expanded={panOpen}><Compass size={24} /></ToolButton>
      {panOpen ? <div className="pan-controls"><button type="button" aria-label="Pan up" onClick={() => move(0, 100)}><ArrowUp size={17} /></button><button type="button" aria-label="Pan left" onClick={() => move(100, 0)}><ArrowLeft size={17} /></button><button type="button" aria-label="Pan down" onClick={() => move(0, -100)}><ArrowDown size={17} /></button><button type="button" aria-label="Pan right" onClick={() => move(-100, 0)}><ArrowRight size={17} /></button></div> : null}
    </div>
    <div className="canvas-footnote canvas-overlay">{latestPaint ? `@${latestPaint.authorName} · ${latestPaint.description}` : "A shared picture. Room for your next idea."}</div>
  </div>;
}
