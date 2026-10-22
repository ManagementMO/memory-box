"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { paintTurnDeadline, paintTurnSeconds, readPaintTurn } from "./paint-turn";

export function usePaintTurn(actorId: string | undefined, live: boolean, active: boolean) {
  const [deadline,setDeadline]=useState(0),[seconds,setSeconds]=useState(0),[known,setKnown]=useState(false);
  const sequence=useRef(0);
  const accept=useCallback((value:unknown)=>{
    const timing=readPaintTurn(value);
    if(!timing)return false;
    ++sequence.current;
    const next=paintTurnDeadline(timing,performance.now());
    setDeadline(next);setSeconds(paintTurnSeconds(next,performance.now()));setKnown(true);
    return true;
  },[]);
  const sync=useCallback(async()=>{
    if(!actorId||!live)return;
    const ticket=++sequence.current;
    try {
      const timing=await api<unknown>("/api/paint");
      // A slow GET cannot overwrite a newer accepted save or a new identity.
      if(ticket===sequence.current)accept(timing);
    }catch{/* The next save remains server-checked; keep any known deadline. */}
  },[actorId,live,accept]);
  useEffect(()=>{
    ++sequence.current;setKnown(false);setDeadline(0);setSeconds(0);
    if(actorId&&live)void sync();
    return()=>{++sequence.current;};
  },[actorId,live,sync]);
  useEffect(()=>{
    if(!actorId||!live)return;
    const visible=()=>{if(document.visibilityState==="visible")void sync();};
    document.addEventListener("visibilitychange",visible);
    if(active)void sync();
    const timer=active?setInterval(visible,15000):undefined;
    return()=>{document.removeEventListener("visibilitychange",visible);if(timer)clearInterval(timer);};
  },[actorId,live,active,sync]);
  useEffect(()=>{
    const tick=()=>setSeconds(paintTurnSeconds(deadline,performance.now()));
    tick();if(deadline<=performance.now())return;
    const timer=setInterval(tick,200);return()=>clearInterval(timer);
  },[deadline]);
  const rejected=useCallback((cause:unknown)=>{
    if(!(cause instanceof ApiError)||cause.code!=="paint_cooldown")return false;
    if(cause.paintTurn)accept(cause.paintTurn);
    else {void sync();}
    return true;
  },[accept,sync]);
  return {seconds,known,accept,rejected,sync};
}
