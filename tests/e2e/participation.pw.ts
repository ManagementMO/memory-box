import {expect,test as base,type Page} from "@playwright/test";
import sharp from "sharp";
import {sameOrigin,browserEnabled,writesEnabled,WorldFixture} from "./helpers/open-world-fixture";
import type {Memory} from "../../src/lib/types";

const test=base.extend<{world:WorldFixture}>({world:async({page:_page},use,info)=>{const fixture=new WorldFixture(info);try{await use(fixture);}finally{await fixture.cleanup();}}});
test.skip(!browserEnabled||!writesEnabled,"Opt in to disposable real integration with MB_E2E_OPEN_WORLD=1 MB_E2E_WRITE=1.");
test.use({trace:"off"});
async function closePanel(page:Page){const close=page.getByRole("button",{name:"Close panel",exact:true});if(await close.isVisible())await close.click();}
async function recover(page:Page){await page.getByRole("button",{name:"Resume unfinished work",exact:true}).click();await page.locator(".resume-recovery").first().click();}
async function capture(page:Page,name:string,project:string){if(process.env.MB_E2E_REVIEW==="1")await page.screenshot({path:`.impeccable/review/participation-${project}-${name}.png`,fullPage:true});}

test("draft and photo recovery plus a saved place preserve real collaborative changes",async({page,browser,baseURL,world},info)=>{
  test.setTimeout(150000);const errors:string[]=[],responses:number[]=[];
  page.on("pageerror",error=>errors.push(error.message));page.on("response",r=>{if(new URL(r.url()).pathname==="/api/world")responses.push(r.status());});
  await world.connect(page,"/?arrival=inside-world");
  await page.getByRole("button",{name:"Leave",exact:true}).click();
  const title=`Recovered train ${world.runId.slice(0,8)}`;
  await page.locator(".composer-title input").fill(title);
  await page.locator(".composer-writing textarea").fill("Add a carriage or a ridiculous passenger beside this note.");
  await page.getByRole("checkbox",{name:/Invite people to build here/}).check();
  await expect(page.locator(".local-draft-status")).toContainText("Saved in this browser");
  await page.reload();await expect(page.locator(".connection-state")).toHaveText("Live");
  await expect(page.locator(".composer")).toHaveCount(0);await recover(page);
  await expect(page.locator(".composer-title input")).toHaveValue(title);
  await expect(page.getByRole("checkbox",{name:/Invite people to build here/})).toBeChecked();
  await capture(page,"recovered-note",info.project.name);
  await page.getByRole("button",{name:"Choose its place",exact:true}).click();
  const accepted=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/memories"&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Leave it here",exact:true}).click();const response=await accepted;expect(response.status()).toBe(201);const source=await response.json() as Memory;
  await expect(page.locator(".original-title")).toHaveText(title);
  await page.getByRole("button",{name:"Your saved places",exact:true}).click();await page.getByLabel("Name this place",{exact:true}).fill("Our impossible train");
  await page.getByRole("button",{name:"Save this place",exact:true}).click();await expect(page.locator(".saved-place-row")).toHaveCount(1);
  await expect(page.locator(".saved-place-changes")).toContainText("No changes");
  const other=await world.visitor(browser,baseURL!,page);
  const result=await sameOrigin<Memory>(other,"/api/memories",{clientId:crypto.randomUUID(),type:"text",title:`Carriage ${world.runId.slice(0,8)}`,body:"This carriage only serves soup.",color:"#FFF3BF",x:source.x+12,y:source.y+110,sceneId:source.sceneId,inspiredBy:source.id});
  expect(result.status).toBe(201);
  await expect(page.locator(".saved-place-changes")).toContainText("1 new build-on",{timeout:30000});
  await page.reload();await expect(page.locator(".connection-state")).toHaveText("Live");
  await page.getByRole("button",{name:"Your saved places",exact:true}).click();await expect(page.locator(".saved-place-changes")).toContainText("1 new build-on");
  await capture(page,"saved-place-changes",info.project.name);
  await page.getByRole("button",{name:"Visit Our impossible train",exact:true}).click();await expect(page.locator(".original-title")).toHaveText(title);
  await page.getByRole("button",{name:"Your saved places",exact:true}).click();await expect(page.locator(".saved-place-changes")).toContainText("No changes");
  await page.getByRole("button",{name:"Rename Our impossible train",exact:true}).click();await page.getByLabel("Place name",{exact:true}).fill("Soup train");await page.getByRole("button",{name:"Save place name",exact:true}).click();
  await expect(page.getByRole("button",{name:"Visit Soup train",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Remove Soup train",exact:true}).click();await expect(page.locator(".saved-place-row")).toHaveCount(0);await closePanel(page);
  await page.getByRole("button",{name:"Leave a photo",exact:true}).click();
  const image=await sharp({create:{width:64,height:48,channels:3,background:"#DCC7F0"}}).png().toBuffer();
  await page.getByLabel("Choose image",{exact:true}).setInputFiles({name:"local-train.png",mimeType:"image/png",buffer:image});
  await page.locator(".composer-writing textarea").fill("Keep this photo caption too.");
  await expect(page.locator(".local-draft-status")).toHaveText("Saved in this browser");
  await page.reload();await expect(page.locator(".connection-state")).toHaveText("Live");await recover(page);
  await expect(page.locator(".composer-writing textarea")).toHaveValue("Keep this photo caption too.");
  await expect(page.locator(".upload-filename")).toHaveText("local-train.png");await expect(page.locator(".upload-box img")).toHaveJSProperty("complete",true);
  await capture(page,"recovered-photo",info.project.name);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect.poll(()=>responses.includes(304),{timeout:20000}).toBe(true);expect(errors).toEqual([]);
});

test("an unshared paint preview survives reload and disappears from recovery only after an accepted save",async({page,world},info)=>{
  test.setTimeout(90000);await world.connect(page,"/?arrival=world-first");
  await page.getByRole("button",{name:"Paint",exact:true}).click();
  const point=await page.locator(".world-board").evaluate(element=>{
    const r=element.getBoundingClientRect();for(const [fx,fy] of [[.52,.22],[.7,.3],[.4,.23],[.3,.4]]){const x=r.x+r.width*fx,y=r.y+r.height*fy,hit=document.elementFromPoint(x,y);if(hit&&element.contains(hit)&&!hit.closest(".canvas-overlay,button,input,textarea"))return{x,y};}throw new Error("No visible painting ground");
  });
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+10,point.y);await page.mouse.up();
  await expect(page.locator(".canvas-paint-bar")).toBeVisible();
  const before=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("memory-box:work:")).flatMap(k=>JSON.parse(localStorage.getItem(k)!).brush));expect(before.length).toBeGreaterThan(0);
  await page.reload();await expect(page.locator(".connection-state")).toHaveText("Live");await recover(page);
  const after=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("memory-box:work:")).flatMap(k=>JSON.parse(localStorage.getItem(k)!).brush));expect(after).toEqual(before);
  await capture(page,"recovered-paint",info.project.name);
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/paint"&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Share preview pixels",exact:true}).click();expect((await saved).status()).toBe(200);
  await expect(page.locator(".canvas-paint-bar")).toHaveCount(0);await page.reload();await expect(page.locator(".connection-state")).toHaveText("Live");
  await expect(page.getByRole("button",{name:"Resume unfinished work",exact:true})).toHaveCount(0);
});
