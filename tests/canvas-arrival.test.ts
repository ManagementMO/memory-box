import {describe,expect,it} from "vitest";
import type {Memory,WorldSnapshot} from "../src/lib/types";
import {worldAreas} from "../src/lib/client/world-atlas";
import {decodeCanvasView,encodeCanvasView,initialWorldCamera} from "../src/lib/client/canvas-arrival";

const memory=(id:string,x:number,y:number,seed=false):Memory=>({id,authorId:null,authorName:"Visitor",type:"text",title:"A real fragment",body:"A tiny boat made of cheese.",url:null,imageUrl:null,color:"#FFE9AF",x,y,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:seed});
const world=(changes:Partial<WorldSnapshot>={}):WorldSnapshot=>({worldId:"commons",revision:1,epoch:1,width:1200,height:720,gridSize:6,paintingPaused:false,memories:[],pixels:[],events:[],...changes});

describe("first arrival and public view persistence",()=>{
  it("puts an actual contributed original within readable phone distance, despite a distant populated starter",()=>{
    const data=world({memories:[...Array.from({length:15},(_,i)=>memory(`seed-${i}`,i*90,0,true)),memory("community",8200,3600)]});
    const camera=initialWorldCamera(data,worldAreas(data.memories,data.pixels),{width:390,height:608});
    expect(camera.z).toBeGreaterThanOrEqual(.65);expect(camera.z).toBeLessThanOrEqual(.9);
    expect(8290*camera.z+camera.x).toBeGreaterThan(60);expect(8290*camera.z+camera.x).toBeLessThan(330);
    expect(3650*camera.z+camera.y).toBeGreaterThan(140);expect(3650*camera.z+camera.y).toBeLessThan(420);
  });
  it("keeps desktop's nearby-world overview while distant legal outliers cannot shrink the arrival",()=>{
    const data=world({memories:[memory("a",0,0,true),memory("b",4300,200,true),memory("edge",59000,59000,true)]});
    const camera=initialWorldCamera(data,worldAreas(data.memories,[]),{width:1440,height:844});
    expect(camera.z).toBeGreaterThan(.1);expect(camera.z).toBeLessThan(.52);
    expect(4300*camera.z+camera.x).toBeGreaterThan(0);expect(4300*camera.z+camera.x).toBeLessThan(1440);
  });
  it("uses existing pixel ground when there are no originals, and a finite empty-world fallback",()=>{
    const data=world({pixels:[{x:1000,y:-500,color:"#DCC7F0"}]});
    const camera=initialWorldCamera(data,worldAreas([],data.pixels),{width:320,height:584});
    expect(6003*camera.z+camera.x).toBeGreaterThan(30);expect(6003*camera.z+camera.x).toBeLessThan(290);
    expect(-2997*camera.z+camera.y).toBeGreaterThan(80);expect(-2997*camera.z+camera.y).toBeLessThan(470);
    const empty=initialWorldCamera(world(),[],{width:320,height:584});
    expect([empty.x,empty.y,empty.z].every(Number.isFinite)).toBe(true);expect(empty.z).toBeGreaterThan(0);
  });
  it("chooses a meaningful story over an untitled, uncaptioned image as the first anchor",()=>{
    const data=world({memories:[{...memory("blank-photo",9000,3000),type:"image",title:"",body:"",imageUrl:"/fixture.png"},memory("story",0,0,true)]});
    const camera=initialWorldCamera(data,worldAreas(data.memories,[]),{width:390,height:608});
    expect(100*camera.z+camera.x).toBeGreaterThan(60);expect(100*camera.z+camera.x).toBeLessThan(330);
  });
  it("stores only a public center and scale, then restores that spot on another viewport",()=>{
    const data=world();
    const saved=encodeCanvasView(data,{x:-5405,y:-1940,z:.7,width:390,height:600});
    expect(JSON.parse(saved!)).toEqual({version:1,worldId:"commons",epoch:1,x:8000,y:3200,z:.7});
    expect(decodeCanvasView(saved,data,{width:1440,height:900})).toEqual({x:-4880,y:-1790,z:.7});
  });
  it.each([null,"broken","null","[]",JSON.stringify({version:1,worldId:"other",epoch:1,x:0,y:0,z:.7}),JSON.stringify({version:1,worldId:"commons",epoch:0,x:0,y:0,z:.7}),JSON.stringify({version:1,worldId:"commons",epoch:1,x:60000,y:0,z:.7}),JSON.stringify({version:1,worldId:"commons",epoch:1,x:0,y:0,z:0})])("ignores a corrupt, foreign or obsolete view: %s",raw=>{
    expect(decodeCanvasView(raw,world(),{width:390,height:600})).toBeNull();
  });
  it("never persists a nonfinite camera or a center outside the public write plane",()=>{
    expect(encodeCanvasView(world(),{x:Infinity,y:0,z:1,width:390,height:600})).toBeNull();
    expect(encodeCanvasView(world(),{x:90000,y:0,z:1,width:390,height:600})).toBeNull();
  });
});
