import {describe,expect,it,vi} from "vitest";
import {allowedAnalytics,cleanEvent,parseAnalyticsState,visitState,ProductAnalytics,FLAG_KEY,type AnalyticsState,type AnalyticsAdapter} from "../src/lib/client/product-analytics";

const now=Date.parse("2026-10-23T12:00:00Z"),id="11111111-1111-4111-8111-111111111111";
const state=():AnalyticsState=>({version:1,id,firstSeen:now,lastActive:now,sessionStarted:now,sessionId:id,accepted:[]});
describe("event-only product measurement",()=>{
  it("allows configured canonical visits only and respects automation, QA, DNT, GPC and opt-out",()=>{
    const base={host:"memory-box-commons.vercel.app",canonicalHost:"memory-box-commons.vercel.app",token:"phc_example",automated:false,qa:false,optOut:false,dnt:false,gpc:false};
    expect(allowedAnalytics(base)).toBe(true);
    for(const change of [{host:"localhost"},{token:""},{automated:true},{qa:true},{optOut:true},{dnt:true},{gpc:true}])expect(allowedAnalytics({...base,...change})).toBe(false);
  });
  it("drops content, identifiers, coordinates, queries and SDK URL/person defaults",()=>{
    const result=cleanEvent({event:"contribution_saved",properties:{distinct_id:id,token:"phc_test",kind:"text",build_on:true,within_five_minutes:true,"$feature/arrival-experience-v1":"world-first",body:"A private story",query:"My question",x:4100,url:"https://private",$current_url:"https://private/#at=0,0,1",$referrer:"https://private",$set:{email:"private@example.com"},authorId:id}});
    expect(result?.properties).toEqual({distinct_id:id,token:"phc_test",kind:"text",build_on:true,within_five_minutes:true,"$feature/arrival-experience-v1":"world-first",$ip:0});
    expect(cleanEvent({event:"$autocapture",properties:{}})).toBeNull();
    const nested=cleanEvent({uuid:id,event:"original_opened",properties:{kind:"text"},$set:{email:"private@example.com"},$set_once:{name:"Someone"}});
    expect(nested).not.toHaveProperty("$set");expect(nested).not.toHaveProperty("$set_once");
  });
  it("rejects malformed, oversized or future local state",()=>{
    expect(parseAnalyticsState("bad",now)).toBeNull();expect(parseAnalyticsState(JSON.stringify({...state(),lastActive:now+100000}),now)).toBeNull();expect(parseAnalyticsState("x".repeat(20000),now)).toBeNull();
  });
  it("shares a session across tabs and only marks a real later session as returning",()=>{
    const first=visitState(null,now,()=>id);expect(first.started).toBe(true);expect(first.returning).toBe(false);
    const tab=visitState(first.state,now+100,()=>"second");expect(tab.started).toBe(false);expect(tab.state.sessionId).toBe(id);
    const later=visitState(first.state,now+30*60*1000+1,()=>"second");expect(later.started).toBe(true);expect(later.returning).toBe(true);
  });
  it("counts only exposed arrivals, deduplicates accepted saves and attributes returning visits",()=>{
    const capture=vi.fn(),adapter:AnalyticsAdapter={capture,getVariant:()=>"inside-world"};let saved=state();
    const analytics=new ProductAnalytics(adapter,()=>saved,value=>{saved=value;},()=>now);
    analytics.contribution("before-canvas","text",false);expect(capture).not.toHaveBeenCalled();
    analytics.arrived("inside-world","experiment");analytics.arrived("inside-world","experiment");
    analytics.contribution("saved-original","image",true);analytics.contribution("saved-original","image",true);
    expect(capture.mock.calls.map(call=>call[0])).toEqual(["arrival_shown","contribution_saved"]);
    expect(capture.mock.calls[1][1]).toMatchObject({kind:"image",build_on:true,within_five_minutes:true,arrival_variant:"inside-world",[`$feature/${FLAG_KEY}`]:"inside-world"});
    expect(JSON.stringify(capture.mock.calls)).not.toContain("saved-original");
    const nextCapture=vi.fn(),next=new ProductAnalytics({...adapter,capture:nextCapture},()=>saved,value=>{saved=value;},()=>now+86400000);
    next.visit();expect(nextCapture.mock.calls[0][1]).toMatchObject({returning:true,arrival_variant:"inside-world"});
  });
  it("does not expose fallbacks, shared links, saved views or QA previews",()=>{
    const capture=vi.fn();let saved=state();const analytics=new ProductAnalytics({capture,getVariant:()=>"world-first"},()=>saved,value=>{saved=value;},()=>now);
    for(const source of ["shared","saved","default","qa"] as const)analytics.arrived("world-first",source);
    expect(capture).not.toHaveBeenCalled();expect(saved.enrollment).toBeUndefined();
  });
  it("reports a visible session once across controllers and distinguishes later contributions",()=>{
    const capture=vi.fn();let saved=state(),clock=now;
    const adapter={capture,getVariant:()=>"world-first"};
    const one=new ProductAnalytics(adapter,()=>saved,value=>{saved=value;},()=>clock),two=new ProductAnalytics(adapter,()=>saved,value=>{saved=value;},()=>clock);
    one.firstVisit();two.firstVisit();expect(capture.mock.calls.filter(call=>call[0]==="visit_started")).toHaveLength(1);
    one.arrived("world-first","experiment");clock+=301000;one.contribution("later","paint",false,10);
    expect(capture.mock.calls.at(-1)?.[1]).toMatchObject({within_five_minutes:false,elapsed_seconds:301,pixel_count:10});
    clock+=1800001;one.touch();two.touch();
    expect(capture.mock.calls.filter(call=>call[0]==="visit_started"&&call[1].returning===true)).toHaveLength(1);
  });
});
