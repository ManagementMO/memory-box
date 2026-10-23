import {expect,test as base,type Page} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import sharp from "sharp";
import type {Memory} from "../../src/lib/types";
import {browserEnabled,cameraState,openViewTools,WorldFixture,writesEnabled} from "./helpers/open-world-fixture";

const test=base.extend<{world:WorldFixture}>({world:async({page:_page},use,info)=>{
  const fixture=new WorldFixture(info);try{await use(fixture);}finally{await fixture.cleanup();}
}});
test.skip(!browserEnabled,"Enable disposable guests with MB_E2E_OPEN_WORLD=1.");test.use({trace:"off"});
const board=(page:Page)=>page.getByRole("region",{name:"The shared Memory Box world"});
const center=async(page:Page)=>{const c=await cameraState(page),r=(await board(page).boundingBox())!;return{x:(r.width/2-c.x)/c.zoom,y:(r.height/2-c.y)/c.zoom,z:c.zoom};};
const capture=async(page:Page,name:string,device:string)=>{
  if(process.env.MB_E2E_REVIEW==="1"){await mkdir(".impeccable/review/finishing",{recursive:true});await page.screenshot({path:`.impeccable/review/finishing/${name}-${device}.png`,fullPage:true});}
};

test("readable arrival, disclosed distance tools, return location and shared-link precedence work",async({page,world},info)=>{
  test.setTimeout(60000);const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await world.connect(page);const phone=info.project.name==="mobile";
  if(phone){
    expect((await cameraState(page)).zoom).toBeGreaterThanOrEqual(.65);
    await expect(page.getByRole("button",{name:"View controls",exact:true})).toContainText("Nearby");
    await expect(page.locator("#canvas-view-menu")).toBeHidden();
    const row=await page.getByRole("button",{name:"Open world map",exact:true}).evaluate(element=>({map:element.getBoundingClientRect().top,people:document.querySelector('.world-social-controls')!.getBoundingClientRect().top}));
    expect(Math.abs(row.map-row.people)).toBeLessThan(2);
  }
  await capture(page,"arrival",info.project.name);
  const origin=await center(page);
  for(const [name,level] of [["World view","whole"],["Nearby view","wander"],["Close-up view","close"]]){
    await openViewTools(page);await page.getByRole("button",{name,exact:true}).click();
    await expect(board(page)).toHaveAttribute("data-zoom-level",level);
    await expect(page.locator('.memory-paper-copy').first()).toHaveCSS("visibility",level==="whole"?"hidden":"visible");
    const next=await center(page);expect(next.x).toBeCloseTo(origin.x,1);expect(next.y).toBeCloseTo(origin.y,1);
    if(phone){await expect(page.locator("#canvas-view-menu")).toBeHidden();await expect(page.getByRole("button",{name:"View controls",exact:true})).toBeFocused();}
  }
  await page.getByRole("button",{name:"Explore canvas",exact:true}).click();
  await page.locator('[data-place-id="cat"]').click();
  await openViewTools(page);await page.getByRole("button",{name:"Nearby view",exact:true}).click();await expect(board(page)).toHaveAttribute("data-zoom-level","wander");
  await openViewTools(page);await capture(page,"nearby",info.project.name);
  if(phone)await page.keyboard.press("Escape");
  const saved=await center(page);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("memory-box:canvas-view:v1")||"null")?.z)).toBeCloseTo(saved.z,3);
  await page.reload();await expect(page.locator(".connection-state")).toHaveText("Live");
  const restored=await center(page);expect(restored.x).toBeCloseTo(saved.x,1);expect(restored.y).toBeCloseTo(saved.y,1);expect(restored.z).toBeCloseTo(saved.z,3);
  await page.goto("/#at=-3200,2400,0.9");
  await expect.poll(async()=>Math.abs((await center(page)).x+3200)+Math.abs((await center(page)).y-2400)).toBeLessThan(.1);
  if(phone){
    await page.setViewportSize({width:320,height:640});await openViewTools(page);
    const menu=page.locator("#canvas-view-menu");const bounds=(await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(320);
    const targets=await menu.locator('button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().height));expect(Math.min(...targets)).toBeGreaterThanOrEqual(44);
    await page.getByRole("button",{name:"Move the view",exact:true}).click();
    await page.getByRole("button",{name:"Pan right",exact:true}).click();await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();await expect(page.getByRole("button",{name:"View controls",exact:true})).toBeFocused();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});

test("two builders keep their source visible and find actual painting and saved originals on the map",async({page,browser,baseURL,world},info)=>{
  test.skip(!writesEnabled,"Enable real contributions with MB_E2E_WRITE=1.");test.setTimeout(120000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));await world.connect(page);
  await page.getByRole("button",{name:"Explore canvas",exact:true}).click();await page.getByRole("button",{name:"Start a place",exact:true}).click();
  const title=`Cheese boat club ${world.runId.slice(0,8)}`;
  await page.locator('.composer-title input').fill(title);await page.locator('.composer-writing textarea').fill("Build a boat with a deeply questionable cheese captain. Leave a flag, a story or a photo beside it.");
  const publish=async(visitor:Page)=>{
    await visitor.getByRole("button",{name:"Choose its place",exact:true}).click();
    const accepted=visitor.waitForResponse(r=>new URL(r.url()).pathname==="/api/memories"&&r.request().method()==="POST");
    await visitor.getByRole("button",{name:"Leave it here",exact:true}).click();const response=await accepted;
    const text=await response.text();
    // Preserve framework/proxy responses too. Only this owned fixture's input
    // and bounded response body enter failure diagnostics, never auth headers.
    expect(response.status(),JSON.stringify({url:response.url(),contentType:response.headers()["content-type"],response:text.slice(0,2000),input:response.request().postDataJSON()})).toBe(201);
    return JSON.parse(text) as Memory;
  };
  const source=await publish(page);
  const other=await world.visitor(browser,baseURL!,page,visitor=>visitor.on("pageerror",error=>errors.push(error.message)));
  await other.getByRole("button",{name:"Explore canvas",exact:true}).click();
  await expect(other.locator('.world-map-signal')).toHaveCount(0); // Initial history is quiet, even for a fresh original.
  await other.locator('.world-place-destination').filter({hasText:title}).click();
  await other.locator(`.memory-card[data-memory-id="${source.id}"]`).click();await other.getByRole("button",{name:"Join this build",exact:true}).click();
  const fullHeight=(await other.locator('.panel-build').boundingBox())!.height;
  await other.getByRole("button",{name:"Collapse build details",exact:true}).click();
  const compact=other.locator('.panel-build.is-build-compact');await expect(compact).toBeVisible();await expect(compact.locator('h2')).toHaveText(title);
  expect((await compact.boundingBox())!.height).toBeLessThan(fullHeight*.7);
  if(info.project.name==="mobile")await expect.poll(async()=>{
    const a=(await other.locator(`.memory-card[data-memory-id="${source.id}"]`).boundingBox())!,b=(await compact.boundingBox())!;return a.y+a.height-b.y;
  }).toBeLessThanOrEqual(0);
  await capture(other,"build",info.project.name);
  await other.getByRole("button",{name:"Expand build details",exact:true}).click();await expect(other.locator('.build-request')).toHaveText(source.body);
  await other.getByRole("button",{name:"Collapse build details",exact:true}).click();await other.getByRole("button",{name:"Paint here",exact:true}).click();
  await page.getByRole("button",{name:"Explore canvas",exact:true}).click();
  await expect(page.getByRole("button",{name:"Who is here",exact:true})).toHaveAttribute("data-presence-connected","true");
  await expect(other.getByRole("button",{name:"Who is here",exact:true})).toHaveAttribute("data-presence-connected","true");
  const point=await board(other).evaluate(element=>{
    const r=element.getBoundingClientRect();for(const [fx,fy] of [[.6,.24],[.45,.22],[.7,.3],[.3,.28]]){
      const x=r.x+r.width*fx,y=r.y+r.height*fy,target=document.elementFromPoint(x,y);
      if(target&&element.contains(target)&&!target.closest('.canvas-overlay,button,input,textarea'))return{x,y};
    }throw new Error("No visible painting ground");
  });
  await other.mouse.move(point.x,point.y);await other.mouse.down();
  try{
    for(let i=1;i<=24;i++){
      await other.mouse.move(point.x+i,point.y);
      if(await page.locator('.world-place-activity[data-signal-kind="painting"]').count())break;
      await other.waitForTimeout(100);
    }
    await expect(page.locator('.world-place-activity[data-signal-kind="painting"]')).toBeVisible({timeout:3000});
    await capture(page,"activity",info.project.name);
  }finally{await other.mouse.up();}
  await expect(page.locator('.world-place-activity[data-signal-kind="painting"]')).toHaveCount(0);
  const hover={x:point.x+35,y:point.y+12};
  const hoverWorld=await board(other).evaluate((element,point)=>{
    const r=element.getBoundingClientRect();return{x:Math.round((point.x-r.x-Number((element as HTMLElement).dataset.cameraX))/Number((element as HTMLElement).dataset.cameraZoom)),y:Math.round((point.y-r.y-Number((element as HTMLElement).dataset.cameraY))/Number((element as HTMLElement).dataset.cameraZoom))};
  },hover);
  await other.mouse.move(hover.x,hover.y);
  await expect.poll(()=>page.locator('.world-cursors').evaluate((element,point)=>(JSON.parse(element.getAttribute('data-peer-cursors')||'[]') as {x:number;y:number;tool:string}[]).some(peer=>peer.x===point.x&&peer.y===point.y&&peer.tool==="paint"),hoverWorld)).toBe(true);
  await expect(page.locator('.world-place-activity[data-signal-kind="painting"]')).toHaveCount(0);
  const painted=other.waitForResponse(r=>new URL(r.url()).pathname==="/api/paint"&&r.request().method()==="POST");
  await other.getByRole("button",{name:"Share preview pixels",exact:true}).click();expect((await painted).status()).toBe(200);
  await expect(page.locator('.world-place-activity[data-signal-kind="paint"]')).toBeVisible();
  await page.locator('.world-place-activity[data-signal-kind="paint"]').click();await expect(page.locator('.world-map-panel')).toHaveCount(0);
  await other.getByRole("button",{name:"Back to build",exact:true}).click();await expect(other.locator('.panel-build.is-build-compact')).toBeVisible();
  await other.getByRole("button",{name:"Add a note",exact:true}).click();await other.locator('.composer-writing textarea').fill("The captain ate the emergency lifeboat. It was brie.");
  await other.getByRole("button",{name:"Close panel",exact:true}).click();
  await other.getByRole("button",{name:"Build together",exact:true}).click();await other.locator(`.open-build-list [data-source-id="${source.id}"]`).click();
  await expect(other.locator('.panel-build.is-build-compact')).toBeVisible();await other.locator('.build-workbench').getByRole("button",{name:"Leave a photo",exact:true}).click();
  await expect(other.locator('.composer')).toHaveAttribute('data-kind','text');await expect(other.locator('.composer-writing textarea')).toHaveValue("The captain ate the emergency lifeboat. It was brie.");
  await page.getByRole("button",{name:"Explore canvas",exact:true}).click();const note=await publish(other);expect(note.inspiredBy).toBe(source.id);expect(note.authorId).not.toBe(source.authorId);
  const marker=page.locator(`.world-map-signal[data-memory-id="${note.id}"]`);await expect(marker).toBeVisible();await marker.click();
  await expect(page.locator('.story-peek')).toHaveAttribute('data-story-id',note.id);
  await page.getByRole("button",{name:"Close story preview",exact:true}).click();await expect(page.getByRole("button",{name:"Open world map",exact:true})).toBeFocused();
  await other.getByRole("button",{name:"Build together",exact:true}).click();await other.locator(`.open-build-list [data-source-id="${source.id}"]`).click();
  await other.locator('.build-workbench').getByRole("button",{name:"Leave a photo",exact:true}).click();
  const image=await sharp({create:{width:24,height:24,channels:3,background:"#DCC7F0"}}).png().toBuffer();
  await other.getByLabel("Choose image",{exact:true}).setInputFiles({name:"cheese-boat-flag.png",mimeType:"image/png",buffer:image});await other.locator('.composer-writing textarea').fill("A lilac flag for a very dubious boat.");
  await other.getByRole("button",{name:"Close panel",exact:true}).click();
  await other.getByRole("button",{name:"Build together",exact:true}).click();await other.locator(`.open-build-list [data-source-id="${source.id}"]`).click();
  await other.getByRole("button",{name:"Add a note",exact:true}).click();
  await expect(other.locator('.composer')).toHaveAttribute('data-kind','image');await expect(other.locator('.upload-filename')).toHaveText('cheese-boat-flag.png');await expect(other.locator('.composer-writing textarea')).toHaveValue("A lilac flag for a very dubious boat.");
  const photo=await publish(other);expect(photo.inspiredBy).toBe(source.id);expect(photo.type).toBe("image");
  await expect(page.locator(`.memory-card[data-memory-id="${photo.id}"] img`)).toBeAttached();
  expect(errors).toEqual([]);
});
