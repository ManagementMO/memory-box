// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {Memory,WorldSnapshot} from "../src/lib/types";
import {useSavedPlaces} from "../src/lib/client/use-saved-places";
import {mutateSavedPlaces,savedPlacesJournalPrefix,savedPlacesKey} from "../src/lib/client/saved-places";

const memory:Memory={id:"a",authorId:null,authorName:"Visitor",type:"text",title:"Moon lake",body:"A cheese boat.",url:null,imageUrl:null,color:"#FFE9AF",x:0,y:0,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:false};
let actions:ReturnType<typeof useSavedPlaces>;
function Probe({world}:{world:WorldSnapshot|null}){actions=useSavedPlaces(world);return createElement("output",null,JSON.stringify({places:actions.places,status:actions.status,error:actions.error}));}

describe("saved places lifecycle",()=>{
  let root:Root,host:HTMLDivElement,world:WorldSnapshot;
  const render=async()=>{await act(async()=>root.render(createElement(Probe,{world})));};
  beforeEach(()=>{
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);window.localStorage.clear();
    host=document.createElement("div");document.body.append(host);root=createRoot(host);
    world={worldId:"commons",revision:1,epoch:1,width:120000,height:120000,gridSize:6,paintingPaused:false,pixels:[],events:[],memories:[memory]};
  });
  afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();window.localStorage.clear();});

  it("keeps unseen changes through polling and remounting until the visitor explicitly revisits",async()=>{
    await render();let id="";
    await act(async()=>{id=actions.save({x:100,y:100,z:1,originalId:"a"},"Moon corner")!.id;});
    world={...world,revision:2,memories:[{...memory,version:2},{...memory,id:"reply",inspiredBy:"a"}]};await render();
    expect(actions.places[0].changes).toMatchObject({changedOriginals:1,newReplies:1,hasChanges:true});
    world={...world,revision:3};await render();expect(actions.places[0].changes.hasChanges).toBe(true);
    await act(async()=>root.unmount());root=createRoot(host);await render();
    expect(actions.places[0].changes.hasChanges).toBe(true);
    await act(async()=>actions.visit(id));expect(actions.places[0].changes.hasChanges).toBe(false);
  });

  it("handles another tab's storage changes and never acknowledges them merely by rendering the list",async()=>{
    await render();mutateSavedPlaces(window.localStorage,world,{kind:"save",target:{x:100,y:100,z:1},label:"Other tab",id:"from-tab"},1000);
    const journalKey=Array.from({length:window.localStorage.length},(_,index)=>window.localStorage.key(index)).find(key=>key?.startsWith(savedPlacesJournalPrefix(world)))!;
    await act(async()=>window.dispatchEvent(new StorageEvent("storage",{key:journalKey})));
    expect(actions.places[0].label).toBe("Other tab");
    world={...world,revision:2,memories:[{...memory,version:2}]};await render();
    expect(actions.places[0].changes.changedOriginals).toBe(1);
    mutateSavedPlaces(window.localStorage,world,{kind:"remove",id:"from-tab"},2000);
    await act(async()=>window.dispatchEvent(new StorageEvent("storage",{key:journalKey})));
    expect(actions.places).toEqual([]);
  });

  it("does not leak old-epoch places into a reset world and can recover from corrupt local data on explicit save",async()=>{
    window.localStorage.setItem(savedPlacesKey(world),"{broken");await render();expect(actions.status).toBe("corrupt");
    await act(async()=>actions.save({x:100,y:100,z:1},"My place"));expect(actions.status).toBe("ready");expect(actions.places).toHaveLength(1);
    world={...world,epoch:2,revision:1};await render();expect(actions.places).toEqual([]);expect(actions.status).toBe("ready");
  });

  it("keeps the previous bookmark and its unseen changes when an acknowledgement cannot be stored",async()=>{
    await render();await act(async()=>actions.save({x:100,y:100,z:1},"My place"));
    world={...world,revision:2,memories:[{...memory,version:2}]};await render();
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Full","QuotaExceededError");});
    await act(async()=>actions.visit(actions.places[0].id));
    expect(actions.status).toBe("unavailable");expect(actions.places[0].changes.changedOriginals).toBe(1);
  });

  it("keeps the current local view when storage becomes unreadable during a visit",async()=>{
    await render();await act(async()=>actions.save({x:100,y:100,z:1},"My place"));
    world={...world,revision:2,memories:[{...memory,version:2}]};await render();
    const id=actions.places[0].id;
    vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new DOMException("Denied","SecurityError");});
    await act(async()=>actions.visit(id));
    expect(actions.status).toBe("unavailable");expect(actions.places[0].changes.changedOriginals).toBe(1);
  });
});
