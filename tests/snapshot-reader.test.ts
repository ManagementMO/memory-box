import {beforeEach,describe,expect,it,vi} from "vitest";
import type {WorldSnapshot} from "../src/lib/types";
import {createSnapshotReader,type SnapshotHead} from "../src/lib/server/snapshot-reader";

const snapshot=(revision=1,epoch=1):WorldSnapshot=>({worldId:"commons",revision,epoch,width:120000,height:120000,gridSize:6,paintingPaused:false,pixels:[{x:1,y:2,color:"#DCC7F0",revision}],memories:[],events:[]});
const head=(value:WorldSnapshot):SnapshotHead=>{const {pixels:_,...rest}=value;return rest;};
const deferred=<T>()=>{let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

describe("fresh public snapshots with shared pixel work",()=>{
  let current:WorldSnapshot,readHead:ReturnType<typeof vi.fn<()=>Promise<SnapshotHead>>>,load:ReturnType<typeof vi.fn<()=>Promise<WorldSnapshot>>>,now:number;
  beforeEach(()=>{current=snapshot();now=1000;readHead=vi.fn(async()=>head(current));load=vi.fn(async()=>structuredClone(current));});
  const reader=()=>createSnapshotReader({readHead,load,now:()=>now});

  it("coalesces simultaneous full serializations and reuses pixels for unchanged readers",async()=>{
    const first=deferred<WorldSnapshot>();load.mockReturnValueOnce(first.promise);const read=reader();
    const readers=Array.from({length:4},()=>read());await vi.waitFor(()=>expect(load).toHaveBeenCalledTimes(1));
    first.resolve(snapshot());const results=await Promise.all(readers);
    expect(results).toEqual(Array.from({length:4},()=>snapshot()));
    await Promise.all(Array.from({length:4},()=>read()));expect(load).toHaveBeenCalledTimes(1);expect(readHead).toHaveBeenCalledTimes(8);
  });
  it("always reads fresh originals and index status even when the world revision has not changed",async()=>{
    const read=reader();await read();
    const original={id:"actual-original",version:1,indexStatus:"failed",body:"Fresh metadata"} as WorldSnapshot["memories"][number];
    current={...current,memories:[original],paintingPaused:true};
    const result=await read();expect(result.memories).toEqual([original]);expect(result.paintingPaused).toBe(true);expect(result.pixels).toEqual(snapshot().pixels);expect(load).toHaveBeenCalledTimes(1);
  });
  it("does not share mutable arrays or originals between callers",async()=>{
    const read=reader(),first=await read();first.pixels[0].color="#000000";first.memories.push({id:"invented"} as WorldSnapshot["memories"][number]);
    const second=await read();expect(second.pixels[0].color).toBe("#DCC7F0");expect(second.memories).toEqual([]);
  });
  it("reloads pixels after an actual revision or epoch change",async()=>{
    const read=reader();await read();current=snapshot(2);current.pixels[0].color="#FFED9C";
    expect((await read()).pixels[0].color).toBe("#FFED9C");
    current=snapshot(1,2);current.pixels=[];expect((await read()).pixels).toEqual([]);expect(load).toHaveBeenCalledTimes(3);
  });
  it("will not let an older in-flight snapshot satisfy a reader arriving after a source withdrawal",async()=>{
    const old=deferred<WorldSnapshot>();load.mockReturnValueOnce(old.promise);const read=reader();
    const before=read();await vi.waitFor(()=>expect(load).toHaveBeenCalledTimes(1));
    current=snapshot(2);current.pixels=[];const after=read();await vi.waitFor(()=>expect(readHead).toHaveBeenCalledTimes(2));
    old.resolve(snapshot());expect((await before).revision).toBe(1);expect(await after).toEqual(current);expect(load).toHaveBeenCalledTimes(2);
  });
  it("uses a complete newer snapshot instead of mixing old metadata with newer pixels",async()=>{
    const read=reader();load.mockResolvedValueOnce({...snapshot(2),memories:[{id:"newer"} as WorldSnapshot["memories"][number]]});
    const result=await read();expect(result.revision).toBe(2);expect(result.memories[0].id).toBe("newer");
  });
  it("fails closed on a metadata error rather than returning a cached withdrawn source",async()=>{
    const read=reader();await read();readHead.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(read()).rejects.toThrow("database unavailable");expect(load).toHaveBeenCalledTimes(1);
  });
  it("clears a rejected in-flight load so a later request can recover",async()=>{
    load.mockRejectedValueOnce(new Error("statement timeout"));const read=reader();
    await expect(read()).rejects.toThrow("statement timeout");expect(await read()).toEqual(snapshot());expect(load).toHaveBeenCalledTimes(2);
  });
  it.each([snapshot(0),snapshot(1,0),{...snapshot(),worldId:"other"}])("rejects an inconsistent full snapshot %j",async value=>{
    load.mockResolvedValueOnce(value);const read=reader();await expect(read()).rejects.toThrow(/snapshot/i);
    expect(await read()).toEqual(snapshot());expect(load).toHaveBeenCalledTimes(2);
  });
  it("bounds pixel cache lifetime and invalidates it when the clock moves backwards",async()=>{
    const read=reader();await read();now+=61000;await read();expect(load).toHaveBeenCalledTimes(2);
    now=500;await read();expect(load).toHaveBeenCalledTimes(3);
  });
});
