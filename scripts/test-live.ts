import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";
import {existsSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import sharp from "sharp";
import {adminClient} from "../src/lib/server/database";

if(existsSync(".env.local"))process.loadEnvFile(".env.local");
const origin=process.env.TEST_BASE_URL||"http://localhost:3007";
const runId=randomUUID().slice(0,8);
const users:string[]=[],memories:string[]=[],assets:string[]=[],operations:string[]=[];
const names=[`qa-${runId}-a`,`qa-${runId}-b`];
const clients=[0,1].map(()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}));
const tokens:string[]=[];
const checks:string[]=[];
function passed(label:string){checks.push(label);console.log("PASS",label);}
async function request(actor:number,path:string,body?:unknown,method="POST"){
 const response=await fetch(origin+path,{method,headers:{Authorization:`Bearer ${tokens[actor]}`,"Content-Type":"application/json",Origin:origin},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await response.json();return {status:response.status,body:json};
}
async function snapshot(){const r=await fetch(origin+"/api/world");assert.equal(r.status,200);return r.json();}
async function waitFor(check:()=>Promise<boolean>,maximum=12000,interval=180){const until=Date.now()+maximum;while(Date.now()<until){if(await check())return;await new Promise(resolve=>setTimeout(resolve,interval));}throw Error("Expected live state did not arrive");}

async function main(){
 for(let i=0;i<clients.length;i++){
  const {data,error}=await clients[i].auth.signInAnonymously({options:{data:{qa_run:runId}}});
  assert.equal(error,null);assert.ok(data.session);tokens.push(data.session.access_token);users.push(data.user!.id);
  const profile=await request(i,"/api/profile",{name:names[i]});assert.equal(profile.status,200);
 }
 passed("two independent authenticated guest sessions");
 await clients[1].realtime.setAuth(tokens[1]);
 const notices:{revision:number}[]=[];
 const channel=clients[1].channel("world:commons",{config:{private:true}}).on("broadcast",{event:"changed"},({payload})=>notices.push(payload));
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Private subscription timed out")),12000);channel.subscribe((state,error)=>{if(state==="SUBSCRIBED"){clearTimeout(timer);resolve();}else if(state==="CHANNEL_ERROR"){clearTimeout(timer);reject(Error(error?.message||"Private subscription failed"));}});});
 const before=await snapshot();
 const clientId=randomUUID();
 const paint=await request(0,"/api/paint",{opId:clientId,sceneId:"garden",cells:[{x:190,y:112,color:"#354FB2"}]});
 assert.equal(paint.status,200);operations.push(paint.body.operationId);
 const retry=await request(0,"/api/paint",{opId:clientId,sceneId:"garden",cells:[{x:190,y:112,color:"#354FB2"}]});
 assert.equal(retry.body.operationId,paint.body.operationId);assert.equal(retry.body.revision,paint.body.revision);
 passed("accepted paint is idempotent across retries");
 await waitFor(async()=>notices.some(notice=>notice.revision>=paint.body.revision));
 const shared=await snapshot();assert.ok(shared.revision>before.revision);assert.ok(shared.pixels.some((p:{x:number;y:number;color:string})=>p.x===190&&p.y===112&&p.color==="#354FB2"));
 passed("a second guest receives a real committed realtime change");
 const originalInput={clientId:randomUUID(),type:"text",title:`Radio summer ${runId}`,body:"Grandfather repaired a shortwave radio in the shed. We listened to distant stations together every summer and wrote the station names in a notebook.",color:"#F0DE8E",x:1100,y:680,sceneId:"garden",paintOperationId:paint.body.operationId};
 const created=await request(0,"/api/memories",originalInput);assert.equal(created.status,201);memories.push(created.body.id);
 const repeated=await request(0,"/api/memories",originalInput);assert.equal(repeated.body.id,created.body.id);
 const reply=await request(1,"/api/memories",{...originalInput,clientId:randomUUID(),title:`A receiver to restore ${runId}`,body:"This memory makes me want to restore a radio with my brother and keep a notebook of what we hear.",inspiredBy:created.body.id,paintOperationId:undefined,x:1040,y:650});
 assert.equal(reply.status,201);memories.push(reply.body.id);assert.equal(reply.body.inspiredBy,created.body.id);
 assert.equal((await request(1,`/api/memories/${created.body.id}`,{expectedVersion:1,title:"Attempted overwrite",body:"Changed by someone else"},"PATCH")).status,403);
 passed("build-on creates a separate attributed original and prevents cross-author edits");
 const upload=await request(0,"/api/uploads",{name:"private-photo.png",mime:"image/png",size:512});assert.equal(upload.status,200);assets.push(upload.body.assetId);
 const beforePublish=await fetch(origin+`/api/assets/${upload.body.assetId}`);assert.equal(beforePublish.status,404);
 const image=await sharp({create:{width:180,height:120,channels:3,background:"#354FB2"}}).png().withExif({IFD0:{Artist:"Private camera metadata"}}).toBuffer();
 const uploaded=await clients[0].storage.from("memory-staging").uploadToSignedUrl(upload.body.path,upload.body.token,image,{contentType:"image/png"});assert.equal(uploaded.error,null);
 const picture=await request(0,"/api/memories",{clientId:randomUUID(),type:"image",title:`Windy lighthouse ${runId}`,body:"A little piece of a windy lighthouse picnic.",assetId:upload.body.assetId,color:"#BED5DE",x:1000,y:680,sceneId:"garden",inspiredBy:created.body.id});
 assert.equal(picture.status,201);memories.push(picture.body.id);
 const delivered=await fetch(origin+picture.body.imageUrl);assert.equal(delivered.status,200);assert.equal(delivered.headers.get("content-type"),"image/webp");
 const metadata=await sharp(Buffer.from(await delivered.arrayBuffer())).metadata();assert.equal(metadata.exif,undefined);
 passed("private staged image becomes a sanitized published raster");
 const search=await request(1,"/api/search",{query:`Radio summer ${runId}`});assert.equal(search.status,200);assert.ok(search.body.results.some((r:{memory:{id:string}})=>r.memory.id===created.body.id));
 passed("new original words are immediately searchable");
 await waitFor(async()=>{const current=await snapshot();return current.memories.some((m:{id:string;indexStatus:string;imageDescription?:string})=>m.id===picture.body.id&&m.indexStatus==="ready"&&/blue/i.test(m.imageDescription||""));},65000,800);
 const visual=await request(1,"/api/search",{query:"blue"});assert.equal(visual.status,200);assert.ok(visual.body.results.some((r:{memory:{id:string}})=>r.memory.id===picture.body.id));
 passed("a visual detail absent from the author's words is searchable through the actual image description");
 const semantic=await request(1,"/api/search",{query:"childhood road trips"});assert.equal(semantic.status,200);assert.equal(semantic.body.mode,"hybrid");assert.ok(semantic.body.results.some((r:{memory:{title:string};match:string})=>r.memory.title==="The long way home"&&r.match!=="keyword"));
 passed("a nonliteral paraphrase retrieves the childhood car memory with real vectors");
 const answer=await request(1,"/api/ask",{query:"What do these memories say about music and family?"});assert.equal(answer.status,200);assert.equal(answer.body.status,"answered");
 const allowed=new Set(answer.body.results.map((r:{memory:{id:string}})=>r.memory.id));assert.ok(answer.body.claims.length>0);for(const claim of answer.body.claims)for(const id of claim.sourceIds)assert.ok(allowed.has(id));
 passed("a real model answer cites only its retrieved originals");
 const unrelated=await request(1,"/api/ask",{query:"What is Neptune's exact distance from the Sun in kilometers?"});assert.equal(unrelated.status,200);assert.equal(unrelated.body.status,"insufficient");assert.equal(unrelated.body.claims.length,0);
 passed("an unrelated factual question produces no invented community answer");
 const edited=await request(0,`/api/memories/${created.body.id}`,{expectedVersion:1,title:originalInput.title,body:"The radio notebook has been put away. This is an updated original."},"PATCH");assert.equal(edited.status,200);assert.equal(edited.body.version,2);
 assert.equal((await request(0,`/api/memories/${created.body.id}`,{expectedVersion:1,title:"Stale edit",body:"outdated"},"PATCH")).status,409);
 passed("editing advances the source version and rejects stale updates");
 assert.equal((await request(0,`/api/memories/${picture.body.id}`,undefined,"DELETE")).status,200);
 assert.equal((await fetch(origin+picture.body.imageUrl)).status,404);
 passed("deleting an image blocks new image delivery immediately");
 assert.equal((await request(0,`/api/memories/${created.body.id}`,undefined,"DELETE")).status,200);
 const removed=await request(1,"/api/search",{query:`Radio summer ${runId}`});assert.ok(!removed.body.results.some((r:{memory:{id:string}})=>r.memory.id===created.body.id));
 const still=await snapshot();assert.ok(still.memories.some((m:{id:string;inspiredBy:string})=>m.id===reply.body.id&&m.inspiredBy===created.body.id));
 passed("removed originals leave retrieval while independently authored responses survive");
 const undo=await request(0,"/api/paint/undo",{operationId:paint.body.operationId});assert.equal(undo.status,200);
 passed("the original painter can undo accepted cells");
}

async function cleanup(){
 const db=adminClient();
 if(users[0])for(const id of operations)await db.rpc("mb_undo_paint",{p_actor:users[0],p_operation_id:id});
 for(const id of memories)await db.from("memories").update({visibility:"deleted"}).eq("id",id);
 if(memories.length){await db.from("world_events").delete().in("memory_id",memories);await db.from("index_jobs").delete().in("memory_id",memories);await db.from("memory_embeddings").delete().in("memory_id",memories);}
 if(operations.length){await db.from("world_events").delete().in("operation_id",operations);}
 for(const name of names)await db.from("world_events").delete().eq("author_name",name);
 for(const id of assets){const {data}=await db.from("assets").select("path,staging_path").eq("id",id).maybeSingle();if(data?.path)await db.storage.from("memory-assets").remove([data.path]);if(data?.staging_path)await db.storage.from("memory-staging").remove([data.staging_path]);await db.from("assets").update({status:"deleted"}).eq("id",id);}
 for(const client of clients)await client.removeAllChannels();
 for(const id of users)await db.auth.admin.deleteUser(id);
 writeFileSync("auth/last-live-test.json",JSON.stringify({runId,origin,checks,completedAt:new Date().toISOString(),cleaned:true},null,2));
}

main().then(()=>console.log(`Live integration passed: ${checks.length} checks.`)).catch(error=>{console.error("LIVE TEST FAILED",error instanceof Error?error.message:"Unknown failure");process.exitCode=1;}).finally(cleanup);
