// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LivePeer } from "../src/lib/client/presence-state";
import type { Memory } from "../src/lib/types";
import { WorldCanvas } from "../src/components/world-canvas";

vi.mock("../src/components/tool-button", () => ({
  ToolButton: ({ label, onClick }: { label: string; onClick: () => void }) => createElement("button", { onClick, "aria-label": label }),
}));

function drawingContext() {
  return {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
    roundRect: vi.fn(), fillText: vi.fn(), setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 70 })),
    imageSmoothingEnabled: false, fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
  };
}
const peer = (changes: Partial<LivePeer> = {}): LivePeer => ({
  sessionId: "synthetic-peer", name: "Visitor", color: "#8760BB", tool: "wander",
  x: 100, y: 100, updatedAt: Date.now(), ...changes,
});

describe("canvas redraw boundaries", () => {
  let root: Root, host: HTMLDivElement;
  let contexts: WeakMap<HTMLCanvasElement, ReturnType<typeof drawingContext>>;
  let props: ComponentProps<typeof WorldCanvas>;
  const context = (selector: string) => contexts.get(host.querySelector<HTMLCanvasElement>(selector)!)!;
  const render = async (changes: Partial<ComponentProps<typeof WorldCanvas>> = {}) => {
    props = { ...props, ...changes };
    await act(async () => root.render(createElement(WorldCanvas, props)));
  };
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1200);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(900);
    contexts = new WeakMap();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      if (!contexts.has(this)) contexts.set(this, drawingContext());
      return contexts.get(this) as unknown as CanvasRenderingContext2D;
    });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    props = {
      world: { worldId: "commons", revision: 1, epoch: 1, width: 120000, height: 120000, gridSize: 6, paintingPaused: false,
        pixels: Array.from({ length: 17000 }, (_, index) => ({ x: index % 170, y: Math.floor(index / 170), color: "#F5B8D4" })), memories: [], events: [] },
      selectedId: null, foundIds: [], activeScene: "pond", onScene: vi.fn(), onOpen: vi.fn(), pending: null, onPosition: vi.fn(),
      command: { key: 1, type: "restore", camera: { x: 0, y: 0, z: 1, width: 1200, height: 900 } }, peers: [],
    };
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove();
    vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });

  it("does not redraw 17,000 unchanged artwork cells when a cursor moves or ages", async () => {
    await render({ peers: [peer()] });
    const artwork = context(".world-pixels"), cursors = context(".world-cursors");
    expect(artwork.fillRect.mock.calls.length).toBeGreaterThanOrEqual(17000);
    artwork.fillRect.mockClear(); artwork.clearRect.mockClear(); cursors.clearRect.mockClear();
    await render({ peers: [peer({ x: 105 })] });
    expect(cursors.clearRect).toHaveBeenCalledTimes(1);
    expect(artwork.fillRect.mock.calls.length).toBe(0);
    expect(artwork.clearRect).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1500));
    expect(cursors.clearRect).toHaveBeenCalledTimes(4);
    expect(artwork.fillRect.mock.calls.length).toBe(0);
    await render({ peers: [] });
    expect(cursors.clearRect).toHaveBeenCalledTimes(5);
    expect(artwork.fillRect.mock.calls.length).toBe(0);
  });

  it("keeps drawing and clearing remote paint previews, including their existing fade timer", async () => {
    await render();
    const artwork = context(".world-pixels"); artwork.fillRect.mockClear();
    await render({ peers: [peer({ tool: "paint", stroke: [{ x: 3, y: 4, color: "#123456" }] })] });
    expect(artwork.fillRect).toHaveBeenCalledTimes(17001);
    expect(artwork.fillRect).toHaveBeenLastCalledWith(18, 24, 6, 6);
    artwork.fillRect.mockClear();
    await act(async () => vi.advanceTimersByTime(500));
    expect(artwork.fillRect).toHaveBeenCalledTimes(17001);
    artwork.fillRect.mockClear();
    await render({ peers: [peer({ tool: "paint", stroke: [] })] });
    expect(artwork.fillRect).toHaveBeenCalledTimes(17000);
    artwork.fillRect.mockClear();
    await act(async () => vi.advanceTimersByTime(500));
    expect(artwork.fillRect.mock.calls.length).toBe(0);
  });

  it("still redraws persisted artwork, local previews and camera changes", async () => {
    await render();
    const artwork = context(".world-pixels"); artwork.fillRect.mockClear();
    await render({ world: { ...props.world, pixels: [...props.world.pixels, { x: 180, y: 120, color: "#123456" }], revision: 2 } });
    expect(artwork.fillRect).toHaveBeenCalledTimes(17001);
    artwork.fillRect.mockClear();
    await render({ brush: { enabled: true, disabled: false, color: "#123456", cells: [{ x: 3, y: 4, color: "#123456" }], onChange: vi.fn() } });
    expect(artwork.fillRect).toHaveBeenCalledTimes(17002);
    artwork.fillRect.mockClear();
    await render({ command: { key: 2, type: "restore", camera: { x: 10, y: 20, z: 1, width: 1200, height: 900 } } });
    expect(artwork.fillRect.mock.calls.length).toBeGreaterThanOrEqual(17002);
    expect(artwork.fillRect).toHaveBeenLastCalledWith(28, 44, 6, 6);
    artwork.fillRect.mockClear();
    vi.stubGlobal("devicePixelRatio", 2);
    await render({ peers: [peer()] });
    expect(artwork.fillRect.mock.calls.length).toBeGreaterThanOrEqual(17002);
    expect(host.querySelector<HTMLCanvasElement>(".world-pixels")!.width).toBe(2400);
  });

  it("highlights real new versions briefly, while the initial snapshot stays still",async()=>{
    const memory={id:"original-a",version:1,type:"text",body:"An actual original",title:"",authorName:"Visitor",color:"#FFED9C",x:100,y:100} as Memory;
    await render({world:{...props.world,memories:[memory]}});
    expect(host.querySelector('.is-arriving')).toBeNull();
    await render({world:{...props.world,revision:2,memories:[{...memory,version:2}]}});
    expect(host.querySelector('.memory-card.is-arriving')?.getAttribute('data-memory-id')).toBe(memory.id);
    await render({world:{...props.world,memories:[{...memory,version:2}]}});
    await act(async()=>vi.advanceTimersByTime(1800));
    expect(host.querySelector('.is-arriving')).toBeNull();
  });
});
