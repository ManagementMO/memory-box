import { describe,expect,it } from "vitest";
import { safeConnectionFailure } from "../src/lib/client/supabase";

describe("safe connection diagnostics",()=>{
  it("retains a useful rate-limit code while dropping all credential-bearing fields",()=>{
    const safe=safeConnectionFailure({name:"AuthApiError",code:"over_request_rate_limit",status:429,message:"private-token-example",headers:{authorization:"private-token-example"},metadata:{access_token:"private-token-example"}});
    expect(safe).toEqual({name:"AuthApiError",code:"over_request_rate_limit",status:429});
    expect(JSON.stringify(safe)).not.toContain("private-token-example");
  });
  it("does not copy arbitrary strings, objects or out-of-range statuses",()=>{
    expect(safeConnectionFailure({name:"https://private.example/?token=value",code:{token:"value"},status:1000})).toEqual({name:"UnknownError"});
    expect(safeConnectionFailure(null)).toEqual({name:"UnknownError"});
  });
});
