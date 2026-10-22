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
  expect(original.zoom).toBeGreaterThan(.65);
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
  const styles=await page.locator('.memory-card.text').first().locator('.memory-compact-title').evaluate(element=>{
    const z=Number(element.closest('.world-board')!.getAttribute('data-camera-zoom'));
    return {display:getComputedStyle(element).display,size:parseFloat(getComputedStyle(element).fontSize)*z};
  });expect(styles.display).not.toBe("none");expect(styles.size).toBeGreaterThanOrEqual(11.5);
  await page.getByRole("button",{name:"Wander into a story",exact:true}).click();
  await expect(page.locator('.original-title')).toBeVisible();
  await page.getByRole("button",{name:"Build on this",exact:true}).click();
  await expect(page.locator('.composer .lineage')).toBeVisible();
  await page.getByRole("button",{name:"Close panel",exact:true}).click();
  if(info.project.name==="mobile"){
    await page.setViewportSize({width:320,height:740});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    const a=await page.locator('.canvas-levels').boundingBox();expect(a!.x).toBeGreaterThanOrEqual(0);expect(a!.x+a!.width).toBeLessThanOrEqual(320);
  }
  expect(errors).toEqual([]);
});
