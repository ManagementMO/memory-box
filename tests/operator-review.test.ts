// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {OperatorReview} from "../src/components/operator-review";

const session=vi.hoisted(()=>({present:true,id:"operator",onChange:null as null|((event:string,current:{user:{id:string}}|null)=>void)}));
vi.mock("../src/lib/client/supabase",()=>({getBrowserSupabase:()=>({auth:{
 getSession:async()=>({data:{session:session.present?{access_token:"synthetic-browser-token",user:{id:session.id}}:null},error:null}),
 onAuthStateChange:(callback:typeof session.onChange)=>{session.onChange=callback;return {data:{subscription:{unsubscribe(){}}}};},
}})}));
const memoryId="9554577e-54dd-48f0-8855-b4ea998f4a90";
let failed:boolean,denied:boolean,saveFailed:boolean,reviewed:boolean,area:boolean,image:boolean,sourceVersion:number,visibility:"published"|"hidden",writes:unknown[];
let delayRead:boolean,delayWrite:boolean,lateRead:((response:Response)=>void)|null,lateWrite:((response:Response)=>void)|null;
const queue=()=>({limit:100,hasMore:false,reports:reviewed?[]:[{id:"report-one",memoryId:area?null:memoryId,bounds:area?{x:1,y:2,width:5,height:6}:null,reason:"A real report would be shown here",createdAt:"2026-10-24T14:00:00Z",source:area?null:{id:memoryId,title:"Review this source",body:"<script>authored text remains text</script>",type:image?"image":"text",url:null,authorName:"Someone",visibility,imageAvailable:image,seedImageUrl:null,x:240,y:-120,version:sourceVersion,updatedAt:"2026-10-24T13:00:00Z",inspiredBy:null}}]});
describe("operator review experience",()=>{
 let host:HTMLDivElement,root:Root;
 const click=async(label:string)=>{
  const button=[...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.trim()===label);
  expect(button,label).toBeDefined();await act(async()=>button!.click());
 };
 beforeEach(()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);session.present=true;session.id="operator";session.onChange=null;failed=false;denied=false;saveFailed=false;reviewed=false;area=false;image=false;sourceVersion=3;visibility="published";writes=[];delayRead=false;delayWrite=false;lateRead=null;lateWrite=null;
  vi.stubGlobal("fetch",vi.fn(async(input:string,init?:RequestInit)=>{
   if(denied)return Response.json({error:"Operator access is required.",code:"operator_required"},{status:403});
   if(input.includes("?image="))return new Response(new Uint8Array([82,73,70,70]),{headers:{"Content-Type":"image/webp"}});
   if(init?.method==="POST"){
    const body=JSON.parse(String(init.body));writes.push(body);
    if(delayWrite){delayWrite=false;return new Promise<Response>(resolve=>{lateWrite=resolve;});}
    if(saveFailed)return Response.json({error:"The action could not be saved.",code:"service_unavailable"},{status:503});
    if(body.action==="resolve"||body.action==="dismiss"){
     reviewed=true;return Response.json({reportId:body.reportId,requestId:body.requestId,state:body.action==="resolve"?"resolved":"dismissed",replayed:false,reviewedAt:"2026-10-27T12:00:00Z"});
    }
    visibility=body.action==="hide"?"hidden":"published";return Response.json({revision:9,epoch:1});
   }
   if(delayRead){delayRead=false;return new Promise<Response>(resolve=>{lateRead=resolve;});}
   return failed?Response.json({error:"Queue unavailable.",code:"service_unavailable"},{status:503}):Response.json(queue());
  }));
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
 });
 afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
 const mount=()=>act(async()=>root.render(createElement(OperatorReview)));
 it("shows an access state without creating a guest or requesting private data when no session exists",async()=>{
  session.present=false;await mount();
  expect(host.textContent).toContain("Operator session required");expect(fetch).not.toHaveBeenCalled();
  expect(host.querySelector('[aria-label="Open reports"]')).toBeNull();
 });
 it("keeps a denied response separate from an empty queue",async()=>{
  denied=true;await mount();expect(host.textContent).toContain("Operator access required");
  expect(host.textContent).not.toContain("No open reports");
  expect(host.querySelector('[aria-label="Open reports"]')).toBeNull();
 });
 it("loads current source context as text and requires explicit confirmation before hiding it",async()=>{
  await mount();expect(host.textContent).toContain("Review this source");expect(host.querySelector("script")).toBeNull();
  await click("Hide original");expect(writes).toEqual([]);
  expect(host.querySelector('[aria-label="Confirm moderation"]')).not.toBeNull();
  await click("Confirm hide");
  expect(writes).toEqual([{action:"hide",memoryId}]);expect(host.textContent).toContain("Original hidden");
  expect(host.textContent).toContain("Reports remain open");
  expect([...host.querySelectorAll("button")].some(b=>b.textContent?.trim()==="Restore original")).toBe(true);
 });
 it("retains the source after a failed action and allows a deliberate retry",async()=>{
  await mount();await click("Hide original");saveFailed=true;await click("Confirm hide");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be saved");
  expect(host.textContent).toContain("Review this source");expect(visibility).toBe("published");
  saveFailed=false;await click("Confirm hide");expect(visibility).toBe("hidden");
 });
 it("returns keyboard focus to the visibility action after cancelling confirmation",async()=>{
  await mount();await click("Hide original");
  expect(document.activeElement?.textContent).toBe("Confirm hide");
  await click("Cancel");
  expect(document.activeElement?.textContent?.trim()).toBe("Hide original");
  expect(writes).toHaveLength(0);
 });
 it("retries a failed queue read without presenting an empty result",async()=>{
  failed=true;await mount();expect(host.textContent).toContain("Queue could not be loaded");
  expect(host.textContent).not.toContain("No open reports");
  failed=false;await click("Try again");expect(host.textContent).toContain("Review this source");
 });
 it("requires confirmation before resolving and removes the item only after acceptance",async()=>{
  await mount();await click("Resolve report");expect(writes).toEqual([]);
  expect(host.querySelector('[aria-label="Confirm moderation"]')?.textContent).toContain("without changing the original");
  await click("Confirm resolve");
  expect(writes).toEqual([{action:"resolve",reportId:"report-one",requestId:expect.stringMatching(/^[0-9a-f-]{36}$/)}]);
  expect(host.textContent).toContain("Report resolved");expect(host.textContent).toContain("No open reports");
 });
 it("keeps a failed review visible and reuses its request ID on retry",async()=>{
  await mount();await click("Dismiss report");saveFailed=true;await click("Confirm dismiss");
  expect(host.textContent).toContain("Review this source");expect(reviewed).toBe(false);
  saveFailed=false;await click("Confirm dismiss");
  expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);
  expect(host.textContent).toContain("Report dismissed");expect(host.textContent).toContain("No open reports");
 });
 it("can resolve a canvas-area report without a source visibility action",async()=>{
  area=true;await mount();expect(host.textContent).toContain("Reported canvas area");
  expect([...host.querySelectorAll("button")].some(b=>b.textContent?.trim()==="Hide original")).toBe(false);
  await click("Resolve report");await click("Confirm resolve");expect(reviewed).toBe(true);
 });
 it("clears private text and photo on a SIGNED_IN identity replacement and rejects a late old queue",async()=>{
  image=true;visibility="hidden";
  const revoke=vi.fn();vi.stubGlobal("URL",class extends URL {static createObjectURL=()=>"blob:private-old-photo";static revokeObjectURL=revoke;});
  await mount();await click("Load photo");await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});expect(host.querySelector("img")?.src,host.textContent||"").toBe("blob:private-old-photo");
  delayRead=true;await click("Refresh queue");expect(lateRead).not.toBeNull();
  await act(async()=>{session.id="guest";denied=true;session.onChange!("SIGNED_IN",{user:{id:"guest"}});await new Promise(resolve=>setTimeout(resolve,5));});
  expect(host.textContent).toContain("Operator access required");expect(host.textContent).not.toContain("authored text remains text");expect(host.querySelector("img")).toBeNull();
  expect(revoke).toHaveBeenCalledWith("blob:private-old-photo");
  await act(async()=>lateRead!(Response.json(queue())));
  expect(host.textContent).not.toContain("Review this source");expect(host.querySelector('[aria-label="Open reports"]')).toBeNull();
 });
 it("does not install an old operator's mutation receipt after the identity is replaced",async()=>{
  await mount();await click("Resolve report");delayWrite=true;await click("Confirm resolve");expect(lateWrite).not.toBeNull();
  await act(async()=>{session.id="guest";denied=true;session.onChange!("SIGNED_IN",{user:{id:"guest"}});await new Promise(resolve=>setTimeout(resolve,5));});
  const pending=writes[0] as {reportId:string;requestId:string};
  await act(async()=>lateWrite!(Response.json({...pending,state:"resolved",replayed:false,reviewedAt:"2026-10-27T12:00:00Z"})));
  expect(host.textContent).toContain("Operator access required");expect(host.textContent).not.toContain("Report resolved");expect(host.textContent).not.toContain("Review this source");
 });
 it("drops old image bytes when refresh returns a newer version of the original",async()=>{
  image=true;
  const revoke=vi.fn();vi.stubGlobal("URL",class extends URL {static createObjectURL=()=>"blob:private-old-photo";static revokeObjectURL=revoke;});
  await mount();await click("Load photo");await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});expect(host.querySelector("img"),host.textContent||"").not.toBeNull();
  sourceVersion=4;await click("Refresh queue");
  expect(host.textContent).toContain("version 4");expect(host.querySelector("img")).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:private-old-photo");
 });
});
