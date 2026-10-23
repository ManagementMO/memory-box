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
    localStorage.clear();window.history.replaceState(null,"","/");
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

  const mobileResize=()=>{
    vi.spyOn(HTMLElement.prototype,"clientWidth","get").mockReturnValue(390);
    vi.spyOn(HTMLElement.prototype,"clientHeight","get").mockReturnValue(608);
    vi.stubGlobal("ResizeObserver",class{
      constructor(private callback:()=>void){}observe(element:HTMLElement){if(element.classList.contains("world-board"))this.callback();}disconnect(){}
    });
  };

  it("discloses phone view tools and returns focus after a preset or Escape",async()=>{
    mobileResize();await render({command:{key:0,type:"fit"}});
    const toggle=host.querySelector<HTMLButtonElement>('[aria-label="View controls"]');
    expect(toggle).not.toBeNull();expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector<HTMLElement>('#canvas-view-menu')?.hidden).toBe(true);
    expect(host.querySelector('[aria-label="Zoom in"]')?.closest('[hidden]')).not.toBeNull();
    await act(async()=>toggle!.click());
    const world=host.querySelector<HTMLButtonElement>('[aria-label="World view"]')!;
    expect(world).not.toBeNull();
    const board=host.querySelector<HTMLElement>('.world-board')!;
    const before={x:(195-Number(board.dataset.cameraX))/Number(board.dataset.cameraZoom),y:(304-Number(board.dataset.cameraY))/Number(board.dataset.cameraZoom)};
    await act(async()=>world.click());
    expect(board.dataset.zoomLevel).toBe("whole");expect(toggle!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
    expect((195-Number(board.dataset.cameraX))/Number(board.dataset.cameraZoom)).toBeCloseTo(before.x);
    expect((304-Number(board.dataset.cameraY))/Number(board.dataset.cameraZoom)).toBeCloseTo(before.y);
    await act(async()=>toggle!.click());
    await act(async()=>world.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
    expect(toggle!.getAttribute("aria-expanded")).toBe("false");expect(document.activeElement).toBe(toggle);
  });

  it("lets a valid shared link win over a stored return location on first resize",async()=>{
    mobileResize();
    localStorage.setItem("memory-box:canvas-view:v1",JSON.stringify({version:1,worldId:"commons",epoch:1,x:8000,y:3200,z:.7}));
    window.history.replaceState(null,"","#at=-3200,2400,0.9");
    await render({command:{key:0,type:"fit"}});
    const board=host.querySelector<HTMLElement>('.world-board')!;
    expect(Number(board.dataset.cameraZoom)).toBe(.9);
    expect((195-Number(board.dataset.cameraX))/.9).toBeCloseTo(-3200);
    expect((304-Number(board.dataset.cameraY))/.9).toBeCloseTo(2400);
  });

  it("keeps camera interaction working when browser view storage is blocked",async()=>{
    mobileResize();
    vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new DOMException("Blocked","SecurityError");});
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Full","QuotaExceededError");});
    await render({command:{key:0,type:"fit"}});
    await act(async()=>vi.advanceTimersByTime(600));
    const board=host.querySelector<HTMLElement>('.world-board')!;
    expect(Number(board.dataset.cameraZoom)).toBeGreaterThan(0);
    await render({command:{key:1,type:"restore",camera:{x:20,y:30,z:1,width:390,height:608}}});
    expect(board.dataset.cameraX).toBe("20");expect(board.dataset.cameraY).toBe("30");
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

  it("does not publish retained preview pixels as a fresh stroke on hover, pan or tool return",async()=>{
    const onCursor=vi.fn(),onChange=vi.fn();
    const brush={enabled:true,disabled:false,color:"#123456",cells:[],onChange};
    await render({onCursor,brush});
    const board=host.querySelector<HTMLElement>('.world-board')!;
    board.setPointerCapture=vi.fn();board.hasPointerCapture=()=>true;
    const pointer=async(type:string,x:number,y:number,shiftKey=false)=>{
      const event=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,shiftKey});
      Object.defineProperty(event,"pointerId",{value:1});
      await act(async()=>board.dispatchEvent(event));
    };
    await pointer("pointerdown",60,60);await pointer("pointermove",66,60);await pointer("pointerup",66,60);
    expect(onCursor.mock.calls.some(([update])=>update.stroke.length>0)).toBe(true);
    const cells=onChange.mock.lastCall![0];expect(cells.length).toBeGreaterThan(0);
    await render({brush:{...brush,cells}});
    await act(async()=>vi.advanceTimersByTime(2200));
    await pointer("pointermove",8100,3050);
    expect(onCursor.mock.lastCall![0]).toMatchObject({x:8100,y:3050,tool:"paint",stroke:[]});
    await pointer("pointerdown",8200,3050,true);await pointer("pointermove",8250,3050,true);
    expect(onCursor.mock.lastCall![0].stroke).toEqual([]);
    await pointer("pointerup",8250,3050,true);
    await render({brush:{...brush,cells,enabled:false}});await render({brush:{...brush,cells}});
    expect(onCursor.mock.lastCall![0].stroke).toEqual([]);
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

  it("does not traverse distant persisted pixels when the local camera moves",async()=>{
    let reads=0;
    const pixels=Array.from({length:10000},(_,i)=>({get x(){reads++;return i===0?10:5000+i%100;},y:i===0?10:5000+Math.floor(i/100),color:"#123456"}));
    await render({world:{...props.world,pixels}});
    reads=0;context(".world-pixels").fillRect.mockClear();
    await render({command:{key:2,type:"restore",camera:{x:12,y:12,z:1,width:1200,height:900}}});
    expect(context(".world-pixels").fillRect).toHaveBeenCalledTimes(1);
    expect(reads).toBeLessThan(100);
  });
});
