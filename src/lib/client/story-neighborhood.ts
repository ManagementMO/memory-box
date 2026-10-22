import { frameCamera, type Camera, type FramePoint } from "./canvas-geometry";
type Viewport={width:number;height:number};
const MOBILE_DOCK_CLEARANCE=82;
export function neighborhoodCamera(anchor:FramePoint,neighbors:FramePoint[],viewport:Viewport,mode:"peek"|"compose"="peek"):Camera {
  const center={x:anchor.x+(anchor.width??205)/2,y:anchor.y+(anchor.height??110)/2};
  const nearby=neighbors.filter(p=>Math.hypot(p.x+(p.width??205)/2-center.x,p.y+(p.height??110)/2-center.y)<900)
    .sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)).slice(0,7);
  const compact=viewport.width<=700;
  const fitted=frameCamera([anchor,...nearby],viewport,{padding:70,minZoom:compact?.65:.75,maxZoom:.9});
  // Match the compact 56px header, 74px dock clearance and bounded 60dvh
  // reply sheet. The original fits in the remaining strip on short phones.
  const aboveReply=Math.max(0,viewport.height-MOBILE_DOCK_CLEARANCE-Math.min(440,(viewport.height+56)*.6));
  const z=compact&&mode==="compose"?Math.max(.05,Math.min(fitted.z,.65,(aboveReply-16)/(anchor.height??110))):fitted.z;
  const x=viewport.width*(compact?.5:mode==="compose"?.32:.38);
  const y=compact&&mode==="compose"?Math.max(aboveReply/2,(anchor.height??110)*z/2+8):viewport.height*.4;
  return {x:x-center.x*z,y:y-center.y*z,z};
}
export function floatingStoryPosition(camera:Camera,anchor:FramePoint,viewport:Viewport,size:Viewport,mode:"peek"|"compose") {
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(Math.max(min,max),value));
  if(viewport.width<=700)return {x:clamp((viewport.width-size.width)/2,8,viewport.width-size.width-8),y:Math.max(8,viewport.height-MOBILE_DOCK_CLEARANCE-size.height)};
  const right=camera.x+(anchor.x+(anchor.width??205))*camera.z+14;
  const left=camera.x+anchor.x*camera.z-size.width-14;
  const x=right+size.width<=viewport.width-8?right:left>=8?left:right;
  const y=camera.y+anchor.y*camera.z-(mode==="compose"?12:0);
  return {x:clamp(x,8,viewport.width-size.width-8),y:clamp(y,58,viewport.height-size.height-74)};
}
