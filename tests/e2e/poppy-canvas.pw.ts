import {expect,test as base} from "@playwright/test";
import {browserEnabled,cameraState,openViewTools,sameOrigin,WorldFixture,writesEnabled} from "./helpers/open-world-fixture";
import type {Memory,Pixel} from "../../src/lib/types";
import sharp from "sharp";
import {mkdir} from "node:fs/promises";

const test=base.extend<{world:WorldFixture}>({world:async({page:_page},use,info)=>{const fixture=new WorldFixture(info);try{await use(fixture);}finally{await fixture.cleanup();}}});
test.skip(!browserEnabled,"Enable disposable real browser identities with MB_E2E_OPEN_WORLD=1.");
test.use({trace:"off"});

test("three canvas distances preserve the actual place and keep originals usable on narrow screens",async({page,world},info)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await world.connect(page);
  const board=page.getByRole("region",{name:"The shared Memory Box world"});
  const original=await cameraState(page);
  const box=await board.boundingBox();expect(box).not.toBeNull();
  if(info.project.name==="mobile")expect(original.zoom).toBeGreaterThanOrEqual(.65);else expect(original.zoom).toBeLessThan(.52);
  const center={x:(box!.width/2-original.x)/original.zoom,y:(box!.height/2-original.y)/original.zoom};
  for(const [label,level] of [["World view","whole"],["Nearby view","wander"],["Close-up view","close"]]){
    await openViewTools(page);
    await page.getByRole("button",{name:label,exact:true}).click();
    await expect(board).toHaveAttribute("data-zoom-level",level);
    const current=await cameraState(page);
    expect(Math.abs((box!.width/2-current.x)/current.zoom-center.x)).toBeLessThan(.1);
    expect(Math.abs((box!.height/2-current.y)/current.zoom-center.y)).toBeLessThan(.1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
  await openViewTools(page);await page.getByRole("button",{name:"World view",exact:true}).click();
  await openViewTools(page);
  for(let step=0;step<5;step++)await page.getByRole("button",{name:"Zoom out",exact:true}).click();
  await expect(page.locator('.world-transformed')).toHaveAttribute('data-map','true');
  const styles=await page.locator('.memory-card.text').first().evaluate(element=>({
    body:getComputedStyle(element.querySelector('.memory-paper-copy')!).visibility,
    pin:getComputedStyle(element.querySelector('.memory-pin')!).display,
    physicalWidth:parseFloat(getComputedStyle(element).width),
  }));expect(styles.body).toBe("hidden");expect(styles.pin).toBe("none");expect(styles.physicalWidth).toBeLessThan(230);
  expect(await page.locator('.memory-card.image').first().locator('.memory-photo').evaluate(e=>getComputedStyle(e).display)).toBe('flex');
  await page.getByRole("button",{name:"Wander into a story",exact:true}).click();
  await expect(page.getByRole('region',{name:'Story preview',exact:true})).toBeVisible();
  await expect(page.locator('.panel-inspect')).toHaveCount(0);
  const first=await page.locator('.story-peek').getAttribute('data-story-id');
  await page.getByRole('button',{name:'Wander to another story',exact:true}).click();
  await expect(page.locator('.story-peek')).not.toHaveAttribute('data-story-id',first!);
  await page.getByRole("button",{name:"Build on",exact:true}).click();
  await expect(page.locator('.world-board .world-story-overlay.is-compose .composer')).toBeVisible();
  await expect(page.locator('.composer .lineage')).toBeVisible();
  await page.getByRole("button",{name:"Close panel",exact:true}).click();
  if(info.project.name==="mobile"){
    await page.setViewportSize({width:320,height:740});
    await openViewTools(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    const a=await page.locator('.canvas-levels').boundingBox();expect(a!.x).toBeGreaterThanOrEqual(0);expect(a!.x+a!.width).toBeLessThanOrEqual(320);
  }
  expect(errors).toEqual([]);
});

test("closing a story preview restores its keyboard invoker after Next and Escape",async({page,world})=>{
  await world.connect(page);
  const wander=page.getByRole("button",{name:"Wander into a story",exact:true});
  await wander.focus();await wander.press("Enter");
  await expect(page.locator('.story-peek')).toBeFocused();
  await page.getByRole("button",{name:"Wander to another story",exact:true}).click();
  await page.getByRole("button",{name:"Close story preview",exact:true}).click();
  await expect(wander).toBeFocused();
  await wander.press("Enter");
  await expect(page.locator('.story-peek')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator('.story-peek')).toHaveCount(0);
  await expect(wander).toBeFocused();
});

test("a parked reply returns to its source with its draft and usable writing space",async({page,world},info)=>{
  await world.connect(page);
  if(info.project.name==="mobile")await page.setViewportSize({width:320,height:640});
  await page.getByRole("button",{name:"Wander into a story",exact:true}).click();
  const source=await page.locator('.story-peek').getAttribute('data-story-id');
  await page.getByRole("button",{name:"Build on",exact:true}).click();
  const writer=page.locator('.world-story-overlay .composer-writing textarea');
  if(info.project.name==="mobile"){
    const visible=await writer.evaluate(element=>{
      const box=element.getBoundingClientRect(),panel=element.closest('.context-panel')!.getBoundingClientRect();
      return Math.max(0,Math.min(box.bottom,panel.bottom)-Math.max(box.top,panel.top));
    });
    expect(visible).toBeGreaterThanOrEqual(140);
  }
  const before=await cameraState(page);
  await writer.fill("Keep this reply while I wander elsewhere.");
  await page.getByRole("button",{name:"Close panel",exact:true}).click();
  await page.getByRole("button",{name:"Wander into a story",exact:true}).click();
  await expect(page.locator('.story-peek')).not.toHaveAttribute('data-story-id',source!);
  await page.getByRole("button",{name:"Leave",exact:true}).click();
  await expect(writer).toHaveValue("Keep this reply while I wander elsewhere.");
  await expect(page.locator('.memory-card.is-selected')).toHaveAttribute('data-memory-id',source!);
  const resumed=await cameraState(page);
  expect(resumed.zoom).toBeCloseTo(before.zoom,4);
  expect(resumed.x).toBeCloseTo(before.x,1);
  expect(resumed.y).toBeCloseTo(before.y,1);
  await page.getByRole("button",{name:"Choose its place",exact:true}).click();
  await page.getByRole("button",{name:"Cancel placement",exact:true}).click();
  await expect(writer).toHaveValue("Keep this reply while I wander elsewhere.");
});

test("two visitors discover an authored build, paint and leave linked notes and photos in place",async({page,browser,baseURL,world},info)=>{
  test.skip(!writesEnabled,"Real invitation, upload and paint transactions require MB_E2E_WRITE=1.");
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await world.connect(page);
  await page.getByRole("button",{name:"Build together",exact:true}).click();
  await expect(page.getByRole("button",{name:"Start a build here",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Start a build here",exact:true}).click();
  await expect(page.getByRole("checkbox",{name:/Invite people to build here/})).toBeChecked();
  expect(await page.getByRole("checkbox",{name:/Invite people to build here/}).evaluate(element=>getComputedStyle(element).appearance)).not.toBe("none");
  const title=`Goose wardrobe ${world.runId.slice(0,8)}`;
  await page.locator(".composer-title input").fill(title);
  await page.getByRole("textbox",{name:/What can people help make/}).fill("Give this goose the worst interview outfit. Add a tiny briefcase or a wildly bad tie.");
  if(process.env.MB_E2E_REVIEW==="1"){
    await mkdir(".impeccable/review",{recursive:true});
    await page.locator(".build-invitation-toggle").screenshot({path:`.impeccable/review/invitation-toggle-${info.project.name}.png`});
  }
  const publish=async(visitor:typeof page)=>{
    await visitor.getByRole("button",{name:"Choose its place",exact:true}).click();
    const accepted=visitor.waitForResponse(r=>new URL(r.url()).pathname==="/api/memories"&&r.request().method()==="POST");
    await visitor.getByRole("button",{name:"Leave it here",exact:true}).click();
    const response=await accepted;expect(response.status()).toBe(201);return await response.json() as Memory;
  };
  const invitation=await publish(page);expect(invitation.isBuildInvitation).toBe(true);
  await page.getByRole("button",{name:"Join this build",exact:true}).click();
  await expect(page.locator(".world-story-overlay .build-workbench")).toHaveAttribute("data-build-id",invitation.id);
  const other=await world.visitor(browser,baseURL!,page,visitor=>visitor.on("pageerror",error=>errors.push(error.message)));
  let capturedTogether=false;
  const join=async()=>{
    await other.getByRole("button",{name:"Build together",exact:true}).click();
    if(process.env.MB_E2E_REVIEW==="1"&&!capturedTogether){
      await mkdir(".impeccable/review",{recursive:true});capturedTogether=true;
      await other.screenshot({path:`.impeccable/review/together-${info.project.name}.png`,fullPage:true});
    }
    await other.locator(`.open-build-list [data-source-id="${invitation.id}"]`).click();
    await expect(other.locator(".world-story-overlay .build-workbench")).toHaveAttribute("data-build-id",invitation.id);
  };
  await join();
  if(process.env.MB_E2E_REVIEW==="1"){
    await mkdir(".impeccable/review",{recursive:true});
    await other.screenshot({path:`.impeccable/review/open-build-${info.project.name}.png`,fullPage:true});
  }
  const foreign=await sameOrigin(other,`/api/memories/${invitation.id}`,{expectedVersion:1,title,body:invitation.body,isBuildInvitation:false},"PATCH");
  expect(foreign.status).toBe(403);
  const legacy=await sameOrigin<Memory>(page,`/api/memories/${invitation.id}`,{expectedVersion:1,title,body:invitation.body+" Anyone can add to it."},"PATCH");
  expect(legacy.status).toBe(200);expect(legacy.body.isBuildInvitation).toBe(true);
  const blank=await sameOrigin(page,`/api/memories/${invitation.id}`,{expectedVersion:legacy.body.version,title,body:" "},"PATCH");
  expect(blank.status).toBe(400);
  await expect(other.locator(".build-request")).toHaveText(legacy.body.body);
  await other.getByRole("button",{name:"Paint here",exact:true}).click();
  await expect(other.getByRole("button",{name:"Back to build",exact:true})).toBeVisible();
  const point=await other.locator(".world-board").evaluate(element=>{
    const rect=element.getBoundingClientRect();
    for(const [fx,fy] of [[.6,.24],[.45,.22],[.7,.3],[.3,.28]]){
      const x=rect.x+rect.width*fx,y=rect.y+rect.height*fy;const hit=document.elementFromPoint(x,y);
      if(hit&&element.contains(hit)&&!hit.closest(".canvas-overlay,button,input,textarea"))return{x,y};
    }
    throw new Error("No visible canvas for a build pixel.");
  });
  await other.mouse.move(point.x,point.y);await other.mouse.down();await other.mouse.move(point.x+8,point.y);await other.mouse.up();
  const painted=other.waitForResponse(r=>new URL(r.url()).pathname==="/api/paint"&&r.request().method()==="POST");
  await other.getByRole("button",{name:"Share preview pixels",exact:true}).click();
  const paintResponse=await painted;expect(paintResponse.status()).toBe(200);
  const paintResult=await paintResponse.json();
  const pixels=paintResult.pixels as Pixel[];expect(pixels.length).toBeGreaterThan(0);
  await expect.poll(async()=>Number(await page.locator(".world-board").getAttribute("data-world-revision"))).toBeGreaterThanOrEqual(paintResult.revision);
  // Both visitors use the real camera tools to see the same painted area. A
  // phone's anchored source strip can otherwise leave this cell offscreen.
  await page.getByRole("button",{name:"Build together",exact:true}).click();
  await page.getByRole("button",{name:"Visit a live painter",exact:true}).click();
  const cell=pixels[0],rgb=[1,3,5].map(offset=>parseInt(cell.color.slice(offset,offset+2),16));
  await expect.poll(()=>page.locator(".world-pixels").evaluate((element,cell)=>{
    const canvas=element as HTMLCanvasElement,board=canvas.closest(".world-board")! as HTMLElement,z=Number(board.dataset.cameraZoom);
    const x=(Number(board.dataset.cameraX)+(cell.x+.5)*6*z)*canvas.width/canvas.clientWidth,y=(Number(board.dataset.cameraY)+(cell.y+.5)*6*z)*canvas.height/canvas.clientHeight;
    return [...canvas.getContext("2d")!.getImageData(Math.floor(x),Math.floor(y),1,1).data].slice(0,3);
  },cell)).toEqual(rgb);
  await other.getByRole("button",{name:"Back to build",exact:true}).click();
  await other.getByRole("button",{name:"Add a note",exact:true}).click();
  const responseText="A briefcase full of stale bread. This goose means business.";
  await other.locator(".composer-writing textarea").fill(responseText);
  await expect.poll(async()=>other.locator(".world-story-overlay > .context-panel").evaluate(element=>{
    const panel=element.getBoundingClientRect(),board=element.closest(".world-board")!.getBoundingClientRect();
    return panel.bottom-board.bottom;
  })).toBeLessThanOrEqual(-70);
  if(process.env.MB_E2E_REVIEW==="1")await other.screenshot({path:`.impeccable/review/build-response-${info.project.name}.png`,fullPage:true});
  await other.getByRole("button",{name:"Close panel",exact:true}).click();
  await join();await other.getByRole("button",{name:"Add a note",exact:true}).click();
  await expect(other.locator(".composer-writing textarea")).toHaveValue(responseText);
  const note=await publish(other);expect(note.inspiredBy).toBe(invitation.id);expect(note.authorId).not.toBe(invitation.authorId);
  await expect(page.locator(`.memory-card[data-memory-id="${note.id}"]`)).toHaveCount(1);
  await join();await other.locator(".build-workbench").getByRole("button",{name:"Leave a photo",exact:true}).click();
  const image=await sharp({create:{width:24,height:24,channels:3,background:"#DCC7F0"}}).png().toBuffer();
  await other.getByLabel("Choose image",{exact:true}).setInputFiles({name:"fixture-briefcase.png",mimeType:"image/png",buffer:image});
  await other.locator(".composer-writing textarea").fill("A little lilac briefcase for the outfit.");
  const photo=await publish(other);expect(photo.inspiredBy).toBe(invitation.id);expect(photo.type).toBe("image");
  await expect(page.locator(`.memory-card[data-memory-id="${photo.id}"] img`)).toBeAttached();
  await join();
  if(info.project.name==="mobile"){
    await other.setViewportSize({width:320,height:640});
    expect(await other.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    const geometry=()=>other.locator(".build-workbench").evaluate(element=>{
      const button=element.querySelector("button")!.getBoundingClientRect();
      const panel=element.closest(".context-panel")!.getBoundingClientRect();
      const source=document.querySelector(".memory-card.is-selected")!.getBoundingClientRect();
      const dock=document.querySelector('.canvas-dock')!.getBoundingClientRect();
      return {target:button.height,sourceBottom:source.bottom,panelTop:panel.top,panelBottom:panel.bottom,dockTop:dock.top};
    });
    // ResizeObserver and the explicit source camera settle after setViewportSize.
    await expect.poll(async()=>{const g=await geometry();return g.sourceBottom-g.panelTop;}).toBeLessThanOrEqual(0);
    await expect.poll(async()=>{const g=await geometry();return g.panelBottom-g.dockTop;}).toBeLessThanOrEqual(0);
    expect((await geometry()).target).toBeGreaterThanOrEqual(44);
    if(process.env.MB_E2E_REVIEW==="1")await other.screenshot({path:".impeccable/review/open-build-mobile-320.png",fullPage:true});
  }
  await page.getByRole("button",{name:"Build together",exact:true}).click();
  await page.locator(`.open-build-list [data-source-id="${invitation.id}"]`).click();
  await page.getByRole("button",{name:"Read original",exact:true}).click();
  await page.getByRole("button",{name:"Edit memory",exact:true}).click();
  await expect(page.getByRole("checkbox",{name:/Invite people to build here/})).toBeChecked();
  await page.getByRole("checkbox",{name:/Invite people to build here/}).uncheck();
  await page.getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(other.locator(".build-workbench")).toContainText("This invitation is closed.");
  await expect(other.locator(".build-workbench").getByRole("button",{name:"Paint here",exact:true})).toHaveCount(0);
  const removed=await sameOrigin(page,`/api/memories/${invitation.id}`,undefined,"DELETE");expect(removed.status).toBe(200);
  await expect(other.locator(".build-workbench")).toContainText("This invitation is no longer available.");
  const current=await world.snapshot(other);expect(current.memories.some(m=>m.id===note.id)).toBe(true);expect(current.memories.some(m=>m.id===photo.id)).toBe(true);
  expect(errors).toEqual([]);
});
