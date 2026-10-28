import {describe,expect,it} from "vitest";
import type {Memory,WorldSnapshot} from "../src/lib/types";
import {captureSavedPlace,compareSavedPlace,decodeSavedPlaces,encodeSavedPlaces,mutateSavedPlaces,readSavedPlaces,savedPlacesKey} from "../src/lib/client/saved-places";

const original:Memory={id:"original-a",authorId:null,authorName:"Visitor",type:"text",title:"Private authored title",body:"Never persist this body",url:null,imageUrl:null,color:"#FFE9AF",x:0,y:0,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-26T10:00:00Z",updatedAt:"2026-10-26T10:00:00Z",version:1,indexStatus:"ready",isSeed:false};
const snapshot=(changes:Partial<WorldSnapshot>={}):WorldSnapshot=>({worldId:"commons",epoch:1,revision:1,width:120000,height:120000,gridSize:6,paintingPaused:false,memories:[original],pixels:[{x:0,y:0,color:"#123456",revision:1},{x:1,y:0,color:"#654321",revision:1}],events:[],...changes});
function localStore(){
  const data=new Map<string,string>();let beforeWrite:((key:string)=>void)|null=null,beforeRemove:((key:string)=>void)|null=null;
  return {get length(){return data.size;},key:(index:number)=>[...data.keys()][index]??null,getItem:(key:string)=>data.get(key)??null,
    setItem:(key:string,value:string)=>{const callback=beforeWrite;beforeWrite=null;callback?.(key);data.set(key,value);},removeItem:(key:string)=>{const callback=beforeRemove;beforeRemove=null;callback?.(key);data.delete(key);},
    interleaveNextWrite:(callback:(key:string)=>void)=>{beforeWrite=callback;},interleaveNextRemove:(callback:(key:string)=>void)=>{beforeRemove=callback;}};
}

describe("saved places",()=>{
  it("persists only an explicit label, public coordinates and bounded comparison references",()=>{
    const world=snapshot(),place=captureSavedPlace(world,{x:100,y:100,z:.8,originalId:original.id},"My corner","place-a",1000);
    const encoded=encodeSavedPlaces(world,[place]);
    expect(encoded).toContain("My corner");expect(encoded).not.toContain("Never persist");expect(encoded).not.toContain("Private authored title");expect(encoded).not.toContain("Visitor");expect(encoded).not.toContain("#123456");
    expect(decodeSavedPlaces(encoded,world).places).toHaveLength(1);
    expect(compareSavedPlace(place,world)).toMatchObject({newOriginals:0,changedOriginals:0,newReplies:0,paintedCells:0,removedCells:0,hasChanges:false});
  });

  it("counts actual nearby community changes, linked replies and changed or removed cells while ignoring starters",()=>{
    const before=snapshot({memories:[original,{...original,id:"starter",isSeed:true}]});
    const place=captureSavedPlace(before,{x:100,y:100,z:.8,originalId:original.id},"My corner","place-a",1000);
    const after=snapshot({revision:4,memories:[{...original,version:2},{...original,id:"nearby-new"},{...original,id:"starter",isSeed:true,version:2},{...original,id:"new-starter",isSeed:true},{...original,id:"reply",inspiredBy:original.id,x:5000,y:5000},{...original,id:"far-away",x:9000,y:9000}],pixels:[{x:0,y:0,color:"#abcdef",revision:4},{x:2,y:0,color:"#654321",revision:4},{x:9000,y:9000,color:"#654321",revision:4}]});
    expect(compareSavedPlace(place,after)).toMatchObject({newOriginals:1,changedOriginals:1,newReplies:1,paintedCells:2,removedCells:1,hasChanges:true,originalAvailable:true});
    expect(compareSavedPlace(place,{...after,revision:5,pixels:[{x:0,y:0,color:"#123456",revision:5},{x:1,y:0,color:"#654321",revision:5}]})).toMatchObject({paintedCells:0,removedCells:0});
  });

  it("keeps deleted story text out of bookmarks and reports an unavailable source without a phantom new story",()=>{
    const world=snapshot(),place=captureSavedPlace(world,{x:100,y:100,z:1,originalId:original.id},"My corner","place-a",1000);
    const result=compareSavedPlace(place,snapshot({revision:2,memories:[]}));
    expect(result).toMatchObject({originalAvailable:false,newOriginals:0,changedOriginals:0,removedOriginals:1,hasChanges:true});
    expect(JSON.stringify(place)).not.toContain(original.body);
  });

  it("rejects wrong epochs, malformed records, unsupported versions and oversized storage",()=>{
    const world=snapshot(),place=captureSavedPlace(world,{x:100,y:100,z:1},"My corner","place-a",1000),raw=encodeSavedPlaces(world,[place]);
    expect(decodeSavedPlaces(raw,{...world,epoch:2}).status).toBe("corrupt");
    expect(decodeSavedPlaces(raw.replace('"version":1','"version":8'),world).status).toBe("corrupt");
    expect(decodeSavedPlaces("{broken",world).status).toBe("corrupt");
    expect(decodeSavedPlaces("x".repeat(2500001),world).status).toBe("corrupt");
    const data=JSON.parse(raw);data.places[0].x=Infinity;
    expect(decodeSavedPlaces(JSON.stringify(data),world).status).toBe("corrupt");
    expect(compareSavedPlace(place,{...world,epoch:2,revision:100,memories:[]})).toMatchObject({unavailable:true,hasChanges:false});
    expect(compareSavedPlace(place,{...world,revision:0,memories:[],pixels:[]})).toMatchObject({stale:true,hasChanges:false});
  });

  it("marks a dense memory baseline as limited instead of calling unrecorded existing originals new",()=>{
    const world=snapshot({memories:Array.from({length:300},(_,i)=>({...original,id:`memory-${i}`}))});
    const place=captureSavedPlace(world,{x:100,y:100,z:1},"Busy corner","place-a",1000);
    expect(place.baseline.memories.length).toBeLessThanOrEqual(256);
    expect(compareSavedPlace(place,{...world,revision:2})).toMatchObject({limited:true,newOriginals:0,hasChanges:false});
  });

  it("reads the latest browser record before editing so a stale tab preserves a newer visit baseline and label",()=>{
    const storage=localStore(),world=snapshot();
    const first=mutateSavedPlaces(storage,world,{kind:"save",target:{x:100,y:100,z:1},label:"First name",id:"place-a"},1000);
    expect(first.value?.id).toBe("place-a");
    const changed=snapshot({revision:2,memories:[{...original,version:2}]});
    mutateSavedPlaces(storage,changed,{kind:"visit",id:"place-a"},2000);
    const renamed=mutateSavedPlaces(storage,world,{kind:"rename",id:"place-a",label:"New name"},3000);
    expect(renamed.places[0]).toMatchObject({label:"New name",baseline:{revision:2}});
    expect(compareSavedPlace(renamed.places[0],changed).hasChanges).toBe(false);
    mutateSavedPlaces(storage,changed,{kind:"remove",id:"place-a"},4000);
    expect(mutateSavedPlaces(storage,world,{kind:"rename",id:"place-a",label:"Resurrect"},5000).places).toEqual([]);
  });

  it("limits additions without losing existing places and leaves unseen changes until an explicit visit",()=>{
    const storage=localStore(),world=snapshot();
    for(let i=0;i<12;i++)mutateSavedPlaces(storage,world,{kind:"save",target:{x:i*500,y:0,z:1},label:`Place ${i}`,id:`place-${i}`},1000+i);
    const result=mutateSavedPlaces(storage,world,{kind:"save",target:{x:9000,y:0,z:1},label:"Too many",id:"overflow"},2000);
    expect(result.places).toHaveLength(12);expect(result.error).toBe("limit");
    const newer=snapshot({revision:2,memories:[{...original,version:2}]});
    const saved=readSavedPlaces(storage,world).places.find(p=>p.id==="place-0")!;
    expect(compareSavedPlace(saved,newer).changedOriginals).toBe(1);
    expect(compareSavedPlace(readSavedPlaces(storage,world).places[0],newer).changedOriginals).toBe(1);
    const visited=mutateSavedPlaces(storage,newer,{kind:"visit",id:"place-0"},3000);
    expect(compareSavedPlace(visited.value!,newer).hasChanges).toBe(false);
  });

  it("reports denied storage without pretending a bookmark was saved or an unseen change acknowledged",()=>{
    const storage={length:0,key:()=>null,getItem:()=>{throw new DOMException("Denied","SecurityError");},setItem:()=>{throw new DOMException("Denied","SecurityError");},removeItem:()=>{}};
    const result=mutateSavedPlaces(storage,snapshot(),{kind:"save",target:{x:0,y:0,z:1},label:"Place",id:"a"},1000);
    expect(result).toMatchObject({status:"unavailable",value:null});
    expect(readSavedPlaces(storage,snapshot()).status).toBe("unavailable");
    expect(savedPlacesKey(snapshot())).not.toBe(savedPlacesKey(snapshot({epoch:2})));
  });

  it("preserves both creates when another tab writes between the first tab's read and write",()=>{
    const storage=localStore(),world=snapshot();
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,world,{kind:"save",target:{x:500,y:0,z:1},label:"Tab B",id:"b"},1001));
    mutateSavedPlaces(storage,world,{kind:"save",target:{x:0,y:0,z:1},label:"Tab A",id:"a"},1000);
    expect(readSavedPlaces(storage,world).places.map(place=>place.label).sort()).toEqual(["Tab A","Tab B"]);
  });

  it("merges a racing rename and newer visit independently instead of clearing the newer baseline",()=>{
    const storage=localStore(),world=snapshot();
    mutateSavedPlaces(storage,world,{kind:"save",target:{x:100,y:100,z:1},label:"First name",id:"a"},1000);
    const newer=snapshot({revision:3,memories:[{...original,version:3}]});
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,newer,{kind:"visit",id:"a"},3000));
    mutateSavedPlaces(storage,world,{kind:"rename",id:"a",label:"Renamed in tab A"},2000);
    expect(readSavedPlaces(storage,world).places[0]).toMatchObject({label:"Renamed in tab A",baseline:{revision:3}});
    expect(compareSavedPlace(readSavedPlaces(storage,world).places[0],newer).hasChanges).toBe(false);
  });

  it("merges a racing visit and rename without losing the newer label",()=>{
    const storage=localStore(),world=snapshot();
    mutateSavedPlaces(storage,world,{kind:"save",target:{x:100,y:100,z:1},label:"First name",id:"a"},1000);
    const newer=snapshot({revision:2,memories:[{...original,version:2}]});
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,world,{kind:"rename",id:"a",label:"Renamed in tab B"},3000));
    mutateSavedPlaces(storage,newer,{kind:"visit",id:"a"},2000);
    expect(readSavedPlaces(storage,world).places[0]).toMatchObject({label:"Renamed in tab B",baseline:{revision:2}});
  });

  it("never regresses a newer explicit-visit baseline during a race and never resurrects a removed bookmark",()=>{
    const storage=localStore(),world=snapshot();
    mutateSavedPlaces(storage,world,{kind:"save",target:{x:100,y:100,z:1},label:"First name",id:"a"},1000);
    const second=snapshot({revision:2,memories:[{...original,version:2}]}),third=snapshot({revision:3,memories:[{...original,version:3}]});
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,third,{kind:"visit",id:"a"},3000));
    mutateSavedPlaces(storage,second,{kind:"visit",id:"a"},4000);
    expect(readSavedPlaces(storage,world).places[0].baseline.revision).toBe(3);
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,third,{kind:"remove",id:"a"},5000));
    mutateSavedPlaces(storage,third,{kind:"rename",id:"a",label:"Must stay removed"},6000);
    expect(readSavedPlaces(storage,world).places).toEqual([]);
  });

  it("keeps v1 bookmarks readable while concurrent new writes preserve the original envelope",()=>{
    const storage=localStore(),world=snapshot();
    const legacy=encodeSavedPlaces(world,[captureSavedPlace(world,{x:100,y:100,z:1},"Legacy corner","legacy",1000)]);
    storage.setItem(savedPlacesKey(world),legacy);
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,{...world,revision:2},{kind:"visit",id:"legacy"},3000));
    mutateSavedPlaces(storage,world,{kind:"rename",id:"legacy",label:"Renamed legacy"},2000);
    expect(readSavedPlaces(storage,world).places[0]).toMatchObject({label:"Renamed legacy",baseline:{revision:2}});
    expect(storage.getItem(savedPlacesKey(world))).toBe(legacy);
  });

  it("does not classify a moved or edited original as unavailable",()=>{
    const world=snapshot(),place=captureSavedPlace(world,{x:100,y:100,z:1},"Corner","a",1000);
    expect(compareSavedPlace(place,snapshot({revision:2,memories:[{...original,version:2,x:10000}]}))).toMatchObject({changedOriginals:1,removedOriginals:0});
  });

  it("keeps a deletion tombstone when an already-started rename writes after removal",()=>{
    const storage=localStore(),world=snapshot();
    mutateSavedPlaces(storage,world,{kind:"save",target:{x:100,y:100,z:1},label:"First name",id:"a"},1000);
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,world,{kind:"remove",id:"a"},2000));
    mutateSavedPlaces(storage,world,{kind:"rename",id:"a",label:"Must remain removed"},3000);
    expect(readSavedPlaces(storage,world).places).toEqual([]);
    expect(mutateSavedPlaces(storage,world,{kind:"save",target:{x:200,y:200,z:1},label:"Reused old identity",id:"a"},4000).error).toBe("invalid");
  });

  it("retains only winning field operations while preserving an edit arriving during pruning",()=>{
    const storage=localStore(),world=snapshot();
    mutateSavedPlaces(storage,world,{kind:"save",target:{x:100,y:100,z:1},label:"First name",id:"a"},1000);
    for(let i=1;i<=20;i++){
      mutateSavedPlaces(storage,{...world,revision:i+1},{kind:"visit",id:"a"},1000+i);
      mutateSavedPlaces(storage,world,{kind:"rename",id:"a",label:`Name ${i}`},2000+i);
    }
    expect(storage.length).toBeLessThanOrEqual(3);
    storage.interleaveNextRemove(()=>mutateSavedPlaces(storage,{...world,revision:30},{kind:"visit",id:"a"},4000));
    mutateSavedPlaces(storage,world,{kind:"rename",id:"a",label:"Last name"},3000);
    expect(readSavedPlaces(storage,world).places[0]).toMatchObject({label:"Last name",baseline:{revision:30}});
    expect(storage.length).toBeLessThanOrEqual(3);
  });

  it("preserves simultaneous additions at the soft limit instead of discarding one bookmark",()=>{
    const storage=localStore(),world=snapshot();
    for(let i=0;i<11;i++)mutateSavedPlaces(storage,world,{kind:"save",target:{x:i*500,y:0,z:1},label:`Place ${i}`,id:`p-${i}`},1000+i);
    storage.interleaveNextWrite(()=>mutateSavedPlaces(storage,world,{kind:"save",target:{x:7000,y:0,z:1},label:"Tab B",id:"b"},2001));
    mutateSavedPlaces(storage,world,{kind:"save",target:{x:6000,y:0,z:1},label:"Tab A",id:"a"},2000);
    const places=readSavedPlaces(storage,world).places;
    expect(places).toHaveLength(13);expect(places.map(place=>place.label)).toContain("Tab A");expect(places.map(place=>place.label)).toContain("Tab B");
    expect(mutateSavedPlaces(storage,world,{kind:"save",target:{x:8000,y:0,z:1},label:"Later",id:"later"},3000).error).toBe("limit");
  });

  it("resolves equal-time conflicting edits identically regardless of storage enumeration order",()=>{
    const storage=localStore(),world=snapshot();
    const unpruned={get length(){return storage.length;},key:storage.key,getItem:storage.getItem,setItem:storage.setItem};
    mutateSavedPlaces(unpruned,world,{kind:"save",target:{x:100,y:100,z:1},label:"First name",id:"a"},1000);
    storage.interleaveNextWrite(()=>mutateSavedPlaces(unpruned,world,{kind:"rename",id:"a",label:"Tab B"},2000));
    mutateSavedPlaces(unpruned,world,{kind:"rename",id:"a",label:"Tab A"},2000);
    const reversed=localStore();
    for(let i=storage.length-1;i>=0;i--){const key=storage.key(i)!;reversed.setItem(key,storage.getItem(key)!);}
    expect(readSavedPlaces(reversed,world).places).toEqual(readSavedPlaces(storage,world).places);
    expect(readSavedPlaces(reversed,world).places[0].label).toMatch(/^Tab [AB]$/);
  });
});
