// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot} from "react-dom/client";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
import {StoryPeek} from "../src/components/story-peek";
import {MemoryComposer,newDraft} from "../src/components/memory-composer";
import {MemoryCard} from "../src/components/memory-card";
import type {Memory} from "../src/lib/types";
import {openBuildInvitations} from "../src/lib/client/build-invitations";
import {BuildWorkbench} from "../src/components/build-workbench";

export const original:Memory={id:"53219ac5-08c8-4461-a448-b7e688571fa7",authorId:"owner",authorName:"Visitor",type:"text",title:"Goose wardrobe",body:"Give this goose an interview outfit.",url:null,imageUrl:null,color:"#FFF3BF",x:400,y:300,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:false};
const peek=(memory:Memory)=>renderToStaticMarkup(createElement(StoryPeek,{memory,onRead:()=>{},onBuild:()=>{},onJoin:()=>{},onNext:()=>{},onClose:()=>{}}));

describe("authored build invitations",()=>{
  it("discovers only current invitations, with newest first and stable ordering",()=>{
    const older={...original,id:"a",isBuildInvitation:true,createdAt:"2026-10-21T12:00:00Z"};
    const newer={...original,id:"b",isBuildInvitation:true};
    const tie={...newer,id:"c"};const memories=[older,original,tie,newer,{...original,id:"closed",isBuildInvitation:false}];
    expect(openBuildInvitations(memories).map(m=>m.id)).toEqual(["b","c","a"]);
    expect(memories[0]).toBe(older);
  });
  it("shows the original invitation and exact contribution actions without inventing membership",()=>{
    const markup=renderToStaticMarkup(createElement(BuildWorkbench,{memory:{...original,isBuildInvitation:true},onPaint:()=>{},onNote:()=>{},onPhoto:()=>{},onRead:()=>{},onShare:()=>{},onTogether:()=>{}}));
    const host=document.createElement("div");host.innerHTML=markup;
    expect(host.textContent).toContain(original.body);
    expect([...host.querySelectorAll('button')].map(b=>b.textContent)).toEqual(["Paint here","Add a note","Leave a photo","Read original","Meet here","Other builds"]);
    expect(host.textContent).not.toMatch(/members|joined|contributors/i);
  });
  it.each([undefined,{...original,isBuildInvitation:false}])("keeps closed or withdrawn invitations from starting new join actions",memory=>{
    const markup=renderToStaticMarkup(createElement(BuildWorkbench,{memory,onPaint:()=>{},onNote:()=>{},onPhoto:()=>{},onRead:()=>{},onShare:()=>{},onTogether:()=>{}}));
    expect(markup).not.toContain("Paint here");expect(markup).not.toContain("Add a note");
    expect(markup).toContain(memory?"This invitation is closed.":"This invitation is no longer available.");
    expect(markup).toContain("Other builds");
  });
  it("offers Join only for an invitation and retains normal Build on",()=>{
    expect(peek({...original,isBuildInvitation:true})).toContain("Join this build");
    expect(peek(original)).toContain("Build on");
    expect(peek(original)).not.toContain("Join this build");
  });
  it("marks actual invitations on the mosaic without changing ordinary notes",()=>{
    const invite=renderToStaticMarkup(createElement(MemoryCard,{memory:{...original,isBuildInvitation:true}}));
    const normal=renderToStaticMarkup(createElement(MemoryCard,{memory:original}));
    expect(invite).toContain('class="memory-build-badge"');
    expect(invite).toContain("Open build");
    expect(normal).not.toContain("memory-build-badge");
  });
  it("lets authors opt in and keeps the invitation switch controlled while editing",async()=>{
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
    const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
    try {
      const draft={...newDraft(),body:original.body};const onChange=vi.fn();
      await act(async()=>root.render(createElement(MemoryComposer,{draft,onChange,sceneId:"mixtape",onSceneChange:()=>{},onOriginal:()=>{},onPreview:()=>{},busy:"",error:""})));
      const checkbox=host.querySelector<HTMLInputElement>('input[type="checkbox"]');
      expect(checkbox).not.toBeNull();
      await act(async()=>checkbox!.click());
      expect(onChange.mock.calls[0][0]).toMatchObject({body:original.body,isBuildInvitation:true});
      const edited={...draft,editId:original.id,expectedVersion:1,isBuildInvitation:true};
      await act(async()=>root.render(createElement(MemoryComposer,{draft:edited,onChange,sceneId:"mixtape",onSceneChange:()=>{},onOriginal:()=>{},onPreview:()=>{},busy:"Saving…",error:""})));
      const frozen=host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(frozen.checked).toBe(true);expect(frozen.disabled).toBe(true);
    } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
  });
});
