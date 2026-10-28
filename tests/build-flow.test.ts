// @vitest-environment jsdom
import {act,createElement,Fragment,type ComponentProps,type ReactNode} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {Memory,WorldSnapshot} from "../src/lib/types";
import type {WorldCanvas} from "../src/components/world-canvas";
import {MemoryBoxApp} from "../src/components/memory-box-app";
import {WATERLOO_LANDMARKS} from "../src/lib/waterloo-landmarks";
import {LIVING_LANDMARKS} from "../src/lib/living-landmarks";
import {recoveryLocks} from "./helpers/recovery-locks";

const harness=vi.hoisted(()=>({world:null as WorldSnapshot|null,canvas:null as ComponentProps<typeof WorldCanvas>|null,api:vi.fn(),refresh:vi.fn()}));
vi.mock("../src/lib/client/use-world",()=>({useWorld:()=>({world:harness.world,identity:{id:"author",name:"Visitor"},connection:"live",refresh:harness.refresh,retry:()=>{},setIdentity:()=>{}})}));
vi.mock("../src/lib/client/use-presence",()=>({usePresence:()=>({peers:[],visitors:[],connected:true,publish:()=>{}})}));
vi.mock("../src/lib/client/use-paint-turn",()=>({usePaintTurn:()=>({seconds:0,known:true,accept:()=>{},rejected:()=>{}})}));
vi.mock("../src/lib/client/api",()=>({api:(...args:unknown[])=>harness.api(...args),uploadImage:vi.fn()}));
vi.mock("../src/components/tool-button",()=>({
  ToolHints:({children}:{children:ReactNode})=>createElement(Fragment,null,children),
  ToolButton:({label,children,...props}:{label:string;children:ReactNode})=>createElement("button",{...props,"aria-label":label},children),
}));
vi.mock("../src/components/world-canvas",()=>({WorldCanvas:(props:ComponentProps<typeof WorldCanvas>)=>{
  harness.canvas=props;return createElement("div",null,createElement("button",{className:"world-location","aria-label":"Open world map",onClick:props.onWorldMap},"Map"),props.children,props.floating?.content);
}}));

