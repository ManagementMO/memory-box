// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {newDraft} from "../src/components/memory-composer";
import {readRecoveries,type RecoveryInput} from "../src/lib/client/contribution-recovery";
import {useContributionRecovery} from "../src/lib/client/use-contribution-recovery";
import {recoveryLocks} from "./helpers/recovery-locks";
it("forks active-tab work without erasing the first writer or reusing its save id",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("navigator",{locks:recoveryLocks()});localStorage.clear();
  const scope={worldId:"commons",epoch:1,actorId:"guest-a"};
  const blank:RecoveryInput={draft:null,brush:[],brushOperationId:null,sceneId:"pond",joinedBuildId:null,pending:null,camera:null};
  let first={...blank,draft:{...newDraft(),body:"Blue train"}},second:RecoveryInput=blank;
  let a:ReturnType<typeof useContributionRecovery>,b:ReturnType<typeof useContributionRecovery>;
  const ra=createRoot(document.createElement("div")),rb=createRoot(document.createElement("div"));
  function A(){a=useContributionRecovery(scope,first);return null;}function B(){b=useContributionRecovery(scope,second);return null;}
  try{
    await act(async()=>ra.render(createElement(A)));await act(async()=>rb.render(createElement(B)));
    await act(async()=>{const copy=await b.restore(b.records[0],true);second={...copy!,draft:{...copy!.draft!,body:"Red plane"}};rb.render(createElement(B));});
    const restored=readRecoveries(localStorage,scope);
    expect(restored.map(record=>record.draft?.body).sort()).toEqual(["Blue train","Red plane"]);
    expect(new Set(restored.map(record=>record.draft?.clientId)).size).toBe(2);
    expect(first.draft.body).toBe("Blue train");
  }finally{await act(async()=>{ra.unmount();rb.unmount();});vi.unstubAllGlobals();localStorage.clear();}
});
