import type { FramePoint } from "./canvas-geometry";

export interface WorldRect { x:number; y:number; width:number; height:number }
export const intersects = (a:WorldRect,b:WorldRect) => a.x<=b.x+b.width && a.x+a.width>=b.x && a.y<=b.y+b.height && a.y+a.height>=b.y;

/** Sparse buckets, not an allocated plane. Queries preserve source references. */
export function spatialIndex<T>(items:readonly T[],bounds:(item:T)=>WorldRect,bucketSize=768) {
  if(!Number.isFinite(bucketSize)||bucketSize<=0)throw new Error("Invalid spatial bucket size");
  const buckets=new Map<string,{x:number;y:number;items:T[]}>(),large:T[]=[];
  const extent=(r:WorldRect)=>({left:Math.floor(r.x/bucketSize),right:Math.floor((r.x+r.width)/bucketSize),top:Math.floor(r.y/bucketSize),bottom:Math.floor((r.y+r.height)/bucketSize)});
  for(const item of items){
    const r=bounds(item);
    if(![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<0||r.height<0)continue;
    const e=extent(r);
    if((e.right-e.left+1)*(e.bottom-e.top+1)>256){large.push(item);continue;}
    for(let y=e.top;y<=e.bottom;y++)for(let x=e.left;x<=e.right;x++){
      const key=`${x},${y}`;let bucket=buckets.get(key);
      if(!bucket){bucket={x,y,items:[]};buckets.set(key,bucket);}bucket.items.push(item);
    }
  }
  return {query(rect:FramePoint,limit=Infinity):T[]{
    const r={...rect,width:rect.width??0,height:rect.height??0};
    if(![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<0||r.height<0||limit<1||Number.isNaN(limit))return [];
    const e=extent(r),found=new Set<T>();
    const include=(values:readonly T[])=>{for(const item of values)if(!found.has(item)&&intersects(bounds(item),r)){found.add(item);if(found.size>=limit)return true;}return false;};
    // A far-out view traverses occupied buckets, never billions of empty cells.
    if((e.right-e.left+1)*(e.bottom-e.top+1)>buckets.size*2){
      for(const bucket of buckets.values())if(bucket.x>=e.left&&bucket.x<=e.right&&bucket.y>=e.top&&bucket.y<=e.bottom&&include(bucket.items))return [...found];
    }else for(let y=e.top;y<=e.bottom;y++)for(let x=e.left;x<=e.right;x++)if(include(buckets.get(`${x},${y}`)?.items??[]))return [...found];
    include(large);return [...found];
  }};
}
