import {beforeEach,describe,expect,it,vi} from "vitest";

const deps=vi.hoisted(()=>({claim:vi.fn(),complete:vi.fn(),remove:vi.fn()}));
vi.mock("../src/lib/server/database",()=>({
  claimAssetCleanup:deps.claim,completeAssetCleanup:deps.complete,
  adminClient:()=>({storage:{from:(bucket:string)=>({remove:(paths:string[])=>deps.remove(bucket,paths)})}})
}));
import {processAssetCleanup} from "../src/lib/server/asset-cleanup";

beforeEach(()=>{
  vi.resetAllMocks();deps.claim.mockResolvedValue([]);deps.complete.mockResolvedValue(true);
  deps.remove.mockResolvedValue({error:null});
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
