import { describe, expect, it } from "vitest";
import { newDraft } from "../src/components/memory-composer";
import { createRecovery, decodeRecovery, recoveryKey, readRecoveries, writeRecovery, removeRecovery, prepareRecoveredDraft, type RecoveryScope } from "../src/lib/client/contribution-recovery";

const scope:RecoveryScope={worldId:"commons",epoch:1,actorId:"guest-a"};
const id="8b4a4b83-ad5f-44d8-beb5-68b28d458a31";
const draftId="52f17e73-7735-460d-b566-c70696fd8c90";
const input=()=>({draft:{...newDraft(),clientId:draftId,body:"An unfinished train 🚂",inspiredBy:"d8ba9df1-9e5a-422f-b8e5-60d2592de669"},brush:[{x:10,y:20,color:"#F3617C"}],brushOperationId:id,sceneId:"pond" as const,joinedBuildId:null,pending:null,camera:{x:60,y:120,z:1}});
function storage(){const data=new Map<string,string>();return {get length(){return data.size;},key:(n:number)=>[...data.keys()][n]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};}

describe("contribution recovery",()=>{
  it("turns a stale edit into an unpublished copy instead of trapping it behind an impossible save",()=>{
    const draft={...newDraft(),clientId:draftId,editId:id,expectedVersion:1,body:"My unsaved edit"};
    const prepared=prepareRecoveredDraft(draft,[{id,authorId:"guest-a",version:2}] as never,scope.actorId);
    expect(prepared.detached).toBe(true);expect(prepared.draft?.body).toBe("My unsaved edit");expect(prepared.draft?.editId).toBeUndefined();expect(prepared.draft?.clientId).not.toBe(draftId);
  });
  it("requires a file for a detached image edit instead of pretending the old preview can be published",()=>{
    const draft={...newDraft(),editId:id,expectedVersion:1,type:"image" as const,previewUrl:"/api/assets/old",body:"My caption"};
    const prepared=prepareRecoveredDraft(draft,[],scope.actorId);
    expect(prepared.draft?.previewUrl).toBeNull();expect(prepared.draft?.assetId).toBeUndefined();expect(prepared.draft?.body).toBe("My caption");
  });
  it("recovers authored words, source, stable save ids and exact paint cells without object URLs",()=>{
    const value=createRecovery(scope,id,input(),1000)!;
    const restored=decodeRecovery(JSON.stringify(value),scope)!;
    expect(restored.draft?.body).toBe("An unfinished train 🚂");
    expect(restored.draft?.clientId).toBe(draftId);
    expect(restored.draft?.inspiredBy).toBe("d8ba9df1-9e5a-422f-b8e5-60d2592de669");
    expect(restored.brush).toEqual([{x:10,y:20,color:"#F3617C"}]);
    expect(restored.brushOperationId).toBe(id);
    expect(JSON.stringify(value)).not.toContain("previewUrl");
    expect(JSON.stringify(value)).not.toContain('"file"');
  });
  it("does not store untouched empty composers",()=>{
    expect(createRecovery(scope,id,{...input(),draft:newDraft(),brush:[],brushOperationId:null},1000)).toBeNull();
  });
  it("rejects another world, epoch or guest rather than restoring someone else's editing authority",()=>{
    const raw=JSON.stringify(createRecovery(scope,id,input(),1000));
    for(const other of [{...scope,worldId:"elsewhere"},{...scope,epoch:2},{...scope,actorId:"guest-b"}])expect(decodeRecovery(raw,other)).toBeNull();
  });
  it("rejects corrupt, oversized and invalid paint payloads",()=>{
    const value=createRecovery(scope,id,input(),1000)!;
    expect(decodeRecovery("{",scope)).toBeNull();
    expect(decodeRecovery("x".repeat(40001),scope)).toBeNull();
    expect(decodeRecovery(JSON.stringify({...value,brush:[{x:1.5,y:0,color:"red"}]}),scope)).toBeNull();
    expect(decodeRecovery(JSON.stringify({...value,brush:Array(145).fill({x:0,y:0,color:"#FFFFFF"})}),scope)).toBeNull();
  });
  it("keeps independent tab recoveries and removes only the accepted work",()=>{
    const store=storage(),first=createRecovery(scope,id,input(),1000)!;
    const second=createRecovery(scope,draftId,{...input(),draft:{...input().draft,body:"Other tab"}},2000)!;
    expect(writeRecovery(store,first)).toBe(true);expect(writeRecovery(store,second)).toBe(true);
    expect(readRecoveries(store,scope).map(record=>record.draft?.body)).toEqual(["Other tab","An unfinished train 🚂"]);
    expect(removeRecovery(store,scope,id)).toBe(true);
    expect(store.getItem(recoveryKey(scope,draftId))).not.toBeNull();
    expect(readRecoveries(store,scope)).toHaveLength(1);
  });
  it("reports blocked storage without throwing or discarding work",()=>{
    const store={...storage(),setItem(){throw new Error("quota");},removeItem(){throw new Error("blocked");}};
    expect(writeRecovery(store,createRecovery(scope,id,input(),1000)!)).toBe(false);
    expect(removeRecovery(store,scope,id)).toBe(false);
  });
});
