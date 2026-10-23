"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { WorldSnapshot } from "@/lib/types";
import { memorySize } from "@/lib/scenes";
import { GRID_SIZE, WORLD_MAX, WORLD_MIN } from "@/lib/world-bounds";
import { frameCamera, screenToWorld, type Camera } from "@/lib/client/canvas-geometry";
import type { WorldArea } from "@/lib/client/world-atlas";
import type { CameraView } from "./world-canvas";
import { AreaMark } from "./world-geography";
import { ArrowUpRight, Paintbrush, Plus, StickyNote } from "./pixel-icons";
import {signalDescription,type PlaceSignal} from "@/lib/client/world-activity";

export function WorldMap({world,areas,camera,onVisit,onPoint,onStart,disabled,signals=[],onSignal}:{
  world:WorldSnapshot;areas:readonly WorldArea[];camera:CameraView|null;onVisit:(area:WorldArea)=>void;
  onPoint:(point:{x:number;y:number})=>void;onStart:()=>void;disabled?:boolean;signals?:readonly PlaceSignal[];onSignal?:(signal:PlaceSignal)=>void;
}){
  const canvas=useRef<HTMLCanvasElement>(null),viewport=useRef<HTMLCanvasElement>(null),mapView=useRef<Camera|null>(null);
  const [projection,setProjection]=useState<(Camera&{width:number;height:number})|null>(null);
  const signalsByArea=new Map(signals.map(signal=>[signal.areaId,signal]));
  const latestCamera=useRef(camera),mapSize=useRef({width:0,height:0,ratio:1});latestCamera.current=camera;
  const drawViewport=useCallback(()=>{
    const element=viewport.current,view=mapView.current;if(!element||!view)return;
    const context=element.getContext("2d");if(!context)return;
    const {width,height,ratio}=mapSize.current;
    if(element.width!==width*ratio)element.width=width*ratio;
    if(element.height!==height*ratio)element.height=height*ratio;
    context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
    const camera=latestCamera.current;if(!camera)return;
    const origin=screenToWorld(camera,{x:0,y:0});context.strokeStyle="#78559D";context.lineWidth=1.5;context.setLineDash([4,3]);
    context.strokeRect(origin.x*view.z+view.x,origin.y*view.z+view.y,camera.width/camera.z*view.z,camera.height/camera.z*view.z);
  },[]);
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    const draw=()=>{
      const context=element.getContext("2d");if(!context)return;
      const width=element.clientWidth||280,height=element.clientHeight||180,ratio=Math.min(devicePixelRatio||1,2);
      mapSize.current={width,height,ratio};
      element.width=width*ratio;element.height=height*ratio;context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);context.imageSmoothingEnabled=false;
      const view=frameCamera(areas.length?[...areas]:[{x:-600,y:-360,width:1200,height:720}],{width,height},{padding:22,maxZoom:.24});mapView.current=view;
      setProjection({...view,width,height});
      const x=(value:number)=>value*view.z+view.x,y=(value:number)=>value*view.z+view.y;
      for(const area of areas){context.fillStyle=area.color;context.globalAlpha=.55;context.fillRect(x(area.x)-4,y(area.y)-4,Math.max(6,area.width*view.z+8),Math.max(6,area.height*view.z+8));}context.globalAlpha=1;
      for(const p of world.pixels){context.fillStyle=p.color;context.fillRect(x(p.x*GRID_SIZE),y(p.y*GRID_SIZE),Math.max(.65,GRID_SIZE*view.z),Math.max(.65,GRID_SIZE*view.z));}
      for(const memory of world.memories){const size=memorySize(memory);context.fillStyle=memory.type==="image"?"#FFFFFF":memory.color;context.fillRect(x(memory.x),y(memory.y),Math.max(2,size.width*view.z),Math.max(2,size.height*view.z));if(memory.type==="image"){context.fillStyle="#BDA9E9";context.fillRect(x(memory.x)+1,y(memory.y)+1,Math.max(1,size.width*view.z-2),Math.max(1,size.height*view.z-3));}}
      drawViewport();
    };
    draw();const observer=new ResizeObserver(draw);observer.observe(element);return()=>observer.disconnect();
  },[world.pixels,world.memories,areas,drawViewport]);
  useEffect(()=>{drawViewport();},[camera,drawViewport]);
  const travel=(event:MouseEvent<HTMLCanvasElement>)=>{
    if(!mapView.current||disabled)return;
    const rect=event.currentTarget.getBoundingClientRect(),point=screenToWorld(mapView.current,{x:event.clientX-rect.left,y:event.clientY-rect.top});
    onPoint({x:Math.max(WORLD_MIN,Math.min(WORLD_MAX,point.x)),y:Math.max(WORLD_MIN,Math.min(WORLD_MAX,point.y))});
  };
  return <div className="world-map-panel">
    <div className="world-map-window"><canvas ref={canvas} className="world-map-canvas" role="img" aria-label="Map of actual pixels and originals. Choose a place below to travel with a keyboard." onClick={travel}/><canvas ref={viewport} className="world-map-viewport" aria-hidden="true"/>
      <div className="world-map-signals">{projection&&signals.map(signal=>{
        const area=areas.find(area=>area.id===signal.areaId),x=signal.x*projection.z+projection.x,y=signal.y*projection.z+projection.y;
        if(!area||x<0||x>projection.width||y<0||y>projection.height)return null;
        const label=`${signalDescription(signal)} in ${area.title}`;
        return <button key={signal.id} type="button" className="world-map-signal" data-signal-kind={signal.kind} data-memory-id={signal.memoryId} aria-label={label} title={label} disabled={disabled} onClick={()=>onSignal?.(signal)} style={{left:x,top:y}}>{signal.kind==="memory"?<StickyNote size={14}/>:<Paintbrush size={14}/>}</button>;
      })}</div>
      <span className="world-map-key"><i/>Your view</span></div>
    <button type="button" className="button button-primary button-full world-start-place" aria-label="Start a place" onClick={onStart} disabled={disabled}><Plus size={17}/>Start a place<AreaMark emblem="flag"/></button>
    <div className="world-map-heading"><h3>Places</h3><span>{areas.length}</span></div>
    <div className="world-place-list">{areas.map(area=>{
      const signal=signalsByArea.get(area.id);
      return <div className="world-place-row" key={area.id}><button type="button" className="world-place-destination" data-place-id={area.id} aria-label={`Visit ${area.title}`} onClick={()=>onVisit(area)} disabled={disabled} style={{"--area-paper":area.color} as CSSProperties}><span className="world-place-emblem"><AreaMark emblem={area.emblem}/></span><span className="world-place-copy"><strong>{area.title}</strong><small>{area.memoryIds.length?`${area.memoryIds.length} original${area.memoryIds.length===1?"":"s"}`:"Pixel artwork"}{area.openBuilds?` · ${area.openBuilds} open build${area.openBuilds===1?"":"s"}`:""}</small></span><ArrowUpRight size={16}/></button>
      {signal?<button type="button" className="world-place-activity" data-signal-kind={signal.kind} data-memory-id={signal.memoryId} aria-label={`${signalDescription(signal)} in ${area.title}`} disabled={disabled} onClick={()=>onSignal?.(signal)}>{signal.kind==="memory"?<StickyNote size={14}/>:<Paintbrush size={14}/>}<span>{signalDescription(signal)}</span></button>:null}</div>;
    })}</div>
    {!areas.length?<p className="panel-copy">No places yet. Start one with a note, photo or shared drawing.</p>:null}
  </div>;
}
