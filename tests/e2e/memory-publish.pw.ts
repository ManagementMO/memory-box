import {expect,test as base} from "@playwright/test";
import {randomUUID} from "node:crypto";
import type {Memory,NewMemory} from "../../src/lib/types";
import {browserEnabled,sameOrigin,WorldFixture,writesEnabled} from "./helpers/open-world-fixture";

const test=base.extend<{world:WorldFixture}>({world:async({},use,info)=>{
  const fixture=new WorldFixture(info);try{await use(fixture);}finally{await fixture.cleanup();}
}});
test.skip(!browserEnabled||!writesEnabled,"Enable disposable guests and real contributions explicitly.");
test.use({trace:"off"});

test("publish keys return one original for concurrent replays and stay scoped to their contributor",async({page,browser,baseURL,world})=>{
  test.setTimeout(60000);
  await world.connect(page);
  const input:NewMemory={clientId:randomUUID(),type:"text",title:`Publish contract ${world.runId.slice(0,8)}`,
    body:"The boat has exactly one captain.",color:"#DCC7F0",x:240,y:240,sceneId:"garden"};
  const replies=await Promise.all([sameOrigin<Memory>(page,"/api/memories",input),sameOrigin<Memory>(page,"/api/memories",input)]);
  for(const reply of replies)expect(reply.status,JSON.stringify(reply)).toBe(201);
  expect(replies[0].body.id).toBe(replies[1].body.id);
  const rejected=await sameOrigin<{code:string}>(page,"/api/memories",{...input,body:"A different story must not replace the captain."});
  expect(rejected.status,JSON.stringify(rejected)).toBe(409);expect(rejected.body.code).toBe("conflict");
  const other=await world.visitor(browser,baseURL!,page);
  const independent=await sameOrigin<Memory>(other,"/api/memories",input);
  expect(independent.status,JSON.stringify(independent)).toBe(201);
  expect(independent.body.id).not.toBe(replies[0].body.id);
  expect(independent.body.authorId).not.toBe(replies[0].body.authorId);
  const ids=[...replies,rejected,independent].map(reply=>reply.requestId);
  for(const id of ids)expect(id).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  expect(new Set(ids).size).toBe(4);
  const originals=(await world.snapshot(page)).memories.filter(memory=>memory.id===replies[0].body.id||memory.id===independent.body.id);
  expect(originals).toHaveLength(2);
  for(const original of originals)expect(original.body).toBe(input.body);
});
