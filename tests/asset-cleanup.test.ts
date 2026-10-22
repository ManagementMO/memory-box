import {beforeEach,describe,expect,it,vi} from "vitest";

const deps=vi.hoisted(()=>({claim:vi.fn(),complete:vi.fn(),claimStaging:vi.fn(),completeStaging:vi.fn(),remove:vi.fn()}));
vi.mock("../src/lib/server/database",()=>({
  claimAssetCleanup:deps.claim,completeAssetCleanup:deps.complete,
  claimReadyStagingCleanup:deps.claimStaging,completeReadyStagingCleanup:deps.completeStaging,
  adminClient:()=>({storage:{from:(bucket:string)=>({remove:(paths:string[])=>deps.remove(bucket,paths)})}})
}));
import {processAssetCleanup,processReadyStagingCleanup} from "../src/lib/server/asset-cleanup";

beforeEach(()=>{
  vi.resetAllMocks();deps.claim.mockResolvedValue([]);deps.complete.mockResolvedValue(true);
  deps.claimStaging.mockResolvedValue([]);deps.completeStaging.mockResolvedValue(true);
  deps.remove.mockResolvedValue({error:null});
});

describe("ready-image staging cleanup",()=>{
  const claim={id:"ready-asset",staging_path:"owner/ready-asset.upload",claim_token:"lease-one"};
  it("removes only the claimed staging path and completes the matching lease",async()=>{
    deps.claimStaging.mockResolvedValue([claim]);
    expect(await processReadyStagingCleanup(100)).toEqual({claimed:1,removed:1,failed:0});
    expect(deps.remove.mock.calls).toEqual([["memory-staging",[claim.staging_path]]]);
    expect(deps.completeStaging).toHaveBeenCalledWith(claim.id,claim.claim_token);
    expect(deps.complete).not.toHaveBeenCalled();
  });
  it.each(["response-error","rejected-promise"])("leaves failed removal unfinished for a leased retry: %s",async failure=>{
    deps.claimStaging.mockResolvedValue([claim]);
    if(failure==="response-error")deps.remove.mockResolvedValueOnce({error:{message:"storage unavailable"}});
    else deps.remove.mockRejectedValueOnce(new Error("network unavailable"));
    expect(await processReadyStagingCleanup()).toEqual({claimed:1,removed:0,failed:1});
    expect(deps.completeStaging).not.toHaveBeenCalled();
    deps.claimStaging.mockResolvedValueOnce([{...claim,claim_token:"lease-two"}]);
    expect(await processReadyStagingCleanup()).toEqual({claimed:1,removed:1,failed:0});
    expect(deps.completeStaging).toHaveBeenCalledWith(claim.id,"lease-two");
    expect(deps.remove.mock.calls.every(([bucket])=>bucket==="memory-staging")).toBe(true);
  });
  it("reports a lost lease without claiming successful completion",async()=>{
    deps.claimStaging.mockResolvedValue([claim]);deps.completeStaging.mockResolvedValue(false);
    expect(await processReadyStagingCleanup()).toEqual({claimed:1,removed:0,failed:1});
  });
  it("bounds claims and does no storage work for an empty queue",async()=>{
    expect(await processReadyStagingCleanup(1000)).toEqual({claimed:0,removed:0,failed:0});
    expect(deps.claimStaging).toHaveBeenCalledWith(100);
    expect(deps.remove).not.toHaveBeenCalled();
  });
});

describe("private asset cleanup",()=>{
  it("removes both claimed paths before recording completion",async()=>{
    deps.claim.mockResolvedValue([{id:"asset-1",path:"owner/asset.webp",staging_path:"owner/source.png"}]);
    const result=await processAssetCleanup();
    expect(deps.remove.mock.calls).toEqual([["memory-staging",["owner/source.png"]],["memory-assets",["owner/asset.webp"]]]);
    expect(deps.complete).toHaveBeenCalledWith("asset-1");
    expect(result).toEqual({claimed:1,removed:1,failed:0});
  });
  it("leaves a failed removal uncompleted for a future leased retry",async()=>{
    deps.claim.mockResolvedValue([{id:"asset-1",path:"owner/asset.webp",staging_path:"owner/source.png"}]);
    deps.remove.mockResolvedValueOnce({error:{message:"storage unavailable"}});
    const result=await processAssetCleanup();
    expect(deps.complete).not.toHaveBeenCalled();
    expect(result).toEqual({claimed:1,removed:0,failed:1});
  });
  it("does not contact storage for an empty claim",async()=>{
    expect(await processAssetCleanup()).toEqual({claimed:0,removed:0,failed:0});
    expect(deps.remove).not.toHaveBeenCalled();
  });
  it("also cleans a deterministic canonical path left by an incomplete finalization",async()=>{
    deps.claim.mockResolvedValue([{id:"asset-2",path:null,staging_path:"owner/asset-2.upload"}]);
    expect((await processAssetCleanup()).removed).toBe(1);
    expect(deps.remove).toHaveBeenCalledWith("memory-assets",["owner/asset-2.webp"]);
  });
});
