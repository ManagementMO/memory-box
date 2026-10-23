// @vitest-environment jsdom
import {act,createElement,type ComponentProps} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {WorldMap} from "../src/components/world-map";

function drawingContext(){
  return {setTransform:vi.fn(),clearRect:vi.fn(),fillRect:vi.fn(),strokeRect:vi.fn(),setLineDash:vi.fn(),imageSmoothingEnabled:false,fillStyle:"",strokeStyle:"",lineWidth:1,globalAlpha:1};
}

describe("world map artwork cache",()=>{
  let root:Root,host:HTMLDivElement,props:ComponentProps<typeof WorldMap>;
  let contexts:WeakMap<HTMLCanvasElement,ReturnType<typeof drawingContext>>;
  let onResize:()=>void,reads:number;
  const context=(selector:string)=>contexts.get(host.querySelector<HTMLCanvasElement>(selector)!)!;
  const render=async(changes:Partial<ComponentProps<typeof WorldMap>>={})=>{
    props={...props,...changes};await act(async()=>root.render(createElement(WorldMap,props)));
  };
  beforeEach(()=>{
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
    vi.stubGlobal("ResizeObserver",class{constructor(callback:()=>void){onResize=callback;}observe(){}disconnect(){}});
    vi.spyOn(HTMLElement.prototype,"clientWidth","get").mockReturnValue(280);
    vi.spyOn(HTMLElement.prototype,"clientHeight","get").mockReturnValue(180);
    contexts=new WeakMap();reads=0;
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockImplementation(function(this:HTMLCanvasElement){
      if(!contexts.has(this))contexts.set(this,drawingContext());
      return contexts.get(this) as unknown as CanvasRenderingContext2D;
    });
    host=document.createElement("div");document.body.append(host);root=createRoot(host);
    props={world:{worldId:"commons",revision:1,epoch:1,width:120000,height:120000,gridSize:6,paintingPaused:false,
      pixels:Array.from({length:17000},(_,index)=>({get x(){reads++;return index%170;},y:Math.floor(index/170),color:"#F5B8D4"})),memories:[],events:[]},
      areas:[],camera:{x:0,y:0,z:1,width:1200,height:900},onVisit:vi.fn(),onPoint:vi.fn(),onStart:vi.fn()};
  });
  afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

  it("moves the viewport without reading or redrawing 17,000 unchanged pixels",async()=>{
    await render();const artwork=context(".world-map-canvas");
    expect(artwork.fillRect).toHaveBeenCalledTimes(17000);
    reads=0;artwork.fillRect.mockClear();artwork.clearRect.mockClear();
    await render({camera:{...props.camera!,x:1}});
    expect(reads).toBe(0);expect(artwork.fillRect).not.toHaveBeenCalled();expect(artwork.clearRect).not.toHaveBeenCalled();
    const viewport=context(".world-map-viewport");
    expect(viewport.strokeRect).toHaveBeenCalled();
    const last=viewport.strokeRect.mock.lastCall;viewport.strokeRect.mockClear();
    await render({camera:{...props.camera!,x:100},onStart:vi.fn()});
    expect(viewport.strokeRect).toHaveBeenCalledTimes(1);expect(viewport.strokeRect.mock.lastCall).not.toEqual(last);
    expect(reads).toBe(0);expect(artwork.fillRect).not.toHaveBeenCalled();
  });

  it("refreshes artwork and viewport dimensions when content or map size changes",async()=>{
    await render();const artwork=context(".world-map-canvas");artwork.fillRect.mockClear();
    await render({world:{...props.world,revision:2,pixels:[...props.world.pixels,{x:180,y:120,color:"#123456"}]}});
    expect(artwork.fillRect).toHaveBeenCalledTimes(17001);
    artwork.fillRect.mockClear();
    vi.spyOn(HTMLElement.prototype,"clientWidth","get").mockReturnValue(320);
    vi.stubGlobal("devicePixelRatio",2);
    await act(async()=>onResize());
    expect(artwork.fillRect).toHaveBeenCalledTimes(17001);
    expect(host.querySelector<HTMLCanvasElement>(".world-map-canvas")!.width).toBe(640);
    expect(host.querySelector<HTMLCanvasElement>(".world-map-viewport")!.width).toBe(640);
    expect(context(".world-map-viewport").strokeRect).toHaveBeenCalled();
  });

  it("shows navigable actual activity without redrawing cached artwork as markers or painters change",async()=>{
    const onSignal=vi.fn();
    const area={id:"place:0:0",title:"Moon lake",emblem:"flag" as const,color:"#FFE9AF",x:0,y:0,width:1200,height:720,memoryIds:[],pixelCount:17000,openBuilds:0};
    await render({areas:[area],onSignal});
    const artwork=context(".world-map-canvas");reads=0;artwork.fillRect.mockClear();
    const signal={id:"paint:1",areaId:area.id,x:400,y:300,kind:"paint" as const,expiresAt:22000};
    await render({signals:[signal]});
    const marker=host.querySelector<HTMLButtonElement>('.world-map-signal');expect(marker).not.toBeNull();
    expect(marker!.getAttribute('aria-label')).toBe("New pixels in Moon lake");
    await act(async()=>marker!.click());expect(onSignal).toHaveBeenCalledWith(signal);
    expect(reads).toBe(0);expect(artwork.fillRect).not.toHaveBeenCalled();
    await render({signals:[{...signal,id:"painting:1",kind:"painting",painters:2}]});
    expect(host.querySelector('.world-place-activity')?.textContent).toContain("2 painting");
    expect(reads).toBe(0);expect(artwork.fillRect).not.toHaveBeenCalled();
    await render({signals:[]});expect(host.querySelector('.world-map-signal')).toBeNull();
    expect(artwork.fillRect).not.toHaveBeenCalled();
  });
});
