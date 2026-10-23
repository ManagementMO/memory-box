import {describe,expect,it} from "vitest";
import {arrivalCamera} from "../src/lib/client/canvas-arrival";
import {worldAreas} from "../src/lib/client/world-atlas";
import type {Memory,WorldSnapshot} from "../src/lib/types";

const memories:Memory[]=Array.from({length:12},(_,i)=>({id:`original-${i}`,authorId:null,authorName:"Visitor",type:"text",title:"Cheese boat",body:"The captain ate the lifeboat.",url:null,imageUrl:null,color:"#FFE9AF",x:i%4*240,y:Math.floor(i/4)*170,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-22T12:00:00Z",updatedAt:"2026-10-22T12:00:00Z",version:1,indexStatus:"ready",isSeed:false}));
const world:WorldSnapshot={worldId:"commons",revision:1,epoch:1,width:1200,height:720,gridSize:6,paintingPaused:false,memories,pixels:[],events:[]};
describe("two real arrivals",()=>{
  for(const viewport of [{width:1440,height:844},{width:390,height:608}]){
    it(`shows the occupied mosaic and a readable neighborhood at ${viewport.width}px`,()=>{
      const areas=worldAreas(memories,[]);
      const wide=arrivalCamera(world,areas,viewport,"world-first"),inside=arrivalCamera(world,areas,viewport,"inside-world");
      expect(wide.z).toBeLessThan(.52);expect(inside.z).toBeGreaterThanOrEqual(.65);expect(inside.z).toBeLessThan(1.25);
      for(const m of memories){expect(m.x*wide.z+wide.x).toBeGreaterThanOrEqual(0);expect((m.x+205)*wide.z+wide.x).toBeLessThanOrEqual(viewport.width);}
      expect(memories.some(m=>m.x*inside.z+inside.x>0&&m.x*inside.z+inside.x<viewport.width&&(m.y+50)*inside.z+inside.y>80&&(m.y+50)*inside.z+inside.y<viewport.height-100)).toBe(true);
    });
  }
  it("keeps empty and pixel-only worlds finite",()=>{
    for(const pixels of [[],[{x:1000,y:-500,color:"#DCC7F0"}]])for(const variant of ["world-first","inside-world"] as const){
      const data={...world,memories:[],pixels},camera=arrivalCamera(data,worldAreas([],pixels),{width:320,height:584},variant);
      expect([camera.x,camera.y,camera.z].every(Number.isFinite)).toBe(true);expect(camera.z).toBeGreaterThan(0);
    }
  });
});
