import {describe,expect,it} from "vitest";
import {assertOrigin} from "../src/lib/server/http";

describe("same-origin mutations",()=>{
  it("accepts the actual localhost origin when Next binds to all interfaces",()=>{
    expect(()=>assertOrigin(new Request("http://0.0.0.0:3007/api/memories",{headers:{Host:"localhost:3007",Origin:"http://localhost:3007"}}))).not.toThrow();
  });
  it("rejects a different website even when its request targets the app",()=>{
    expect(()=>assertOrigin(new Request("https://memory-box.example/api/memories",{headers:{Host:"memory-box.example",Origin:"https://someone-else.example"}}))).toThrow("Open Memory Box directly");
  });
});
