// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useContributionRecovery } from "../src/lib/client/use-contribution-recovery";
import { newDraft } from "../src/components/memory-composer";
import type { RecoveryInput } from "../src/lib/client/contribution-recovery";
import {recoveryLocks} from "./helpers/recovery-locks";

let scope={worldId:"commons",epoch:1,actorId:"guest-a"};
let host:HTMLDivElement,root:Root,value:ReturnType<typeof useContributionRecovery>;
let input:RecoveryInput;
function Harness(){value=useContributionRecovery(scope,input);return null;}
beforeEach(()=>{scope={worldId:"commons",epoch:1,actorId:"guest-a"};vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("navigator",{locks:recoveryLocks()});localStorage.clear();host=document.createElement("div");document.body.append(host);root=createRoot(host);input={draft:null,brush:[],brushOperationId:null,sceneId:"pond",joinedBuildId:null,pending:null,camera:null};});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const render=()=>act(async()=>root.render(createElement(Harness)));
it("offers recovered work after a remount without publishing or applying it automatically",async()=>{
  await render();input={...input,draft:{...newDraft(),body:"Keep this train"},brush:[{x:1,y:2,color:"#FFFFFF"}]};await render();
  expect(value.status).toBe("saved");
  await act(async()=>root.unmount());root=createRoot(host);input={...input,draft:null,brush:[]};await render();
  expect(value.records).toHaveLength(1);expect(input.draft).toBeNull();
  let restored:Awaited<ReturnType<typeof value.restore>>=null;
  await act(async()=>{restored=await value.restore(value.records[0]);});
  expect(restored!.draft?.body).toBe("Keep this train");expect(restored!.brush).toEqual([{x:1,y:2,color:"#FFFFFF"}]);
});
it("retains another tab's recovery when current work is accepted or discarded",async()=>{
  await render();input={...input,draft:{...newDraft(),body:"First tab"}};await render();
  const keys=Object.keys(localStorage).filter(key=>key.startsWith("memory-box:work:"));expect(keys).toHaveLength(1);
  const second=JSON.parse(localStorage.getItem(keys[0])!);second.id=crypto.randomUUID();second.draft.body="Second tab";
  const secondKey=keys[0].slice(0,keys[0].lastIndexOf(":")+1)+second.id;localStorage.setItem(secondKey,JSON.stringify(second));
  input={...input,draft:null};await render();
  expect(localStorage.getItem(keys[0])).toBeNull();expect(localStorage.getItem(secondKey)).not.toBeNull();
});
it("shows that storage failed while the controlled draft remains intact",async()=>{
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("denied");});
  await render();input={...input,draft:{...newDraft(),body:"Still in this tab"}};await render();
  expect(value.status).toBe("unavailable");expect(input.draft?.body).toBe("Still in this tab");
});
it("does not relabel old work as another guest when the identity changes",async()=>{
  await render();input={...input,draft:{...newDraft(),body:"Private unfinished work"}};await render();
  scope={...scope,actorId:"guest-b"};await render();
  expect(value.status).toBe("unavailable");
  const records=Object.keys(localStorage).filter(key=>key.startsWith("memory-box:work:"));
  expect(records).toHaveLength(1);expect(records[0]).toContain("guest-a");
  expect(input.draft?.body).toBe("Private unfinished work");
});
