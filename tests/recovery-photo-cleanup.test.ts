// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {newDraft} from "../src/components/memory-composer";
import {createRecovery,readRecoveries,writeRecovery,type RecoveryInput} from "../src/lib/client/contribution-recovery";
import {useContributionRecovery} from "../src/lib/client/use-contribution-recovery";
import {recoveryLocks} from "./helpers/recovery-locks";
const io=vi.hoisted(()=>({file:null as File|null,finish:null as ((saved:boolean)=>void)|null}));
vi.mock("../src/lib/client/contribution-recovery",async original=>({...await original<typeof import("../src/lib/client/contribution-recovery")>(),loadRecoveryPhoto:async()=>io.file,saveRecoveryPhoto:()=>new Promise<boolean>(resolve=>{io.finish=resolve;}),removeRecoveryPhoto:async()=>true}));
it("does not resurrect accepted or discarded recovered photo work while its local copy is still saving",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("navigator",{locks:recoveryLocks()});vi.stubGlobal("URL",class extends URL{static createObjectURL=()=>"blob:local-photo";});localStorage.clear();
  const scope={worldId:"commons",epoch:1,actorId:"guest-a"};
  io.file=new File(["photo"],"unfinished.png",{type:"image/png"});
  let input:RecoveryInput={draft:null,brush:[],brushOperationId:null,sceneId:"pond",joinedBuildId:null,pending:null,camera:null};
  const original=createRecovery(scope,crypto.randomUUID(),{...input,draft:{...newDraft(),type:"image",body:"A caption worth keeping",file:io.file,previewUrl:"blob:old"}},1000,crypto.randomUUID())!;
  writeRecovery(localStorage,original);
  const host=document.createElement("div"),root=createRoot(host);let state:ReturnType<typeof useContributionRecovery>;
  function Harness(){state=useContributionRecovery(scope,input);return null;}
  try{
    await act(async()=>root.render(createElement(Harness)));
    await act(async()=>{const work=await state.restore(state.records[0]);input={draft:work!.draft,brush:work!.brush,brushOperationId:work!.brushOperationId,sceneId:work!.sceneId,joinedBuildId:work!.joinedBuildId,pending:work!.pending,camera:work!.camera};root.render(createElement(Harness));});
    expect(readRecoveries(localStorage,scope).find(record=>record.id===original.id)?.photoToken).toBe(original.photoToken);
    input={...input,draft:{...input.draft!,file:new File(["replacement"],"new.png",{type:"image/png"})}};
    await act(async()=>root.render(createElement(Harness)));
    expect(state!.photoStatus).toBe("saving");expect(readRecoveries(localStorage,scope).length).toBeGreaterThan(0);
    input={...input,draft:null};await act(async()=>root.render(createElement(Harness)));
    expect(readRecoveries(localStorage,scope)).toHaveLength(0);
    await act(async()=>io.finish?.(true));expect(readRecoveries(localStorage,scope)).toHaveLength(0);
  }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();localStorage.clear();}
});
