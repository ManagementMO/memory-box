"use client";

import {getBrowserSupabase} from "./supabase";
import type {OperatorQueue} from "../operator-types";

export class OperatorRequestError extends Error {
  constructor(message:string,public status:number,public code="request_failed"){super(message);this.name="OperatorRequestError";}
}
async function operatorFetch(init:RequestInit={},imageId?:string):Promise<{response:Response;userId:string}> {
  // Review never signs in anonymously or grants a role. The server validates
  // this existing session and reads the current trusted operator profile.
  const {data,error}=await getBrowserSupabase().auth.getSession();
  if(error||!data.session?.user.id)throw new OperatorRequestError("Use the browser session already approved as an operator.",401,"sign_in_required");
  const headers=new Headers(init.headers);
  headers.set("Authorization",`Bearer ${data.session.access_token}`);
  if(init.body)headers.set("Content-Type","application/json");
  const response=await fetch(imageId?`/api/operator?image=${encodeURIComponent(imageId)}`:"/api/operator",{...init,headers,cache:"no-store"});
  if(!response.ok){
    const payload=await response.json().catch(()=>null);
    throw new OperatorRequestError(typeof payload?.error==="string"?payload.error:"The operator request could not be completed. Try again.",response.status,typeof payload?.code==="string"?payload.code:"request_failed");
  }
  return {response,userId:data.session.user.id};
}
export async function operatorRequest<T>(init:RequestInit={}):Promise<T>{
  return (await operatorFetch(init)).response.json() as Promise<T>;
}
export async function operatorPhoto(memoryId:string,signal:AbortSignal):Promise<Blob>{
  return (await operatorFetch({signal},memoryId)).response.blob();
}
export async function operatorQueueRequest(signal:AbortSignal):Promise<{queue:OperatorQueue;userId:string}>{
  const {response,userId}=await operatorFetch({signal});
  return {queue:await response.json() as OperatorQueue,userId};
}
