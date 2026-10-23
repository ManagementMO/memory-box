import {expect,test as base,type Page} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import {gunzipSync} from "node:zlib";
import sharp from "sharp";
import {browserEnabled,cameraState,WorldFixture,writesEnabled} from "./helpers/open-world-fixture";

const test=base.extend<{world:WorldFixture}>({world:async({page:_page},use,info)=>{
  const world=new WorldFixture(info);try{await use(world);}finally{await world.cleanup();}
}});
test.skip(!browserEnabled,"Enable disposable guests with MB_E2E_OPEN_WORLD=1.");test.use({trace:"off"});
const board=(page:Page)=>page.getByRole("region",{name:"The shared Memory Box world"});
type Event={event:string;properties:Record<string,unknown>};

async function intercept(page:Page,variant:string,delay=0){
  const events:Event[]=[],requests:{url:string;body:unknown}[]=[];
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"webdriver",{get:()=>false});
    Object.defineProperty(navigator,"userAgent",{value:navigator.userAgent.replace("HeadlessChrome","Chrome")});
    Object.defineProperty(navigator,"userAgentData",{value:undefined});
  });
  await page.route("https://posthog-test.invalid/**",async route=>{
    const url=new URL(route.request().url()),body=route.request().postDataBuffer();
    let payload:unknown;
    if(body){
      let decoded=route.request().headers()["content-encoding"]==="gzip"?gunzipSync(body).toString():body.toString();
      const encoded=new URLSearchParams(decoded).get("data");
      if(encoded)decoded=Buffer.from(encoded,"base64").toString();
      try{payload=JSON.parse(decoded);}catch{payload=decoded.slice(0,16000);}
    }
    requests.push({url:url.pathname,body:payload});
    if(url.pathname.includes("flags")){
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      await route.fulfill({json:{featureFlags:{"arrival-experience-v1":variant},featureFlagPayloads:{},errorsWhileComputingFlags:false}});return;
    }
    if(payload&&typeof payload==="object"){
      const data=payload as {batch?:Event[]};events.push(...(Array.isArray(payload)?payload:data.batch??[data as Event]));
    }
    await route.fulfill({json:{status:1,config:{enable_collect_everything:false},supportedCompression:[]}});
  });
  return {events,requests};
}

