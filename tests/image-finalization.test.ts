import {beforeEach,describe,expect,it,vi} from "vitest";
import sharp from "sharp";
const deps=vi.hoisted(()=>({get:vi.fn(),ready:vi.fn(),download:vi.fn(),upload:vi.fn(),remove:vi.fn()}));
vi.mock("../src/lib/server/database",()=>({
  getAsset:deps.get,markAssetReady:deps.ready,
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
