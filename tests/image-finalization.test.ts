import {beforeEach,describe,expect,it,vi} from "vitest";
import sharp from "sharp";
const deps=vi.hoisted(()=>({get:vi.fn(),ready:vi.fn(),budget:vi.fn(),download:vi.fn(),upload:vi.fn(),remove:vi.fn()}));
vi.mock("../src/lib/server/database",()=>({
  getAsset:deps.get,markAssetReady:deps.ready,consumeBudget:deps.budget,
  adminClient:()=>({storage:{from:(bucket:string)=>({
    download:deps.download,upload:deps.upload,
    remove:(paths:string[])=>deps.remove(bucket,paths)
  })}})
}));
import {finalizeImage} from "../src/lib/server/images";
const actor="e47194bd-5ae2-4f28-87d7-530f15b4fa76",id="d1be32f7-1336-4504-b846-d1890b06431a";
const staging={id,owner_id:actor,status:"staging",staging_path:actor+"/"+id+".upload"};
beforeEach(async()=>{
  vi.resetAllMocks();
  deps.budget.mockResolvedValue(1);
  const bytes=await sharp({create:{width:10,height:10,channels:3,background:"#354FB2"}}).png().toBuffer();
  deps.download.mockResolvedValue({data:new Blob([bytes]),error:null});deps.upload.mockResolvedValue({error:null});deps.remove.mockResolvedValue({error:null});
  deps.get.mockResolvedValueOnce(staging);deps.ready.mockRejectedValue(new Error("ASSET_UNAVAILABLE"));
});
describe("finalization and cleanup race",()=>{
  it("removes its deterministic upload if cleanup deleted the asset before readiness",async()=>{
    deps.get.mockResolvedValueOnce({...staging,status:"deleted"});
    await expect(finalizeImage(actor,id)).rejects.toThrow("ASSET_UNAVAILABLE");
    expect(deps.remove).toHaveBeenCalledWith("memory-assets",[actor+"/"+id+".webp"]);
  });
  it.each(["ready","staging"])("preserves stored bytes when the current asset remains %s",async status=>{
    deps.get.mockResolvedValueOnce({...staging,status});
    await expect(finalizeImage(actor,id)).rejects.toThrow("ASSET_UNAVAILABLE");
    expect(deps.remove).not.toHaveBeenCalled();
  });
  it("does not delete bytes when the recheck itself fails",async()=>{
    deps.get.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(finalizeImage(actor,id)).rejects.toThrow("ASSET_UNAVAILABLE");
    expect(deps.remove).not.toHaveBeenCalled();
  });
});

describe("ready image publication during staging cleanup outages",()=>{
  it.each(["response-error","rejected-promise"])("keeps sanitized readiness after a staging removal %s",async failure=>{
    const ready={...staging,status:"ready",path:actor+"/"+id+".webp"};
    deps.ready.mockResolvedValue(ready);deps.get.mockResolvedValueOnce(ready);
    if(failure==="response-error")deps.remove.mockResolvedValueOnce({error:{message:"storage unavailable"}});
    else deps.remove.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(finalizeImage(actor,id)).resolves.toEqual(ready);
    expect(deps.ready).toHaveBeenCalledOnce();
    expect(deps.remove.mock.calls).toEqual([["memory-staging",[staging.staging_path]]]);
  });
});

describe("image processing attempt allowance",()=>{
  it("bounds retries of the same bad staged image before downloading or decoding again",async()=>{
    deps.get.mockReset().mockResolvedValue(staging);
    deps.download.mockResolvedValue({data:new Blob(["not an image"]),error:null});
    let attempted=0;
    deps.budget.mockImplementation(async()=>{if(++attempted>24)throw new Error("RATE_LIMITED");return attempted;});
    for(let i=0;i<24;i++)await expect(finalizeImage(actor,id)).rejects.toMatchObject({code:"invalid_image"});
    await expect(finalizeImage(actor,id)).rejects.toThrow("RATE_LIMITED");
    expect(deps.budget).toHaveBeenCalledWith(actor,"image_finalize",24,3600);
    expect(deps.download).toHaveBeenCalledTimes(24);
    expect(deps.upload).not.toHaveBeenCalled();expect(deps.ready).not.toHaveBeenCalled();
  });
  it("keeps completed/idempotent publications available when processing allowance is exhausted",async()=>{
    const ready={...staging,status:"ready",path:actor+"/"+id+".webp"};
    deps.get.mockReset().mockResolvedValue(ready);deps.budget.mockRejectedValue(new Error("RATE_LIMITED"));
    await expect(finalizeImage(actor,id)).resolves.toEqual(ready);
    expect(deps.budget).not.toHaveBeenCalled();expect(deps.download).not.toHaveBeenCalled();
  });
  it("checks ownership before charging processing allowance",async()=>{
    deps.get.mockReset().mockResolvedValue({...staging,owner_id:"someone-else"});
    await expect(finalizeImage(actor,id)).rejects.toMatchObject({status:403,code:"asset_not_owned"});
    expect(deps.budget).not.toHaveBeenCalled();expect(deps.download).not.toHaveBeenCalled();
  });
});