const invitation=(id:string,x:number):Memory=>({id,authorId:"owner",authorName:"Someone",type:"text",title:`Build ${id}`,body:"Help make an outfit.",url:null,imageUrl:null,color:"#FFF3BF",x,y:300,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:false,isBuildInvitation:true});
describe("build tool source and destination",()=>{
  let host:HTMLDivElement,root:Root;
  const click=async(selector:string)=>{const button=host.querySelector<HTMLButtonElement>(selector);expect(button,selector).not.toBeNull();await act(async()=>button!.click());};
  const join=async(id:string)=>{await click('[aria-label="Build together"]');await click(`.open-build-list [data-source-id="${id}"]`);};
  beforeEach(async()=>{
    localStorage.clear();
    vi.stubGlobal("navigator",{locks:recoveryLocks(),onLine:true,userAgent:"jsdom",webdriver:true});
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
    vi.stubGlobal("matchMedia",()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}}));
    vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(null);
    harness.world={worldId:"commons",revision:1,epoch:1,width:120000,height:120000,gridSize:6,paintingPaused:false,pixels:[],events:[],memories:[invitation("a",400),invitation("b",4000)]};
    harness.api.mockReset();harness.api.mockResolvedValue({operationId:"paint-at-a"});harness.refresh.mockResolvedValue(harness.world);
    host=document.createElement("div");document.body.append(host);root=createRoot(host);
    await act(async()=>root.render(createElement(MemoryBoxApp)));
    harness.canvas!.onCameraChange?.({x:0,y:0,z:1,width:1440,height:844});
  });
  afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

  it("attaches a thought to the build of its accepted paint, even after visiting another build",async()=>{
    await join("a");await click(".build-workbench .button-primary");
    await act(async()=>harness.canvas!.brush!.onChange([{x:100,y:100,color:"#F3617C"}]));
    await click(".paint-actions .button-primary");
    expect(harness.api).toHaveBeenCalledTimes(1);
    await join("b");await click(".build-workbench .button-primary");
    await click(".paint-state .button-secondary");
    const source=host.querySelector(".composer .lineage button");
    expect(source?.textContent).toContain("Build a");
    expect(source?.textContent).not.toContain("Build b");
  });

  it.each([0,1,2])("takes preset action %i to the advertised place after the visitor has wandered elsewhere",async(index)=>{
    harness.canvas!.onCameraChange?.({x:28000,y:-28000,z:1,width:1440,height:844});
    await click('[aria-label="Build together"]');
    const place=[...WATERLOO_LANDMARKS,...LIVING_LANDMARKS].find(landmark=>landmark.title===host.querySelector(".together-panel .panel-lead")?.textContent)!;
    expect(place).toBeDefined();
    await click(`.together-panel .panel-actions button:nth-child(${index+1})`);
    expect(harness.canvas!.command.type).toBe("frame");
    expect(harness.canvas!.command.points).toEqual([{x:place.x,y:place.y,width:place.width,height:place.height}]);
    expect(harness.canvas!.activeScene).toBe(place.sceneId);
  });

  it("opens an actual world map and visits a different real neighborhood",async()=>{
    await click('[aria-label="Explore canvas"]');
    expect(host.querySelector('.world-map-panel')).not.toBeNull();
    await click('.world-place-list [data-place-id="waterloo"]');
    expect(host.querySelector('.world-map-panel')).toBeNull();
    expect(harness.canvas!.command.type).toBe("frame");
    const destination=harness.canvas!.command.points![0];
    expect(destination.x).toBeGreaterThan(3000);expect(destination.x).toBeLessThan(4100);
  });

  it("returns focus to Map after closing an actual new-original activity preview",async()=>{
    vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>{callback(0);return 1;});
    vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({x:0,y:0,width:44,height:44,top:0,right:44,bottom:44,left:0,toJSON(){return {};}});
    harness.world={...harness.world!,revision:2,memories:[...harness.world!.memories,invitation("c",8000)]};
    await act(async()=>root.render(createElement(MemoryBoxApp)));
    await click('[aria-label="Explore canvas"]');await click('.world-place-activity');
    expect(host.querySelector('.story-peek')?.getAttribute('data-story-id')).toBe("c");
    await click('[aria-label="Close story preview"]');
    expect(document.activeElement).toBe(host.querySelector('.world-location'));
  });

  it("starts a place on open ground as an unpublished invitation",async()=>{
    await click('[aria-label="Explore canvas"]');
    await click('[aria-label="Start a place"]');
    expect(harness.api).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLInputElement>('.build-invitation-toggle input')?.checked).toBe(true);
    expect(harness.canvas!.command.type).toBe("frame");
    const destination=harness.canvas!.command.points![0];
    expect([400,4000].every(x=>Math.abs(destination.x-x)>250||Math.abs(destination.y-300)>250)).toBe(true);
  });

  it("can start a place after opening and closing an untouched note",async()=>{
    await click('[aria-label="Leave"]');
    await click('[aria-label="Close panel"]');
    await click('[aria-label="Explore canvas"]');
    await click('[aria-label="Start a place"]');
    expect(host.querySelector<HTMLInputElement>('.build-invitation-toggle input')?.checked).toBe(true);
    expect(harness.canvas!.command.type).toBe("frame");
    expect(harness.api).not.toHaveBeenCalled();
  });

  it("keeps a source-linked draft even before any words are typed",async()=>{
    await join("a");await click('.build-tools .button:nth-child(2)');
    await click('[aria-label="Close panel"]');await click('[aria-label="Explore canvas"]');
    await click('[aria-label="Start a place"]');
    expect(host.querySelector('.composer .lineage button')?.textContent).toContain("Build a");
    expect(host.querySelector<HTMLInputElement>('.build-invitation-toggle input')?.checked).toBe(false);
    expect(harness.api).not.toHaveBeenCalled();
  });

  it("resumes a parked contribution instead of replacing it with a new place",async()=>{
    await join("a");await click('.build-tools .button:nth-child(2)');
    // Use the real controlled textarea so the retained draft is app state.
    const textarea=host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')!;
    expect(textarea).not.toBeNull();
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(textarea,"A draft I want to keep");textarea.dispatchEvent(new Event("input",{bubbles:true}));});
    await click('[aria-label="Close panel"]');await click('[aria-label="Explore canvas"]');
    await click('[aria-label="Start a place"]');
    expect(host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')?.value).toBe("A draft I want to keep");
    expect(host.querySelector('.composer .lineage button')?.textContent).toContain("Build a");
    expect(harness.api).not.toHaveBeenCalled();
  });

  it("keeps written work when the photo dock is chosen",async()=>{
    await click('[aria-label="Leave"]');
    const textarea=host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(textarea,"Keep my unfinished note");textarea.dispatchEvent(new Event("input",{bubbles:true}));});
    await click('[aria-label="Close panel"]');await click('[aria-label="Leave a photo"]');
    expect(host.querySelector('.composer')?.getAttribute('data-kind')).toBe("text");
    expect(host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')?.value).toBe("Keep my unfinished note");
  });

  it("recovers a local note after reload only when Resume is chosen",async()=>{
    localStorage.clear();await click('[aria-label="Leave"]');
    const textarea=host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(textarea,"Train carriage in progress");textarea.dispatchEvent(new Event("input",{bubbles:true}));});
    await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(createElement(MemoryBoxApp)));
    expect(host.querySelector('.composer')).toBeNull();
    await click('[aria-label="Resume unfinished work"]');
    await click('.recovery-list .resume-recovery');
    expect(host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')?.value).toBe("Train carriage in progress");
    expect(harness.api).not.toHaveBeenCalled();
  });

  it("requires an explicit new-work choice after the world epoch changes",async()=>{
    await click('[aria-label="Leave"]');
    const textarea=host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(textarea,"Keep this work across a reset");textarea.dispatchEvent(new Event("input",{bubbles:true}));});
    harness.world={...harness.world!,epoch:2};await act(async()=>root.render(createElement(MemoryBoxApp)));
    await click('.composer button[type="submit"]');
    expect(host.querySelector<HTMLButtonElement>('.placement-bar .button-primary')?.disabled).toBe(true);
    await click('[aria-label="Use unfinished work in this world"]');
    expect(host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')?.value).toBe("Keep this work across a reset");
    await click('.composer button[type="submit"]');
    expect(host.querySelector<HTMLButtonElement>('.placement-bar .button-primary')?.disabled).toBe(false);
    expect(harness.api).not.toHaveBeenCalled();
  });

  it("does not copy a story snippet into a persistent bookmark name",async()=>{
    await act(async()=>harness.canvas!.onOpen("a"));
    await click('[aria-label="Your saved places"]');
    expect(host.querySelector<HTMLInputElement>('.save-place-form input')?.value).toBe("");
  });

  it("warns when a brush preview cannot be recovered locally while retaining its pixels",async()=>{
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("storage denied");});
    await click('[aria-label="Paint"]');
    await act(async()=>harness.canvas!.brush!.onChange([{x:20,y:30,color:"#F3617C"}]));
    expect(host.querySelector('.local-paint-status')?.textContent).toContain("Reloading can lose this preview");
    expect(harness.canvas!.brush!.cells).toEqual([{x:20,y:30,color:"#F3617C"}]);
  });

  it("collapses a request to source-bound tools and can restore the complete details",async()=>{
    await join("a");
    const toggle=host.querySelector<HTMLButtonElement>('[aria-label="Collapse build details"]');
    expect(toggle).not.toBeNull();toggle!.focus();await click('[aria-label="Collapse build details"]');
    expect(host.querySelector('.panel-build.is-build-compact')).not.toBeNull();
    expect(host.querySelector('.panel-header h2')?.textContent).toContain("Build a");
    expect(host.querySelector('.build-request')?.closest('[hidden]')).not.toBeNull();
    expect(host.querySelectorAll('.build-tools button')).toHaveLength(3);
    expect(document.activeElement?.getAttribute('aria-label')).toBe("Expand build details");
    await click('[aria-label="Expand build details"]');
    expect(host.querySelector('.panel-build.is-build-compact')).toBeNull();
    expect(host.querySelector('.build-request')?.closest('[hidden]')).toBeNull();
    expect(host.querySelector('.build-request')?.textContent).toBe("Help make an outfit.");
  });

  it("retains compact mode on a same-build tool return, but opens a different request in full",async()=>{
    await join("a");await click('[aria-label="Collapse build details"]');
    await click('.build-tools .button-primary');await click('.joined-build-return');
    expect(host.querySelector('.panel-build.is-build-compact')).not.toBeNull();
    expect(host.querySelector('.panel-header h2')?.textContent).toContain("Build a");
    await join("b");
    expect(host.querySelector('.panel-build.is-build-compact')).toBeNull();
    expect(host.querySelector('.build-request')?.closest('[hidden]')).toBeNull();
  });

  it.each(["text","image"])("resumes an unfinished compact-build %s instead of discarding it for the other tool",async(type)=>{
    vi.stubGlobal("URL",class extends URL {static createObjectURL=vi.fn(()=>"blob:parked-photo");static revokeObjectURL=vi.fn();});
    await join("a");await click('[aria-label="Collapse build details"]');
    await click(`.build-tools .button:nth-child(${type==="text"?2:3})`);
    const textarea=host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(textarea,"Keep this contribution");textarea.dispatchEvent(new Event("input",{bubbles:true}));});
    if(type==="image"){
      const input=host.querySelector<HTMLInputElement>('[aria-label="Choose image"]')!;
      Object.defineProperty(input,"files",{value:[new File(["image"],"outfit.png",{type:"image/png"})]});
      await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    }
    await click('[aria-label="Close panel"]');await join("a");
    expect(host.querySelector('.panel-build.is-build-compact')).not.toBeNull();
    await click(`.build-tools .button:nth-child(${type==="text"?3:2})`);
    expect(host.querySelector('.composer')?.getAttribute('data-kind')).toBe(type);
    expect(host.querySelector<HTMLTextAreaElement>('.composer-writing textarea')?.value).toBe("Keep this contribution");
    expect(host.querySelector('.composer .lineage button')?.textContent).toContain("Build a");
    if(type==="image"){
      expect(host.querySelector<HTMLImageElement>('.upload-box img')?.src).toBe("blob:parked-photo");
      expect(host.querySelector('.upload-filename')?.textContent).toBe("outfit.png");
    }
    expect(harness.api).not.toHaveBeenCalled();
  });

  it.each(["closed","removed"])("releases compact tools when their invitation is %s",async(state)=>{
    await join("a");await click('[aria-label="Collapse build details"]');
    harness.world={...harness.world!,memories:state==="closed"?harness.world!.memories.map(m=>m.id==="a"?{...m,isBuildInvitation:false,version:2}:m):harness.world!.memories.filter(m=>m.id!=="a")};
    await act(async()=>root.render(createElement(MemoryBoxApp)));
    expect(host.querySelector('.build-tools')).toBeNull();expect(host.querySelector('.build-unavailable')).not.toBeNull();
    expect(host.querySelector('[aria-label="Expand build details"]')).toBeNull();
  });
});
