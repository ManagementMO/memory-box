import type {ArrivalSource,ArrivalVariant} from "./canvas-arrival";

export const FLAG_KEY="arrival-experience-v1";
export const ANALYTICS_KEY="memory-box:measurement:v1";
export const OPT_OUT_KEY="memory-box:measurement-disabled";
export const SESSION_GAP=30*60*1000;
export const isArrivalVariant=(value:unknown):value is ArrivalVariant=>value==="world-first"||value==="inside-world";
export type ContributionKind="text"|"image"|"link"|"paint";
export interface AnalyticsState{
  version:1;id:string;firstSeen:number;lastActive:number;sessionStarted:number;sessionId:string;sessionReported?:boolean;accepted:string[];
  enrollment?:{variant:ArrivalVariant;exposedAt:number};
}
export interface AnalyticsAdapter{capture:(event:string,properties:Record<string,unknown>)=>unknown;getVariant:()=>unknown}
type Eligibility={host:string;canonicalHost:string;token:string;automated:boolean;qa:boolean;optOut:boolean;dnt:boolean;gpc:boolean};
export function allowedAnalytics(value:Eligibility){return !!value.token&&!!value.canonicalHost&&value.host===value.canonicalHost&&!value.automated&&!value.qa&&!value.optOut&&!value.dnt&&!value.gpc;}
export function parseAnalyticsState(raw:string|null,now:number):AnalyticsState|null{
  if(!raw||raw.length>18000)return null;
  try{
    const v=JSON.parse(raw),time=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>0&&n<=now;
    if(!v||v.version!==1||typeof v.id!=="string"||!/^[-a-f0-9]{36}$/i.test(v.id)||typeof v.sessionId!=="string"||v.sessionId.length>64||!time(v.firstSeen)||!time(v.lastActive)||!time(v.sessionStarted)||v.firstSeen>v.sessionStarted||v.sessionStarted>v.lastActive||!Array.isArray(v.accepted)||v.accepted.length>128||v.accepted.some((id:unknown)=>typeof id!=="string"||id.length>100))return null;
    if(v.enrollment&&(!isArrivalVariant(v.enrollment.variant)||!time(v.enrollment.exposedAt)||v.enrollment.exposedAt<v.firstSeen))return null;
    return {version:1,id:v.id,firstSeen:v.firstSeen,lastActive:v.lastActive,sessionStarted:v.sessionStarted,sessionId:v.sessionId,sessionReported:v.sessionReported===true,accepted:v.accepted,...(v.enrollment?{enrollment:{variant:v.enrollment.variant,exposedAt:v.enrollment.exposedAt}}:{})};
  }catch{return null;}
}
export function visitState(previous:AnalyticsState|null,now:number,uuid:()=>string){
  const started=!previous||now-previous.lastActive>=SESSION_GAP;
  const state:AnalyticsState=previous?{...previous,lastActive:now,...(started?{sessionStarted:now,sessionId:uuid(),sessionReported:false}:{} )}:{version:1,id:uuid(),firstSeen:now,lastActive:now,sessionStarted:now,sessionId:uuid(),sessionReported:false,accepted:[]};
  return {state,started,returning:!!previous&&started};
}

const EVENTS=new Set(["visit_started","arrival_shown","original_opened","place_explored","contribution_saved","place_shared"]);
const STRINGS:Record<string,readonly string[]>={arrival_variant:["world-first","inside-world"],kind:["text","image","link","paint"],device:["desktop","mobile"],method:["copy","native"],entry:["shared","saved","default","experiment"],[`$feature/${FLAG_KEY}`]:["world-first","inside-world"]};
const BOOLEAN=new Set(["returning","build_on","within_five_minutes","is_starter","is_test","$process_person_profile"]);
const NUMERIC=new Set(["elapsed_seconds","days_since_first_visit","pixel_count"]);
/** Last boundary before transport: SDK-added page URLs and person properties
 * are subject to the same allowlist as our own properties. */