test("both QA arrivals preserve return location, remain usable, and honor shared links",async({page,world},info)=>{
  test.setTimeout(90000);const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await world.connect(page);await expect.poll(()=>page.evaluate(()=>localStorage.getItem("memory-box:canvas-view:v1"))).not.toBeNull();
  const saved=await page.evaluate(()=>localStorage.getItem("memory-box:canvas-view:v1"));
  for(const variant of ["world-first","inside-world"]){
    await page.goto(`/?arrival=${variant}`);await expect(board(page)).toHaveAttribute("data-arrival",variant);
    expect((await cameraState(page)).zoom)[variant==="world-first"?"toBeLessThan":"toBeGreaterThan"](.52);
    await expect(page.locator(".connection-state")).toHaveText("Live");
    if(process.env.MB_E2E_REVIEW==="1"){await mkdir(".impeccable/review/arrival",{recursive:true});await page.screenshot({path:`.impeccable/review/arrival/${variant}-${info.project.name}.png`,fullPage:true});}
    await page.getByRole("button",{name:"Wander into a story",exact:true}).click();
    await expect(page.locator(".story-peek")).toBeVisible();
    await page.getByRole("button",{name:"Close story preview",exact:true}).click();
    await expect(page.getByRole("button",{name:"Wander into a story",exact:true})).toBeFocused();
    expect(await page.evaluate(()=>localStorage.getItem("memory-box:canvas-view:v1"))).toBe(saved);
  }
  await page.goto("/?arrival=world-first#at=-3200,2400,0.9");await expect(board(page)).toHaveAttribute("data-arrival-source","shared");
  const c=await cameraState(page);expect(c.zoom).toBe(.9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});

test("PostHog measures actual exposure, accepted saves and return sessions without content",async({page,world})=>{
  test.skip(process.env.MB_E2E_ANALYTICS!=="1","Run against the isolated analytics harness, never the real ingest endpoint.");test.setTimeout(90000);
  const {events,requests}=await intercept(page,"inside-world");await world.connect(page);
  await expect(board(page),JSON.stringify({events,requests})).toHaveAttribute("data-arrival","inside-world");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("memory-box:measurement:v1")??"null")?.enrollment?.variant)).toBe("inside-world");
  await expect.poll(()=>JSON.stringify({events,requests})).toContain('"event":"arrival_shown"');
  expect(requests.length).toBeGreaterThan(0);
  await page.getByRole("button",{name:"Leave something",exact:true}).click();await page.locator('.composer-writing textarea').fill("Never capture this private draft: cheese captain.");
  await page.getByRole("button",{name:"Choose its place",exact:true}).click();
  await page.route("**/api/memories",route=>route.request().method()==="POST"?route.fulfill({status:503,json:{error:"Try again"}}):route.continue());
  await page.getByRole("button",{name:"Leave it here",exact:true}).click();await expect(page.locator(".placement-error")).toBeVisible();
  expect(events.some(e=>e.event==="contribution_saved")).toBe(false);
  if(writesEnabled){
    await page.unroute("**/api/memories");
    const publish=async()=>{
      const accepted=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/memories"&&r.request().method()==="POST");
      await page.getByRole("button",{name:"Leave it here",exact:true}).click();expect((await accepted).status()).toBe(201);
    };
    await publish();
    await expect(page.getByRole("button",{name:"Build on this",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Build on this",exact:true}).click();
    await page.locator('.type-switch').getByRole('button',{name:"Image",exact:true}).click();
    const image=await sharp({create:{width:24,height:24,channels:3,background:"#DCC7F0"}}).png().toBuffer();
    await page.getByLabel("Choose image",{exact:true}).setInputFiles({name:"private-cheese-boat.png",mimeType:"image/png",buffer:image});
    await page.locator('.composer-writing textarea').fill("A lilac flag for our captain.");
    await page.getByRole("button",{name:"Choose its place",exact:true}).click();await publish();
    await expect.poll(()=>events.filter(e=>e.event==="contribution_saved").length).toBe(2);
    expect(events.filter(e=>e.event==="contribution_saved").map(e=>[e.properties.kind,e.properties.build_on])).toEqual([["text",false],["image",true]]);
    await page.getByRole("button",{name:"Close story preview",exact:true}).click();
    await page.locator('.paint-button').click();
    const point=await board(page).evaluate(element=>{
      const r=element.getBoundingClientRect();for(const [fx,fy] of [[.5,.2],[.6,.24],[.3,.27]]){const x=r.x+r.width*fx,y=r.y+r.height*fy,target=document.elementFromPoint(x,y);if(target&&element.contains(target)&&!target.closest('.canvas-overlay,button,input,textarea'))return{x,y};}throw new Error("No painting ground");
    });
    await page.mouse.click(point.x,point.y);
    const painted=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/paint"&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Share preview pixels",exact:true}).click();expect((await painted).status()).toBe(200);
    await expect.poll(()=>events.filter(e=>e.event==="contribution_saved"&&e.properties.kind==="paint").length).toBe(1);
  }
  await page.reload();await expect(board(page)).toHaveAttribute("data-arrival-source","saved");
  await page.evaluate(()=>{const key="memory-box:measurement:v1",v=JSON.parse(localStorage.getItem(key)!);v.firstSeen=Date.now()-86400000;v.lastActive=Date.now()-31*60000;v.sessionStarted=v.lastActive;localStorage.setItem(key,JSON.stringify(v));});
  await page.reload();await expect.poll(()=>events.filter(e=>e.event==="visit_started"&&e.properties.returning===true).length).toBe(1);
  expect(events.filter(e=>e.event==="arrival_shown")).toHaveLength(1);
  const raw=JSON.stringify({events,requests});expect(raw).not.toContain("cheese captain");expect(raw).not.toContain("$current_url");expect(raw).not.toContain("$referrer");expect(raw).not.toContain("auth-token");
  await page.getByRole("button",{name:"Who is here",exact:true}).click();
  await page.locator('.people-panel').getByRole("button",{name:/Your profile,/}).click();await page.getByRole("checkbox",{name:"Help improve the canvas",exact:true}).uncheck();
  expect(await page.evaluate(()=>localStorage.getItem("memory-box:measurement-disabled"))).toBe("1");
  const count=events.length;await page.reload();await expect(board(page)).toBeVisible();expect(events.length).toBe(count);
  await page.getByRole("button",{name:"Who is here",exact:true}).click();
  await page.locator('.people-panel').getByRole("button",{name:/Your profile,/}).click();
  await expect(page.getByRole("checkbox",{name:"Help improve the canvas",exact:true})).not.toBeChecked();
  await page.getByRole("checkbox",{name:"Help improve the canvas",exact:true}).check();
  expect(await page.evaluate(()=>localStorage.getItem("memory-box:measurement-disabled"))).toBeNull();
  await page.reload();await expect(board(page)).toBeVisible();
  // A new visible browser visit after explicit re-enable can capture again.
  await page.getByRole("button",{name:"Wander into a story",exact:true}).click();
  await expect.poll(()=>events.length).toBeGreaterThan(count);
});

