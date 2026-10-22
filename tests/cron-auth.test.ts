import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

const deps=vi.hoisted(()=>({index:vi.fn(),cleanup:vi.fn(),staging:vi.fn()}));
vi.mock("@/lib/server/http",async()=>import("../src/lib/server/http"));
vi.mock("@/lib/server/indexing",()=>({processIndexJobs:deps.index}));
vi.mock("@/lib/server/asset-cleanup",()=>({processAssetCleanup:deps.cleanup,processReadyStagingCleanup:deps.staging}));
import {GET} from "../src/app/api/cron/index/route";

beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv("CRON_SECRET","secret");
  deps.index.mockResolvedValue({processed:0});deps.cleanup.mockResolvedValue({claimed:0});deps.staging.mockResolvedValue({claimed:0});
});
afterEach(()=>vi.unstubAllEnvs());

describe("private maintenance authentication",()=>{
  it.each([undefined,"Bearer ","Bearer wrong!","Bearer éaaaaa","secret"])("rejects %s without running maintenance",async authorization=>{
    const request=new Request("http://localhost/api/cron/index",{headers:authorization ? {authorization} : {}});
    const response=await GET(request);
    expect(response.status).toBe(401);expect(await response.json()).toMatchObject({code:"unauthorized"});
    expect(deps.index).not.toHaveBeenCalled();expect(deps.cleanup).not.toHaveBeenCalled();expect(deps.staging).not.toHaveBeenCalled();
  });
  it("denies requests when the secret is not configured",async()=>{
    vi.stubEnv("CRON_SECRET","");
    expect((await GET(new Request("http://localhost/api/cron/index",{headers:{authorization:"Bearer secret"}}))).status).toBe(401);
    expect(deps.index).not.toHaveBeenCalled();
  });
  it("runs each bounded maintenance batch for the exact bearer secret",async()=>{
    const response=await GET(new Request("http://localhost/api/cron/index",{headers:{authorization:"Bearer secret"}}));
    expect(response.status).toBe(200);
    expect(deps.index).toHaveBeenCalledWith(4);expect(deps.cleanup).toHaveBeenCalledWith(100);expect(deps.staging).toHaveBeenCalledWith(100);
    expect(await response.json()).toEqual({processed:0,cleanup:{claimed:0},stagingCleanup:{claimed:0}});
  });
});
