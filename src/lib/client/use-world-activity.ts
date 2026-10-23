"use client";

import {useEffect,useRef,useState} from "react";
import type {WorldSnapshot} from "../types";
import {STROKE_TTL_MS,type LivePeer} from "./presence-state";
import type {WorldArea} from "./world-atlas";
import {activityChanges,placeSignals,type PlaceSignal} from "./world-activity";

export function useWorldActivity(world:WorldSnapshot|null,areas:readonly WorldArea[],peers:readonly LivePeer[]):PlaceSignal[]{
  const baseline=useRef<{world:WorldSnapshot;areas:readonly WorldArea[]}|null>(null),recent=useRef<PlaceSignal[]>([]);
  const [signals,setSignals]=useState<PlaceSignal[]>([]);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const previous=baseline.current;
    if(!world){baseline.current=null;recent.current=[];}
    else if(!previous||world.worldId!==previous.world.worldId||world.epoch>previous.world.epoch){baseline.current={world,areas};recent.current=[];}
    else if(world.epoch===previous.world.epoch&&world.revision>=previous.world.revision){
      const changes=activityChanges(previous.world,world,areas,Date.now());
      const replaced=new Set(changes.map(change=>change.areaId));
      recent.current=[...recent.current.filter(change=>!replaced.has(change.areaId)),...changes].slice(-24);
      baseline.current={world,areas};
    }
    const publish=()=>{
      const now=Date.now();recent.current=recent.current.filter(change=>change.expiresAt>now);
      const next=placeSignals(recent.current,peers,baseline.current?.areas??[],now);
      setSignals(old=>old.length===next.length&&old.every((signal,index)=>{
        const other=next[index];return signal.id===other.id&&signal.x===other.x&&signal.y===other.y&&signal.painters===other.painters&&signal.expiresAt===other.expiresAt;
      })?old:next);
      const deadlines=[...recent.current.map(change=>change.expiresAt),...peers.filter(peer=>peer.tool==="paint"&&peer.stroke?.length&&peer.updatedAt<=now).map(peer=>peer.updatedAt+STROKE_TTL_MS)].filter(deadline=>deadline>now);
      if(deadlines.length)timer=setTimeout(publish,Math.min(...deadlines)-now);
    };
    publish();return()=>{if(timer)clearTimeout(timer);};
  },[world,areas,peers]);
  return signals;
}
