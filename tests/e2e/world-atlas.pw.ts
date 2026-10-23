import { expect, test as base } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { browserEnabled, cameraState, WorldFixture, writesEnabled } from "./helpers/open-world-fixture";
import type { Memory } from "../../src/lib/types";

const test=base.extend<{world:WorldFixture}>({world:async({page:_page},use,info)=>{
  const fixture=new WorldFixture(info);try{await use(fixture);}finally{await fixture.cleanup();}
}});
test.skip(!browserEnabled,"Enable isolated real guests with MB_E2E_OPEN_WORLD=1.");
test.use({trace:"off"});

test("the world map travels between actual places and keeps a short phone usable",async({page,world},info)=>{
  await world.connect(page);
  await expect(page.locator('.world-geography')).toBeVisible();
  await expect(page.locator('.world-place-label:not([hidden])').first()).toBeVisible();
  expect(await page.locator('.world-board').evaluate(board=>{
    const papers=[...board.querySelectorAll('.memory-card')].map(element=>element.getBoundingClientRect());
    return [...board.querySelectorAll<HTMLElement>('.world-place-label:not([hidden])')].filter(label=>{
      const r=label.getBoundingClientRect();return papers.some(p=>r.left<p.right&&r.right>p.left&&r.top<p.bottom&&r.bottom>p.top);
    }).map(label=>label.dataset.areaId);
  })).toEqual([]);
  if(info.project.name==="mobile"){
    const separation=()=>page.getByRole('button',{name:'Open world map',exact:true}).evaluate(element=>element.getBoundingClientRect().right-document.querySelector('.world-social-controls')!.getBoundingClientRect().left);
    await expect.poll(separation).toBeLessThanOrEqual(-4);
  }
  const capture=async(name:string)=>{if(process.env.MB_E2E_REVIEW==="1"){
    await mkdir('.impeccable/review',{recursive:true});await page.screenshot({path:`.impeccable/review/atlas-${name}-${info.project.name}.png`,fullPage:true});
  }};
  await capture("world");
  await page.getByRole('button',{name:'Explore canvas',exact:true}).click();
  await expect(page.locator('.world-map-panel')).toBeVisible();
  const actual=await world.snapshot(page);
  expect(actual.memories.length).toBeGreaterThan(0);
  await expect(page.locator('.world-map-canvas')).toBeVisible();
  await expect(page.locator('.world-map-viewport')).toBeVisible();
  expect(await page.locator('.world-map-viewport').evaluate(element=>getComputedStyle(element).pointerEvents)).toBe('none');
  const places=page.locator('.world-place-list > button');expect(await places.count()).toBeGreaterThan(3);
  await expect.poll(()=>page.locator('.world-map-canvas').evaluate(element=>(element as HTMLCanvasElement).width)).toBeGreaterThan(100);
  await capture("map");
  await page.locator('.world-place-list [data-place-id="cat"]').click();
  await expect(page.locator('.world-map-panel')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open world map',exact:true})).toContainText('Cat country');
  const cat=await cameraState(page);expect(cat.zoom).toBeGreaterThan(.15);
  await capture("neighborhood");
  await page.getByRole('button',{name:'Wander into a story',exact:true}).click();
  const originalId=await page.locator('.memory-card.is-selected').getAttribute('data-memory-id');
  await page.getByRole('button',{name:'Close story preview',exact:true}).click();
  // Recreate the observed label/card collision without moving stored artwork.
  // An original must retain hit priority even when a map label overlaps it.
  expect(await page.locator(`.memory-card[data-memory-id="${originalId}"]`).evaluate(element=>{
    const board=element.closest('.world-board')!,label=board.querySelector<HTMLElement>('.world-place-label')!;
    const r=element.getBoundingClientRect(),b=board.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const previous={style:label.style.cssText,hidden:label.hidden};
    label.hidden=false;label.style.left=`${x-b.x}px`;label.style.top=`${y-b.y-22}px`;label.style.width='180px';
    try{return !!document.elementFromPoint(x,y)?.closest('.memory-card');}
    finally{label.style.cssText=previous.style;label.hidden=previous.hidden;}
  })).toBe(true);
  await page.getByRole('button',{name:'Open world map',exact:true}).focus();await page.keyboard.press('Enter');
  await page.locator('.world-place-list [data-place-id="waterloo"]').focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Open world map',exact:true})).toContainText('Waterloo');
  await expect(page.getByRole('button',{name:'Open world map',exact:true})).toBeFocused();
  const campus=await cameraState(page);expect(Math.abs(campus.x-cat.x)).toBeGreaterThan(100);
  if(info.project.name==="mobile"){
    await page.setViewportSize({width:320,height:640});
    await page.getByRole('button',{name:'Open world map',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await expect.poll(()=>page.locator('.context-panel.panel-world').evaluate(element=>{
      const r=element.getBoundingClientRect(),dock=document.querySelector('.canvas-dock')!.getBoundingClientRect();return r.bottom-dock.top;
    })).toBeLessThanOrEqual(0);
    expect(await places.first().evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
});

test("two visitors start a real remote place and paint, leave linked notes and photos, then revisit after reload",async({page,browser,baseURL,world},info)=>{
  test.skip(!writesEnabled,"Real contributions require MB_E2E_WRITE=1.");test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await world.connect(page);
  // Merely opening Note must not trap the visitor in a blank ordinary draft.
  await page.getByRole('button',{name:'Leave',exact:true}).click();
  await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.getByRole('button',{name:'Explore canvas',exact:true}).click();
  await page.getByRole('button',{name:'Start a place',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/Invite people to build here/})).toBeChecked();
  const title=`Moon lake ${world.runId.slice(0,8)}`;
  await page.locator('.composer-title input').fill(title);
  await page.locator('.composer-writing textarea').fill('A lake for extremely unqualified astronauts. Draw a tiny boat or leave a story about the night sky.');
  const publish=async(visitor:typeof page)=>{
    await visitor.getByRole('button',{name:'Choose its place',exact:true}).click();
    const accepted=visitor.waitForResponse(r=>new URL(r.url()).pathname==='/api/memories'&&r.request().method()==='POST');
    await visitor.getByRole('button',{name:'Leave it here',exact:true}).click();
    const response=await accepted;expect(response.status()).toBe(201);return await response.json() as Memory;
  };
  const source=await publish(page);expect(source.isBuildInvitation).toBe(true);
  const other=await world.visitor(browser,baseURL!,page,visitor=>visitor.on('pageerror',error=>errors.push(error.message)));
  await other.getByRole('button',{name:'Explore canvas',exact:true}).click();
  const place=other.locator('.world-place-list > button').filter({hasText:title});await expect(place).toHaveCount(1);
  const placeId=await place.getAttribute('data-place-id');expect(placeId).toMatch(/^place:/);
  await place.click();
  await other.locator(`.memory-card[data-memory-id="${source.id}"]`).click();
  await other.getByRole('button',{name:'Join this build',exact:true}).click();
  await other.getByRole('button',{name:'Paint here',exact:true}).click();
  const point=await other.locator('.world-board').evaluate(element=>{
    const r=element.getBoundingClientRect();for(const [fx,fy] of [[.6,.24],[.45,.22],[.7,.3],[.3,.28]]){
      const x=r.x+r.width*fx,y=r.y+r.height*fy,hit=document.elementFromPoint(x,y);
      if(hit&&element.contains(hit)&&!hit.closest('.canvas-overlay,button,input,textarea'))return{x,y};
    }throw new Error('No visible painting ground.');
  });
  await other.mouse.move(point.x,point.y);await other.mouse.down();await other.mouse.move(point.x+8,point.y);await other.mouse.up();
  const accepted=other.waitForResponse(r=>new URL(r.url()).pathname==='/api/paint'&&r.request().method()==='POST');
  await other.getByRole('button',{name:'Share preview pixels',exact:true}).click();
  const painted=await accepted;expect(painted.status()).toBe(200);const result=await painted.json();
  await expect.poll(async()=>Number(await page.locator('.world-board').getAttribute('data-world-revision'))).toBeGreaterThanOrEqual(result.revision);
  const current=await world.snapshot(page);expect(current.pixels.some(p=>p.x===result.pixels[0].x&&p.y===result.pixels[0].y&&p.color===result.pixels[0].color)).toBe(true);
  await other.getByRole('button',{name:'Back to build',exact:true}).click();
  await other.getByRole('button',{name:'Add a note',exact:true}).click();
  await other.locator('.composer-writing textarea').fill('The boat is entirely made of cheese. It has passed no inspections.');
  const note=await publish(other);expect(note.inspiredBy).toBe(source.id);expect(note.authorId).not.toBe(source.authorId);
  await other.getByRole('button',{name:'Build together',exact:true}).click();
  await other.locator(`.open-build-list [data-source-id="${source.id}"]`).click();
  await other.locator('.build-workbench').getByRole('button',{name:'Leave a photo',exact:true}).click();
  const image=await sharp({create:{width:24,height:24,channels:3,background:'#DCC7F0'}}).png().toBuffer();
  await other.getByLabel('Choose image',{exact:true}).setInputFiles({name:'moon-lake-fixture.png',mimeType:'image/png',buffer:image});
  await other.locator('.composer-writing textarea').fill('A lilac flag for the first landing.');
  const photo=await publish(other);expect(photo.type).toBe('image');expect(photo.inspiredBy).toBe(source.id);
  await page.reload();await expect(page.locator('.connection-state')).toHaveText('Live');
  await page.getByRole('button',{name:'Explore canvas',exact:true}).click();
  await page.locator('.world-place-list > button').filter({hasText:title}).click();
  await page.locator(`.memory-card[data-memory-id="${source.id}"]`).click();
  await page.getByRole('button',{name:'Join this build',exact:true}).click();
  await expect(page.locator(`.memory-card[data-memory-id="${note.id}"]`)).toHaveCount(1);
  await expect(page.locator(`.memory-card[data-memory-id="${photo.id}"] img`)).toBeAttached();
  if(process.env.MB_E2E_REVIEW==="1")await page.screenshot({path:`.impeccable/review/atlas-build-${info.project.name}.png`,fullPage:true});
  expect(errors).toEqual([]);
});
