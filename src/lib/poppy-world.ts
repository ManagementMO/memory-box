import type { Pixel } from "./types";
import type { LivingSeedMemory } from "./living-world";

/** Additive, explicitly fictional originals from the approved canvas study. */
export const POPPY_SEED_MARKER="seed:poppy-canvas:v1";
export const poppySeedId=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const POPPY_OPERATION_ID=poppySeedId(9000),POPPY_EVENT_ID=poppySeedId(9001);
export const POPPY_MEMORIES:LivingSeedMemory[]=[
 {id:poppySeedId(1),authorName:"Mina (starter)",type:"text",title:"Twenty more minutes",body:"I got the offer email on this bench. Sat there for another twenty minutes. Didn’t know who to call first.",color:"#FFED9C",x:4070,y:-120,sceneId:"garden",inspiredBy:null,imageUrl:null},
 {id:poppySeedId(2),authorName:"Jules (starter)",type:"text",title:"Relevant goose experience",body:"The goose has more co-op experience than me. At least it knows how to manage six direct reports.",color:"#E4D8FB",x:3780,y:170,sceneId:"garden",inspiredBy:null,imageUrl:null},
 {id:poppySeedId(3),authorName:"Rue (starter)",type:"image",title:"2am. Very necessary.",body:"Four interviews, two bubble teas, and one deeply necessary food run. An imagined little campus moment: this is a generated starter photo, not a real student’s upload.",color:"#FFFFFF",x:4430,y:100,sceneId:"garden",inspiredBy:null,imageUrl:"/starter-world/uw-after-hours.svg"},
 {id:poppySeedId(4),authorName:"Goose committee",type:"text",title:"Honk if you’re hiring",body:"The interview tie is a group project. The qualifications are also a group project. Leave the goose something it can put on its CV.",color:"#FFD3E3",x:3740,y:-230,sceneId:"garden",inspiredBy:null,imageUrl:null},
 {id:poppySeedId(5),authorName:"Noor (starter)",type:"text",title:"Same bench",body:"Same bench. Different rejection email. Thanks for leaving this. The next day was better.",color:"#FFD3E3",x:4450,y:390,sceneId:"garden",inspiredBy:poppySeedId(1),imageUrl:null},
 {id:poppySeedId(6),authorName:"Window seat",type:"text",title:"One extra stop with you",body:"We missed our stop because you were telling a story. I pretended I didn’t notice.",color:"#DCEAFC",x:3650,y:720,sceneId:"garden",inspiredBy:null,imageUrl:null},
];

const cells=new Map<string,Pixel>();
function sprite(rows:string[],x:number,y:number,size:number,palette:Record<string,string>){for(const [row,dy] of rows.map((row,i)=>[row,i] as const))for(const [key,dx] of [...row].map((key,i)=>[key,i] as const)){const color=palette[key];if(!color)continue;for(let sy=0;sy<size;sy+=6)for(let sx=0;sx<size;sx+=6){const cell={x:(x+dx*size+sx)/6,y:(y+dy*size+sy)/6,color};cells.set(`${cell.x},${cell.y}`,cell);}}}
const heart=[".rr..rr.","rrrrrrrr","rrrrrrrr",".rrrrrr.","..rrrr..","...rr..."];
for(const [x,y,size] of [[4530,-162,6],[3864,414,6],[4572,600,6]] as const)sprite(heart,x,y,size,{r:"#F3617C"});
sprite([".pp..pp.","pppppppp","pippippp","pppppppp",".pppppp.","pp.pp.pp"],3780,360,12,{p:"#BDA3EE",i:"#302A40"});
for(const [x,y]of [[3972,-264],[4638,342],[4140,738],[3720,600]])sprite(["...y...","...y...","..yyy..","yyyyyyy","..yyy..","...y...","...y..."],x,y,6,{y:"#FFD568"});
export const POPPY_PIXELS=[...cells.values()];
