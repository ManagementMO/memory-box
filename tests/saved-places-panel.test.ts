// @vitest-environment jsdom
import {act,createElement,type ComponentProps} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {SavedPlacesPanel} from "../src/components/saved-places-panel";
import {captureSavedPlace,compareSavedPlace,type SavedPlaceWithChanges} from "../src/lib/client/saved-places";
import type {WorldSnapshot} from "../src/lib/types";

describe("saved places panel",()=>{
  let host:HTMLDivElement,root:Root,props:ComponentProps<typeof SavedPlacesPanel>,place:SavedPlaceWithChanges,visits:string[],removals:string[],renames:string[];
  const render=async()=>{await act(async()=>root.render(createElement(SavedPlacesPanel,props)));};
  const button=(label:string)=>host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  beforeEach(()=>{
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);
    const world:WorldSnapshot={worldId:"commons",epoch:1,revision:1,width:120000,height:120000,gridSize:6,paintingPaused:false,pixels:[],memories:[],events:[]};
    const saved=captureSavedPlace(world,{x:100,y:200,z:.8},"Moon corner","a",1000);
    place={...saved,changes:{...compareSavedPlace(saved,world),newOriginals:2,newReplies:1,paintedCells:3,hasChanges:true}};
    visits=[];removals=[];renames=[];
    props={places:[place],status:"ready",onVisit:p=>{visits.push(p.id);},onRemove:id=>{removals.push(id);},onRename:(id,label)=>{renames.push(`${id}:${label}`);}};
  });
  afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});

  it("shows factual changes without visiting automatically, then follows an explicit destination click",async()=>{
    await render();expect(host.textContent).toContain("2 new nearby originals");expect(host.textContent).toContain("1 new build-on");expect(host.textContent).toContain("3 painted cells changed");expect(visits).toEqual([]);
    await act(async()=>button("Visit Moon corner").click());expect(visits).toEqual(["a"]);
  });

  it("lets a visitor edit a concise local label and cancel without renaming",async()=>{
    await render();await act(async()=>button("Rename Moon corner").click());
    const input=host.querySelector<HTMLInputElement>('input[aria-label="Place name"]')!;
    expect(input.maxLength).toBe(48);expect(document.activeElement).toBe(input);
    await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;setter.call(input,"My moon");input.dispatchEvent(new Event("input",{bubbles:true}));});
    await act(async()=>host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(renames).toEqual(["a:My moon"]);
    expect(document.activeElement).toBe(button("Rename Moon corner"));
    await act(async()=>button("Rename Moon corner").click());await act(async()=>button("Cancel rename").click());expect(renames).toHaveLength(1);
    await act(async()=>button("Remove Moon corner").click());expect(removals).toEqual(["a"]);
  });

  it("keeps a removed original visitable by geography without rendering cached story content",async()=>{
    place={...place,originalId:"deleted-original",changes:{...place.changes,originalAvailable:false}};props={...props,places:[place]};
    await render();expect(host.textContent).toContain("Original no longer available");expect(button("Visit Moon corner").disabled).toBe(false);
  });

  it("reports unavailable baseline originals without claiming there were no changes",async()=>{
    props={...props,places:[{...place,changes:{...place.changes,newOriginals:0,newReplies:0,paintedCells:0,removedOriginals:1,hasChanges:true}}]};
    await render();expect(host.textContent).toContain("1 original no longer available");expect(host.textContent).not.toContain("No changes since");
  });

  it("explains blocked, corrupt and limited snapshots without claiming that no changes happened",async()=>{
    props={...props,status:"unavailable",error:"Browser storage is unavailable. Changes were not saved."};await render();expect(host.querySelector('[role="status"]')?.textContent).toContain("not saved");
    props={...props,status:"corrupt",error:null,places:[]};await render();expect(host.textContent).toContain("could not be read");
    props={...props,status:"ready",places:[{...place,changes:{...place.changes,hasChanges:false,newOriginals:0,newReplies:0,paintedCells:0,limited:true}}]};await render();
    expect(host.textContent).toContain("memory changes may be incomplete");expect(host.textContent).not.toContain("No changes since");
  });
});
