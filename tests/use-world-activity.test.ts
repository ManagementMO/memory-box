// @vitest-environment jsdom
import {act,createElement,useMemo} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {Memory,WorldSnapshot} from "../src/lib/types";
import type {LivePeer} from "../src/lib/client/presence-state";
import {worldAreas} from "../src/lib/client/world-atlas";
import {useWorldActivity} from "../src/lib/client/use-world-activity";

const memory:Memory={id:"a",authorId:null,authorName:"Visitor",type:"text",title:"Moon lake",body:"A cheese boat.",url:null,imageUrl:null,color:"#FFE9AF",x:8000,y:3000,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:false};
function Probe({world,peers}:{world:WorldSnapshot;peers:LivePeer[]}){
  const areas=useMemo(()=>worldAreas(world.memories,world.pixels),[world]);
  return createElement("output",null,JSON.stringify(useWorldActivity(world,areas,peers)));
}
describe("activity lifecycle",()=>{
  let root:Root,host:HTMLDivElement,world:WorldSnapshot,peers:LivePeer[];
  const read=()=>JSON.parse(host.querySelector("output")!.textContent!);
  const render=async()=>{await act(async()=>root.render(createElement(Probe,{world,peers})));};
  beforeEach(()=>{
    vi.useFakeTimers();vi.setSystemTime(10000);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
    host=document.createElement("div");document.body.append(host);root=createRoot(host);
    world={worldId:"commons",revision:1,epoch:1,width:1200,height:720,gridSize:6,paintingPaused:false,pixels:[],events:[],memories:[]};peers=[];
  });
  afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
  it("expires an actual new original without a refresh and never replays it on a later poll",async()=>{
    await render();expect(read()).toEqual([]);
    world={...world,revision:2,memories:[memory]};await render();expect(read()[0].memoryId).toBe("a");
    await act(async()=>vi.advanceTimersByTime(12000));expect(read()).toEqual([]);
    world={...world};await render();expect(read()).toEqual([]);
    world={...world,revision:3};await render();expect(read()).toEqual([]);
  });
  it("expires real stroke presence without requiring a new cursor packet",async()=>{
    world={...world,memories:[memory]};peers=[{sessionId:"p",name:"Visitor",tool:"paint",x:8100,y:3050,stroke:[{x:1350,y:508,color:"#123456"}],color:"#8760BB",updatedAt:10000}];
    await render();expect(read()[0].kind).toBe("painting");
    await act(async()=>vi.advanceTimersByTime(2000));expect(read()).toEqual([]);
    peers=[{...peers[0],updatedAt:12000,stroke:[]}];await render();expect(read()).toEqual([]);
  });
  it("clears a removed source and treats a changed epoch as a quiet new baseline",async()=>{
    await render();world={...world,revision:2,memories:[memory]};await render();expect(read()).toHaveLength(1);
    world={...world,revision:3,memories:[]};await render();expect(read()).toEqual([]);
    world={...world,revision:4,epoch:2,memories:[memory]};await render();expect(read()).toEqual([]);
  });
});
