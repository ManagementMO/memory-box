"use client";
import {useEffect,useState} from "react";
import {initializeMeasurement,type ArrivalSelection} from "./posthog-client";

export function useArrivalExperiment(){
  const [selection,setSelection]=useState<ArrivalSelection|null>(null);
  useEffect(()=>{let active=true;void initializeMeasurement().then(value=>{if(active)setSelection(value);});return()=>{active=false;};},[]);
  return selection;
}