export function cleanEvent<T extends {event:string;properties:Record<string,unknown>;uuid?:string;timestamp?:Date}>(event:T):{event:string;properties:Record<string,unknown>;uuid?:string;timestamp?:Date}|null{
  if(!EVENTS.has(event.event))return null;
  const properties:Record<string,unknown>={};
  for(const [key,value] of Object.entries(event.properties)){
    if(STRINGS[key]?.includes(value as string))properties[key]=value;
    else if(BOOLEAN.has(key)&&typeof value==="boolean")properties[key]=value;
    else if(NUMERIC.has(key)&&typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1e8)properties[key]=value;
    else if(["distinct_id","token","$insert_id","$session_id"].includes(key)&&typeof value==="string"&&value.length<=160)properties[key]=value;
  }
  properties.$ip=0;
  return {event:event.event,properties,...(typeof event.uuid==="string"?{uuid:event.uuid}:{}),...(event.timestamp instanceof Date?{timestamp:event.timestamp}:{})};
}

export class ProductAnalytics{
  private shown=false;
  private arrivedAt:number|null=null;
  private discoveries=new Set<string>();
  constructor(private adapter:AnalyticsAdapter,private read:()=>AnalyticsState,private write:(state:AnalyticsState)=>void,private now=Date.now){}
  private emit(event:string,properties:Record<string,unknown>={}){
    const s=this.read(),variant=s.enrollment?.variant;
    try{this.adapter.capture(event,{...properties,...(variant?{arrival_variant:variant,[`$feature/${FLAG_KEY}`]:variant}:{} )});}catch{/* Measurement cannot prevent an action. */}
  }
  visit(){
    const prior=this.read(),next=visitState(prior,this.now(),()=>crypto.randomUUID());
    this.write(next.state);
    if(next.started)this.firstVisit(next.returning);
  }
  touch(){const s=this.read();if(this.now()-s.lastActive>=SESSION_GAP)this.visit();else this.write({...s,lastActive:this.now()});}
  firstVisit(returning?:boolean){const s=this.read();if(s.sessionReported)return;this.write({...s,sessionReported:true});this.emit("visit_started",{returning:returning??s.sessionStarted>s.firstSeen,days_since_first_visit:Math.floor((this.now()-s.firstSeen)/86400000)});}
  arrived(variant:ArrivalVariant|null,source:ArrivalSource){
    if(this.shown)return;this.shown=true;this.arrivedAt=this.now();
    const s=this.read();
    if(source!=="experiment"||!variant||s.enrollment)return;
    this.write({...s,enrollment:{variant,exposedAt:this.now()}});
    this.emit("arrival_shown",{device:typeof innerWidth!=="undefined"&&innerWidth<=700?"mobile":"desktop",entry:source});
  }
  contribution(id:string,kind:ContributionKind,buildOn:boolean,pixelCount?:number){
    if(this.arrivedAt===null)return;
    this.touch();const s=this.read();if(s.accepted.includes(id))return;
    this.write({...s,accepted:[...s.accepted,id].slice(-128)});
    const elapsed=(this.now()-(s.enrollment?.exposedAt??this.arrivedAt))/1000;
    this.emit("contribution_saved",{kind,build_on:buildOn,elapsed_seconds:Math.max(0,Math.round(elapsed)),within_five_minutes:!!s.enrollment&&elapsed>=0&&elapsed<=300,...(pixelCount===undefined?{}:{pixel_count:pixelCount})});
  }
  opened(id:string,kind:ContributionKind,isStarter:boolean){if(this.discoveries.has(`story:${id}`))return;this.discoveries.add(`story:${id}`);this.touch();this.emit("original_opened",{kind,is_starter:isStarter});}
  explored(id:string){if(this.discoveries.has(`place:${id}`))return;this.discoveries.add(`place:${id}`);this.touch();this.emit("place_explored");}
  shared(method:"copy"|"native"){this.touch();this.emit("place_shared",{method});}
}