test("a fast shared world with delayed flags still measures the visit without experiment exposure",async({page,world})=>{
  test.skip(process.env.MB_E2E_ANALYTICS!=="1","Run against the isolated analytics harness.");
  const {events}=await intercept(page,"inside-world",650);
  await world.connect(page,"/#at=-3200,2400,0.9");
  await expect(board(page)).toHaveAttribute("data-arrival-source","shared");
  await expect.poll(()=>events.filter(event=>event.event==="visit_started").length).toBe(1);
  expect(events.some(event=>event.event==="arrival_shown")).toBe(false);
});

test("late flags cannot move a fallback camera or fabricate an exposure",async({page,world})=>{
  test.skip(process.env.MB_E2E_ANALYTICS!=="1","Run against the isolated analytics harness.");
  const {events}=await intercept(page,"world-first",2200);await world.connect(page);
  await expect(board(page)).toHaveAttribute("data-arrival-source","default");const initial=await cameraState(page);
  await page.waitForTimeout(2600);expect(await cameraState(page)).toEqual(initial);expect(events.some(e=>e.event==="arrival_shown")).toBe(false);
});

test("a queued initialization cannot restart measurement after the deadline and opt-out",async({page,world})=>{
  test.skip(process.env.MB_E2E_ANALYTICS!=="1","Run against the isolated analytics harness.");
  const {requests}=await intercept(page,"inside-world");
  await page.addInitScript(()=>{
    void navigator.locks.request("memory-box:measurement:v1",()=>new Promise<void>(resolve=>{
      Object.assign(window,{releaseMeasurementLock:resolve});
    }));
  });
  await world.connect(page);await expect(board(page)).toHaveAttribute("data-arrival-source","default");
  await page.getByRole("button",{name:"Who is here",exact:true}).click();
  await page.locator('.people-panel').getByRole("button",{name:/Your profile,/}).click();
  await page.getByRole("checkbox",{name:"Help improve the canvas",exact:true}).uncheck();
  await page.evaluate(()=>{(window as Window&{releaseMeasurementLock?:()=>void}).releaseMeasurementLock?.();});
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>localStorage.getItem("memory-box:measurement:v1"))).toBeNull();
  expect(requests).toEqual([]);
});
