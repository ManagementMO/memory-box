"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {WorldSnapshot} from "../types";
import {compareSavedPlace,isSavedPlacesStorageKey,mutateSavedPlaces,readSavedPlaces,savedPlacesKey,SAVED_PLACES_LIMIT,type SavedPlace,type SavedPlaceTarget,type SavedPlaceWithChanges,type SavedPlacesMutation,type SavedPlacesMutationResult,type SavedPlacesStatus} from "./saved-places";

const LOCAL_UPDATE="memory-box:saved-places-updated";
type State={key:string|null;places:SavedPlace[];status:SavedPlacesStatus};
export interface SavedPlacesController {
  places:SavedPlaceWithChanges[];status:SavedPlacesStatus;error:string|null;limitReached:boolean;
  save:(target:SavedPlaceTarget,label:string)=>SavedPlace|null;
  /** Call only after an explicit visit. Rendering or refreshing never acknowledges changes. */
  visit:(id:string)=>SavedPlace|null;
  remove:(id:string)=>boolean;rename:(id:string,label:string)=>boolean;
}

function messageFor(result:SavedPlacesMutationResult):string|null{
  if(result.status==="unavailable")return "Browser storage is unavailable. Changes were not saved.";
  if(result.error==="limit")return "You can save up to 12 places. Remove one to add another.";
  if(result.error==="stale")return "The current view is older than your last visit. Your saved comparison was kept.";
  if(result.error==="missing")return "This place was removed in another tab.";
  if(result.error==="invalid")return "This place could not be saved.";
  return null;
}

/** Browser-only public bookmarks. It does not alter arrival, camera, identity or analytics. */
export function useSavedPlaces(world:WorldSnapshot|null):SavedPlacesController{
  const latestWorld=useRef(world);latestWorld.current=world;
  const key=world?savedPlacesKey(world):null;
  const [state,setState]=useState<State>({key:null,status:"loading",places:[]});
  const [error,setError]=useState<string|null>(null);
  const sync=useCallback(()=>{
    const current=latestWorld.current;if(!current)return;
    const currentKey=savedPlacesKey(current);
    try{const loaded=readSavedPlaces(window.localStorage,current);setState(previous=>({key:currentKey,status:loaded.status,places:loaded.status==="unavailable"&&previous.key===currentKey?previous.places:loaded.places}));}
    catch{setState(previous=>({key:currentKey,status:"unavailable",places:previous.key===currentKey?previous.places:[]}));}
  },[]);
  useEffect(()=>{
    setError(null);
    if(!key){setState({key:null,status:"loading",places:[]});return;}
    sync();
    const changed=(event:StorageEvent)=>{const current=latestWorld.current;if(current&&isSavedPlacesStorageKey(event.key,current))sync();};
    const localChanged=(event:Event)=>{if((event as CustomEvent<string>).detail===key)sync();};
    window.addEventListener("storage",changed);window.addEventListener(LOCAL_UPDATE,localChanged);
    return ()=>{window.removeEventListener("storage",changed);window.removeEventListener(LOCAL_UPDATE,localChanged);};
  },[key,sync]);

  const apply=useCallback((mutation:SavedPlacesMutation):SavedPlacesMutationResult|null=>{
    const current=latestWorld.current;if(!current)return null;
    const currentKey=savedPlacesKey(current);
    let result:SavedPlacesMutationResult;
    try{result=mutateSavedPlaces(window.localStorage,current,mutation,Date.now());}
    catch{
      setError("Browser storage is unavailable. Changes were not saved.");
      setState(previous=>({key:currentKey,status:"unavailable",places:previous.key===currentKey?previous.places:[]}));return null;
    }
    setState(previous=>({key:currentKey,status:result.status,places:result.status==="unavailable"&&!result.places.length&&previous.key===currentKey?previous.places:result.places}));setError(messageFor(result));
    if(result.status==="ready"&&!result.error)window.dispatchEvent(new CustomEvent(LOCAL_UPDATE,{detail:currentKey}));
    return result;
  },[]);
  const save=useCallback((target:SavedPlaceTarget,label:string)=>{
    const id=typeof globalThis.crypto?.randomUUID==="function"?globalThis.crypto.randomUUID():`place-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
    return apply({kind:"save",target,label,id})?.value??null;
  },[apply]);
  const visit=useCallback((id:string)=>apply({kind:"visit",id})?.value??null,[apply]);
  const remove=useCallback((id:string)=>{const result=apply({kind:"remove",id});return result?.status==="ready"&&!result.error;},[apply]);
  const rename=useCallback((id:string,label:string)=>{const result=apply({kind:"rename",id,label});return result?.status==="ready"&&!result.error;},[apply]);
  const currentPlaces=state.key===key?state.places:[];
  const places=useMemo(()=>world?currentPlaces.map(place=>({...place,changes:compareSavedPlace(place,world)})):[],[currentPlaces,world]);
  return {places,status:state.key===key?state.status:"loading",error,limitReached:places.length>=SAVED_PLACES_LIMIT,save,visit,remove,rename};
}
