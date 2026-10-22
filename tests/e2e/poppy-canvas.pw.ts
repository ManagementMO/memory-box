import {expect,test as base} from "@playwright/test";
import {browserEnabled,cameraState,WorldFixture} from "./helpers/open-world-fixture";

const test=base.extend<{world:WorldFixture}>({world:async({page:_page},use,info)=>{const fixture=new WorldFixture(info);try{await use(fixture);}finally{await fixture.cleanup();}}});
test.skip(!browserEnabled,"Enable disposable real browser identities with MB_E2E_OPEN_WORLD=1.");
test.use({trace:"off"});

test("three canvas distances preserve the actual place and keep originals usable on narrow screens",async({page,world},info)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await world.connect(page);
  const board=page.getByRole("region",{name:"The shared Memory Box world"});
  const original=await cameraState(page);
  const box=await board.boundingBox();expect(box).not.toBeNull();
  expect(original.zoom).toBeLessThan(.52);
  const center={x:(box!.width/2-original.x)/original.zoom,y:(box!.height/2-original.y)/original.zoom};
  for(const [label,level] of [["View the whole patch","whole"],["View at wandering distance","wander"],["View up close","close"]]){
    await page.getByRole("button",{name:label,exact:true}).click();
    await expect(board).toHaveAttribute("data-zoom-level",level);
    const current=await cameraState(page);
    expect(Math.abs((box!.width/2-current.x)/current.zoom-center.x)).toBeLessThan(.1);
    expect(Math.abs((box!.height/2-current.y)/current.zoom-center.y)).toBeLessThan(.1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
  await page.getByRole("button",{name:"View the whole patch",exact:true}).click();
  for(let step=0;step<5;step++)await page.getByRole("button",{name:"Zoom out",exact:true}).click();
  await expect(page.locator('.world-transformed')).toHaveAttribute('data-map','true');
  const styles=await page.locator('.memory-card.text').first().evaluate(element=>({
    body:getComputedStyle(element.querySelector('.memory-paper-copy')!).display,
    pin:getComputedStyle(element.querySelector('.memory-pin')!).display,
    physicalWidth:parseFloat(getComputedStyle(element).width),
  }));expect(styles.body).not.toBe("none");expect(styles.pin).toBe("none");expect(styles.physicalWidth).toBeLessThan(230);
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
