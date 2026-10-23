import {describe,expect,it,vi} from "vitest";
import {eventTransport} from "../src/lib/client/posthog-transport";

describe("event-only PostHog capture transport",()=>{
  it("sends only allowlisted events under the same anonymous flag identity",()=>{
    const request=vi.fn(()=>Promise.resolve(new Response("ok")));
    const transport=eventTransport("phc_example","https://posthog-test.invalid",()=>"anonymous-browser",request);
    transport.capture("visit_started",{returning:true,body:"A private story",query:"A private question",x:4000,$current_url:"https://private"});
    const [url,options]=request.mock.calls[0] as unknown as [URL,RequestInit];
    expect(url.href).toBe("https://posthog-test.invalid/batch/");expect(options.referrerPolicy).toBe("no-referrer");expect(options.credentials).toBe("omit");
    const payload=JSON.parse(String(options.body));expect(payload.api_key).toBe("phc_example");
    expect(payload.batch[0].properties).toEqual({returning:true,distinct_id:"anonymous-browser",is_test:false,$process_person_profile:false,$ip:0});
    expect(JSON.stringify(payload)).not.toContain("private");
  });
  it("aborts outstanding requests on opt-out and never starts a background retry",async()=>{
    let signal:AbortSignal|undefined;
    const request=vi.fn((_url:URL|RequestInfo,options?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{signal=options?.signal??undefined;signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")));}));
    const transport=eventTransport("phc_example","https://posthog-test.invalid",()=>"anonymous",request);
    transport.capture("arrival_shown",{arrival_variant:"world-first"});transport.stop();transport.capture("visit_started",{});
    expect(signal?.aborted).toBe(true);await Promise.resolve();expect(request).toHaveBeenCalledTimes(1);
  });
  it("ignores unsupported automatic events and synchronous network failure",()=>{
    const request=vi.fn(()=>{throw new Error("Network unavailable");});
    const transport=eventTransport("phc_example","https://posthog-test.invalid",()=>"anonymous",request);
    transport.capture("$autocapture",{});expect(request).not.toHaveBeenCalled();
    expect(()=>transport.capture("visit_started",{})).not.toThrow();
  });
});
