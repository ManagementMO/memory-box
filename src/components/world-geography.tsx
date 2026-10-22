"use client";

import { memo, useCallback, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type Ref } from "react";
import type { CameraView } from "./world-canvas";
import { areaAtPoint, type AreaEmblem, type WorldArea } from "@/lib/client/world-atlas";
import { screenToWorld } from "@/lib/client/canvas-geometry";
import { ChevronDown } from "./pixel-icons";

/** Small original pixel emblems; these are map furniture, not saved artwork. */
export function AreaMark({emblem="flag"}:{emblem?:AreaEmblem|"map"}){
  const paths:Record<AreaEmblem|"map",string>={
    map:"M2 5h6V3h8v2h6v16h-6v2H8v-2H2zm2 2v12h4V7zm6-2v16h4V5zm6 2v12h4V7z",
    flag:"M5 2h2v2h13v9H7v9H5zm2 4v5h11V6z",
    goose:"M11 2h7v2h2v3h3v2h-7v4h3v6h-2v3h-2v-3H8v3H6v-3H3v-7h3v3h5V9H9V4h2zm3 3v2h2V5z",
    tape:"M3 4h18v16H3zm2 2v6h14V6zm1 2v2h3V8zm9 0v2h3V8zm-6 8v2h6v-2z",
    cat:"M3 3h5v3h8V3h5v15h-3v3H6v-3H3zm3 6v3h3V9zm9 0v3h3V9zm-5 6v2h4v-2z",
    bread:"M6 3h12v2h3v4h2v10H1V9h2V5h3zm1 4v2h2V7zm8 0v2h2V7zM5 21h3v2H5zm11 0h3v2h-3z",
    train:"M3 2h18v16h-3v3h3v2h-4l-3-4h-4l-3 4H3v-2h3v-3H3zm2 3v7h6V5zm8 0v7h6V5zM6 14v2h3v-2zm9 0v2h3v-2z",
    soup:"M7 1h2v3H7zm8 1h2v3h-2zM5 5h2v3H5zm8 1h2v3h-2zM2 11h20v4h-2v3h-3v3H7v-3H4v-3H2zm3 2v2h14v-2z",
    spark:"M10 1h4v6h3v3h6v4h-6v3h-3v6h-4v-6H7v-3H1v-4h6V7h3zm0 9v4h4v-4z",
  };
  return <svg className="area-mark" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path fill="currentColor" fillRule="evenodd" d={paths[emblem]}/></svg>;
}

export function areaContour(area:WorldArea,margin=0){
  const x=area.x-margin,y=area.y-margin,w=area.width+margin*2,h=area.height+margin*2,s=Math.min(72,w/8,h/8);
  return `M${x+s},${y} H${x+w*.42} V${y-s/2} H${x+w-s*2} V${y+s/2} H${x+w} V${y+h*.44} H${x+w+s/2} V${y+h-s} H${x+w-s} V${y+h} H${x+w*.52} V${y+h+s/2} H${x+s*2} V${y+h-s/2} H${x} V${y+h*.48} H${x-s/2} V${y+s} H${x+s} Z`;
}

export interface GeographyHandle { update:(view:CameraView)=>void }
export const WorldGeography=memo(function WorldGeography({areas,quiet,onVisit,onWorldMap,ref}:{
  areas:readonly WorldArea[];quiet:boolean;onVisit?:(area:WorldArea)=>void;onWorldMap?:()=>void;ref:Ref<GeographyHandle>;
}){
  const terrain=useRef<SVGGElement>(null),root=useRef<HTMLDivElement>(null),location=useRef<HTMLButtonElement>(null),locationName=useRef<HTMLSpanElement>(null);
  const buttons=useRef(new Map<string,HTMLButtonElement>()),lastView=useRef<CameraView|null>(null);
  const update=useCallback((view:CameraView)=>{
    lastView.current=view;
    terrain.current?.setAttribute("transform",`translate(${view.x} ${view.y}) scale(${view.z})`);
    const current=areaAtPoint(areas,screenToWorld(view,{x:view.width/2,y:view.height/2}));
    if(root.current)root.current.dataset.currentPlace=current?.id??"open-ground";
    if(locationName.current)locationName.current.textContent=current?.title??"Open ground";
    if(location.current){location.current.hidden=quiet||!onWorldMap;location.current.setAttribute("aria-description",current?.title??"Open ground");}
    const occupied:{x:number;y:number;w:number;h:number}[]=[];
    const candidates=areas.map(area=>({area,x:(area.x+area.width/2)*view.z+view.x,y:area.y*view.z+view.y-40}))
      .sort((a,b)=>(b.area.memoryIds.length*150+b.area.pixelCount)-(a.area.memoryIds.length*150+a.area.pixelCount));
    for(const {area,x,y} of candidates){
      const button=buttons.current.get(area.id);if(!button)continue;
      const w=Math.min(180,48+area.title.length*7),box={x:x-w/2,y,w,h:44};
      const hidden=quiet||view.z>.82||box.x<8||box.x+w>view.width-8||y<100||y+44>view.height-100||occupied.some(r=>box.x<r.x+r.w+12&&box.x+w+12>r.x&&y<r.y+r.h+12&&y+56>r.y);
      button.hidden=hidden;
      if(!hidden){button.style.width=`${w}px`;button.style.left=`${x}px`;button.style.top=`${y}px`;occupied.push(box);}
    }
  },[areas,quiet,onWorldMap]);
  useImperativeHandle(ref,()=>({update}),[update]);
  useLayoutEffect(()=>{if(lastView.current)update(lastView.current);},[update]);
  return <div className="world-geography" ref={root}>
    <svg className="world-geographic-ground" width="100%" height="100%" aria-hidden="true"><g ref={terrain}>
      {areas.map((area,index)=>{
        const earlier=areas.slice(0,index),nearest=earlier.sort((a,b)=>Math.hypot(a.x-area.x,a.y-area.y)-Math.hypot(b.x-area.x,b.y-area.y))[0];
        if(!nearest||Math.hypot(nearest.x-area.x,nearest.y-area.y)>4600)return null;
        const x=area.x+area.width/2,y=area.y+area.height/2,px=nearest.x+nearest.width/2,py=nearest.y+nearest.height/2,middle=Math.round((x+px)/96)*48;
        return <path key={`path:${area.id}`} className="world-travel-trail" d={`M${x} ${y} H${middle} V${py} H${px}`}/>;
      })}
      {areas.map(area=><g key={area.id} className="world-terrain-area"><path d={areaContour(area,150)} fill={area.color} opacity=".12"/><path d={areaContour(area,40)} fill={area.color} opacity=".27"/><path className="world-terrain-edge" d={areaContour(area,90)}/></g>)}
    </g></svg>
    <button ref={location} type="button" className="world-location canvas-overlay" aria-label="Open world map" onClick={onWorldMap}><AreaMark emblem="map"/><span>World</span><ChevronDown size={12}/><span ref={locationName} className="world-location-name">Open ground</span></button>
    {areas.map(area=><button type="button" hidden key={area.id} ref={element=>{if(element)buttons.current.set(area.id,element);else buttons.current.delete(area.id);}} className="world-place-label canvas-overlay" data-area-id={area.id} aria-label={`Visit ${area.title}`} title={area.title} style={{"--area-paper":area.color} as CSSProperties} onClick={()=>onVisit?.(area)}><AreaMark emblem={area.emblem}/><span>{area.title}</span>{area.openBuilds?<i aria-label={`${area.openBuilds} open builds`}/>:null}</button>)}
  </div>;
});
