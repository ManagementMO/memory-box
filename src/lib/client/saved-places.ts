import type {Memory,WorldSnapshot} from "../types";
import {memorySize} from "../scenes";
import {CELL_MAX,CELL_MIN,WORLD_MAX,WORLD_MIN} from "../world-bounds";
import {MAX_ZOOM,MIN_ZOOM} from "./canvas-geometry";

export const SAVED_PLACES_LIMIT=12;
export const SAVED_PLACE_LABEL_LIMIT=48;
const MAX_MEMORIES=256;
const SIDE_CELLS=64;
const MAX_PIXELS=SIDE_CELLS*SIDE_CELLS;
const MAX_STORAGE_LENGTH=2_500_000;
type Scope=Pick<WorldSnapshot,"worldId"|"epoch">;
type ReadStorage=Pick<Storage,"getItem"|"key"|"length">;
type BrowserStorage=ReadStorage&Pick<Storage,"setItem">&Partial<Pick<Storage,"removeItem">>;
type MemoryReference=[id:string,version:number];
type PixelReference=[x:number,y:number,hash:string,revision?:number];

export interface SavedPlaceTarget {x:number;y:number;z:number;originalId?:string}
export interface SavedPlaceBaseline {
  revision:number;capturedAt:number;gridSize:number;
  /** Half-open cell bounds keep every possible painted cell in the comparison bounded. */
  bounds:{minX:number;minY:number;maxX:number;maxY:number};
  memories:MemoryReference[];memoriesComplete:boolean;pixels:PixelReference[];
}
export interface SavedPlace extends SavedPlaceTarget {
  id:string;worldId:string;epoch:number;label:string;createdAt:number;updatedAt:number;baseline:SavedPlaceBaseline;
}
export interface SavedPlaceChanges {
  newOriginals:number;changedOriginals:number;removedOriginals:number;newReplies:number;paintedCells:number;removedCells:number;
  hasChanges:boolean;originalAvailable:boolean|null;limited:boolean;unavailable:boolean;stale:boolean;
}
export type SavedPlaceWithChanges=SavedPlace&{changes:SavedPlaceChanges};
export type SavedPlacesStatus="loading"|"ready"|"corrupt"|"unavailable";
export interface SavedPlacesRead {status:Exclude<SavedPlacesStatus,"loading">;places:SavedPlace[]}
export type SavedPlacesMutation=
  |{kind:"save";target:SavedPlaceTarget;label:string;id:string}
  |{kind:"visit"|"remove";id:string}
  |{kind:"rename";id:string;label:string};
export interface SavedPlacesMutationResult extends SavedPlacesRead {
  value:SavedPlace|null;error?:"limit"|"invalid"|"missing"|"stale";
}

const identifier=(value:unknown):value is string=>typeof value==="string"&&/^[a-zA-Z0-9:_-]{1,128}$/.test(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
const labelFor=(label:string)=>label.replace(/\s+/g," ").replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,SAVED_PLACE_LABEL_LIMIT)||"Saved place";
const validScope=(scope:Scope)=>identifier(scope.worldId)&&integer(scope.epoch);
function validTarget(value:SavedPlaceTarget){
  return [value.x,value.y,value.z].every(Number.isFinite)&&value.x>=WORLD_MIN&&value.x<=WORLD_MAX&&value.y>=WORLD_MIN&&value.y<=WORLD_MAX&&value.z>=MIN_ZOOM&&value.z<=MAX_ZOOM&&(value.originalId===undefined||identifier(value.originalId));
}

export function savedPlacesKey(scope:Scope):string{return `memory-box:saved-places:v1:${encodeURIComponent(scope.worldId)}:${scope.epoch}`;}
export function savedPlacesJournalPrefix(scope:Scope):string{return `memory-box:saved-places:v2:${encodeURIComponent(scope.worldId)}:${scope.epoch}:`;}
export function isSavedPlacesStorageKey(key:string|null,scope:Scope):boolean{return key===null||key===savedPlacesKey(scope)||key.startsWith(savedPlacesJournalPrefix(scope));}

/** The fingerprint describes public paint; it is not an identity or security primitive. */
function pixelHash(color:string):string{
  let value=2166136261;
  for(const character of color.toLowerCase())value=Math.imul(value^character.charCodeAt(0),16777619);
  return (value>>>0).toString(16).padStart(8,"0");
}
const inCells=(x:number,y:number,bounds:SavedPlaceBaseline["bounds"])=>x>=bounds.minX&&x<bounds.maxX&&y>=bounds.minY&&y<bounds.maxY;
function nearby(memory:Memory,baseline:Pick<SavedPlaceBaseline,"bounds"|"gridSize">):boolean{
  const size=memorySize(memory),{bounds,gridSize}=baseline;
  return memory.x+size.width>bounds.minX*gridSize&&memory.x<bounds.maxX*gridSize&&memory.y+size.height>bounds.minY*gridSize&&memory.y<bounds.maxY*gridSize;
}

/** Never cache authored story text, photos, names, queries or credentials. */
export function captureSavedPlace(world:WorldSnapshot,target:SavedPlaceTarget,label:string,id:string,now:number):SavedPlace{
  if(!validScope(world)||!validTarget(target)||!identifier(id)||!integer(now)||!integer(world.revision)||!integer(world.gridSize,1,128))throw new RangeError("Invalid saved place.");
  const minX=Math.max(CELL_MIN,Math.min(CELL_MAX+1-SIDE_CELLS,Math.floor(target.x/world.gridSize)-SIDE_CELLS/2));
  const minY=Math.max(CELL_MIN,Math.min(CELL_MAX+1-SIDE_CELLS,Math.floor(target.y/world.gridSize)-SIDE_CELLS/2));
  const baseline:SavedPlaceBaseline={revision:world.revision,capturedAt:now,gridSize:world.gridSize,bounds:{minX,minY,maxX:minX+SIDE_CELLS,maxY:minY+SIDE_CELLS},memories:[],memoriesComplete:true,pixels:[]};
  for(const memory of world.memories){
    if(memory.isSeed||!nearby(memory,baseline)&&memory.id!==target.originalId&&memory.inspiredBy!==target.originalId)continue;
    if(baseline.memories.length<MAX_MEMORIES)baseline.memories.push([memory.id,memory.version]);
    else baseline.memoriesComplete=false;
  }
  for(const pixel of world.pixels){
    if(!inCells(pixel.x,pixel.y,baseline.bounds))continue;
    baseline.pixels.push([pixel.x,pixel.y,pixelHash(pixel.color),...(integer(pixel.revision,0,world.revision)?[pixel.revision]:[])] as PixelReference);
  }
  return {id,worldId:world.worldId,epoch:world.epoch,x:target.x,y:target.y,z:target.z,...(target.originalId?{originalId:target.originalId}:{}),label:labelFor(label),createdAt:now,updatedAt:now,baseline};
}

/** A later full snapshot is compared with the last explicit visit, never with a poll. */
export function compareSavedPlace(place:SavedPlace,world:WorldSnapshot):SavedPlaceChanges{
  const baseline=place.baseline;
  const result:SavedPlaceChanges={newOriginals:0,changedOriginals:0,removedOriginals:0,newReplies:0,paintedCells:0,removedCells:0,hasChanges:false,originalAvailable:place.originalId?world.memories.some(memory=>memory.id===place.originalId):null,limited:!baseline.memoriesComplete,unavailable:false,stale:false};
  if(place.worldId!==world.worldId||place.epoch!==world.epoch||baseline.gridSize!==world.gridSize){result.unavailable=true;return result;}
  if(world.revision<baseline.revision){result.stale=true;return result;}
  if(world.revision===baseline.revision)return result;
  const known=new Map(baseline.memories);
  const available=new Set(world.memories.filter(memory=>!memory.isSeed).map(memory=>memory.id));
  for(const [id] of baseline.memories)if(!available.has(id))result.removedOriginals++;
  for(const memory of world.memories){
    if(memory.isSeed)continue;
    const previous=known.get(memory.id),linkedReply=!!place.originalId&&memory.inspiredBy===place.originalId;
    if(previous!==undefined){if(previous!==memory.version)result.changedOriginals++;}
    else if(baseline.memoriesComplete){
      if(linkedReply)result.newReplies++;
      else if(nearby(memory,baseline))result.newOriginals++;
    }
  }
  const previousPixels=new Map(baseline.pixels.map(([x,y,hash])=>[`${x},${y}`,hash]));
  for(const pixel of world.pixels){
    if(!inCells(pixel.x,pixel.y,baseline.bounds))continue;
    const key=`${pixel.x},${pixel.y}`,previous=previousPixels.get(key);
    if(previous!==pixelHash(pixel.color))result.paintedCells++;
    previousPixels.delete(key);
  }
  result.removedCells=previousPixels.size;
  result.hasChanges=result.newOriginals+result.changedOriginals+result.removedOriginals+result.newReplies+result.paintedCells+result.removedCells>0;
  return result;
}

function validPlace(value:unknown,scope:Scope):value is SavedPlace{
  if(!object(value)||!exactKeys(value,["id","worldId","epoch","x","y","z","originalId","label","createdAt","updatedAt","baseline"]))return false;
  if(!identifier(value.id)||value.worldId!==scope.worldId||value.epoch!==scope.epoch||!validTarget(value as unknown as SavedPlaceTarget)||typeof value.label!=="string"||value.label!==labelFor(value.label)||!integer(value.createdAt)||!integer(value.updatedAt,value.createdAt))return false;
  return validBaseline(value.baseline);
}

function validBaseline(baseline:unknown):baseline is SavedPlaceBaseline{
  if(!object(baseline)||!exactKeys(baseline,["revision","capturedAt","gridSize","bounds","memories","memoriesComplete","pixels"])||!integer(baseline.revision)||!integer(baseline.capturedAt)||!integer(baseline.gridSize,1,128)||typeof baseline.memoriesComplete!=="boolean")return false;
  const bounds=baseline.bounds;
  if(!object(bounds)||!exactKeys(bounds,["minX","minY","maxX","maxY"])||!integer(bounds.minX,CELL_MIN,CELL_MAX)||!integer(bounds.minY,CELL_MIN,CELL_MAX)||!integer(bounds.maxX,CELL_MIN+1,CELL_MAX+1)||!integer(bounds.maxY,CELL_MIN+1,CELL_MAX+1)||bounds.maxX-bounds.minX!==SIDE_CELLS||bounds.maxY-bounds.minY!==SIDE_CELLS)return false;
  if(!Array.isArray(baseline.memories)||baseline.memories.length>MAX_MEMORIES||!Array.isArray(baseline.pixels)||baseline.pixels.length>MAX_PIXELS)return false;
  const memoryIds=new Set<string>(),pixelIds=new Set<string>();
  for(const reference of baseline.memories){
    if(!Array.isArray(reference)||reference.length!==2||!identifier(reference[0])||!integer(reference[1],1)||memoryIds.has(reference[0]))return false;
    memoryIds.add(reference[0]);
  }
  for(const reference of baseline.pixels){
    if(!Array.isArray(reference)||(reference.length!==3&&reference.length!==4)||!integer(reference[0],bounds.minX,bounds.maxX-1)||!integer(reference[1],bounds.minY,bounds.maxY-1)||typeof reference[2]!=="string"||!/^[a-f0-9]{8}$/.test(reference[2])||(reference.length===4&&!integer(reference[3],0,baseline.revision)))return false;
    const key=`${reference[0]},${reference[1]}`;if(pixelIds.has(key))return false;pixelIds.add(key);
  }
  return true;
}

export function decodeSavedPlaces(raw:string|null,scope:Scope):SavedPlacesRead{
  if(raw===null)return {status:"ready",places:[]};
  if(raw.length>MAX_STORAGE_LENGTH||!validScope(scope))return {status:"corrupt",places:[]};
  try{
    const value:unknown=JSON.parse(raw);
    if(!object(value)||!exactKeys(value,["version","worldId","epoch","places"])||value.version!==1||value.worldId!==scope.worldId||value.epoch!==scope.epoch||!Array.isArray(value.places)||value.places.length>SAVED_PLACES_LIMIT)return {status:"corrupt",places:[]};
    const ids=new Set<string>();
    for(const place of value.places){if(!validPlace(place,scope)||ids.has(place.id))return {status:"corrupt",places:[]};ids.add(place.id);}
    return {status:"ready",places:value.places as SavedPlace[]};
  }catch{return {status:"corrupt",places:[]};}
}

/** Explicit field selection makes accidental object spread unable to persist story payloads. */
export function encodeSavedPlaces(scope:Scope,places:readonly SavedPlace[]):string{
  return JSON.stringify({version:1,worldId:scope.worldId,epoch:scope.epoch,places:places.map(place=>({id:place.id,worldId:scope.worldId,epoch:scope.epoch,x:place.x,y:place.y,z:place.z,...(place.originalId?{originalId:place.originalId}:{}),label:place.label,createdAt:place.createdAt,updatedAt:place.updatedAt,baseline:{revision:place.baseline.revision,capturedAt:place.baseline.capturedAt,gridSize:place.baseline.gridSize,bounds:{minX:place.baseline.bounds.minX,minY:place.baseline.bounds.minY,maxX:place.baseline.bounds.maxX,maxY:place.baseline.bounds.maxY},memories:place.baseline.memories.map(([id,version])=>[id,version]),memoriesComplete:place.baseline.memoriesComplete,pixels:place.baseline.pixels.map(([x,y,hash,revision])=>[x,y,hash,...(revision!==undefined?[revision]:[])])}}))});
}

interface OperationHeader {version:2;worldId:string;epoch:number;opId:string;id:string;at:number}
type JournalOperation=OperationHeader&(
  |{kind:"create";place:SavedPlace}|{kind:"rename";label:string}|{kind:"visit";baseline:SavedPlaceBaseline}|{kind:"remove"|"legacy-reset"}
);
interface OperationRecord {key:string;operation:JournalOperation}
interface Field<T> {value:T;at:number;opId:string;key:string|null}
interface PlaceFields {
  creates:Field<SavedPlace>[];labels:Field<string>[];baselines:Field<SavedPlaceBaseline>[];removals:Field<true>[];
}
interface JournalRead extends SavedPlacesRead {
  records:OperationRecord[];keep:Set<string>;clock:number;corruptLegacy:boolean;knownIds:Set<string>;
}
const compareId=(a:string,b:string)=>a<b?-1:a>b?1:0;
const compareField=(a:Field<unknown>,b:Field<unknown>)=>a.at-b.at||compareId(a.opId,b.opId);
const compareBaseline=(a:Field<SavedPlaceBaseline>,b:Field<SavedPlaceBaseline>)=>a.value.revision-b.value.revision||compareField(a,b);
const maximum=<T,>(fields:Field<T>[],compare:(a:Field<T>,b:Field<T>)=>number=compareField)=>fields.reduce((a,b)=>compare(a,b)>=0?a:b);

function validOperation(value:unknown,scope:Scope):value is JournalOperation{
  if(!object(value)||value.version!==2||value.worldId!==scope.worldId||value.epoch!==scope.epoch||!identifier(value.opId)||!identifier(value.id)||!integer(value.at))return false;
  const keys=["version","worldId","epoch","opId","id","at","kind"];
  if(value.kind==="create")return exactKeys(value,[...keys,"place"])&&validPlace(value.place,scope)&&value.place.id===value.id;
  if(value.kind==="rename")return exactKeys(value,[...keys,"label"])&&typeof value.label==="string"&&value.label===labelFor(value.label);
  if(value.kind==="visit")return exactKeys(value,[...keys,"baseline"])&&validBaseline(value.baseline);
  return (value.kind==="remove"||value.kind==="legacy-reset")&&exactKeys(value,keys);
}

/** Each writer appends to its own unique key; labels and visit baselines merge independently. */
function readJournal(storage:ReadStorage,scope:Scope):JournalRead{
  const records:OperationRecord[]=[],keep=new Set<string>(),knownIds=new Set<string>();
  if(!validScope(scope))return {status:"corrupt",places:[],records,keep,clock:0,corruptLegacy:false,knownIds};
  const prefix=savedPlacesJournalPrefix(scope),keys=new Set<string>();let corrupt=false,clock=0;
  // Two enumerations also collect keys added while another tab finishes an edit.
  // This is convergence over immutable records, not an atomic localStorage snapshot.
  for(let pass=0;pass<2;pass++)for(let index=0,total=storage.length;index<total;index++){
    const key=storage.key(index);if(key?.startsWith(prefix))keys.add(key);
  }
  for(const key of keys){
    const raw=storage.getItem(key);if(raw===null)continue;
    try{
      const value:unknown=raw.length<=MAX_STORAGE_LENGTH?JSON.parse(raw):null;
      if(!validOperation(value,scope)||key!==`${prefix}${value.opId}`){corrupt=true;continue;}
      records.push({key,operation:value});clock=Math.max(clock,value.at);
    }catch{corrupt=true;}
  }
  const resets=records.filter(record=>record.operation.kind==="legacy-reset");
  if(resets.length){const reset=resets.reduce((a,b)=>a.operation.at>b.operation.at||a.operation.at===b.operation.at&&compareId(a.operation.opId,b.operation.opId)>0?a:b);keep.add(reset.key);}
  const legacy=resets.length?{status:"ready" as const,places:[]}:decodeSavedPlaces(storage.getItem(savedPlacesKey(scope)),scope);
  const fields=new Map<string,PlaceFields>();
  const forId=(id:string)=>{knownIds.add(id);let entry=fields.get(id);if(!entry){entry={creates:[],labels:[],baselines:[],removals:[]};fields.set(id,entry);}return entry;};
  for(const place of legacy.places){
    clock=Math.max(clock,place.updatedAt);const entry=forId(place.id),opId=`legacy:${place.id}`;
    entry.creates.push({value:place,at:place.createdAt,opId,key:null});
    entry.labels.push({value:place.label,at:place.updatedAt,opId,key:null});
    entry.baselines.push({value:place.baseline,at:place.baseline.capturedAt,opId,key:null});
  }
  for(const {key,operation:op} of records){
    if(op.kind==="legacy-reset")continue;
    const entry=forId(op.id),stamp={at:op.at,opId:op.opId,key};
    if(op.kind==="create")entry.creates.push({...stamp,value:op.place});
    if(op.kind==="rename")entry.labels.push({...stamp,value:op.label});
    if(op.kind==="visit")entry.baselines.push({...stamp,value:op.baseline});
    if(op.kind==="remove")entry.removals.push({...stamp,value:true});
  }
  const places:SavedPlace[]=[];
  for(const entry of fields.values()){
    if(entry.removals.length){const removed=maximum(entry.removals);if(removed.key)keep.add(removed.key);continue;}
    // Coordinates and original identity are immutable for a bookmark. A new save gets a new ID.
    if(!entry.creates.length){
      // Enumeration is not a transaction. A base key missed during another tab's
      // cleanup must never make a valid independent update eligible for deletion.
      for(const field of [...entry.labels,...entry.baselines])if(field.key)keep.add(field.key);
      continue;
    }
    const birth=entry.creates.reduce((a,b)=>compareField(a,b)<=0?a:b),place=birth.value;
    if(birth.key)keep.add(birth.key);
    const label=maximum([...entry.labels,{value:place.label,at:place.updatedAt,opId:birth.opId,key:birth.key}]);
    const baseline=maximum([...entry.baselines,{value:place.baseline,at:birth.at,opId:birth.opId,key:birth.key}],compareBaseline);
    if(label.key)keep.add(label.key);if(baseline.key)keep.add(baseline.key);
    places.push({...place,label:label.value,baseline:baseline.value,updatedAt:Math.max(place.updatedAt,label.at,baseline.at)});
  }
  places.sort((a,b)=>a.createdAt-b.createdAt||compareId(a.id,b.id));
  return {status:corrupt||legacy.status==="corrupt"?"corrupt":"ready",places,records,keep,clock,corruptLegacy:legacy.status==="corrupt",knownIds};
}

export function readSavedPlaces(storage:ReadStorage,scope:Scope):SavedPlacesRead{
  try{const {status,places}=readJournal(storage,scope);return {status,places};}
  catch{return {status:"unavailable",places:[]};}
}

function operationId():string{
  return typeof globalThis.crypto?.randomUUID==="function"?globalThis.crypto.randomUUID():`op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Delete only records already dominated by a persisted winner for the same field.
 * A concurrent, unseen key cannot be deleted. Any writer removing our winner must
 * itself retain a strictly newer winner; removal tombstones dominate every field.
 */
function pruneDominatedOperations(storage:BrowserStorage,loaded:JournalRead){
  if(!storage.removeItem)return;
  for(const record of loaded.records)if(!loaded.keep.has(record.key)){
    try{storage.removeItem(record.key);}catch{/* Quota cleanup is best effort; the append already succeeded. */}
  }
}

/** Append-only edits converge across tabs without a shared read-modify-write envelope. */
export function mutateSavedPlaces(storage:BrowserStorage,world:WorldSnapshot,mutation:SavedPlacesMutation,now:number):SavedPlacesMutationResult{
  let loaded:JournalRead;
  try{loaded=readJournal(storage,world);}catch{return {status:"unavailable",places:[],value:null};}
  const prior:SavedPlacesRead={status:loaded.status,places:loaded.places};
  if(!integer(now))return {...prior,value:null,error:"invalid"};
  const at=Math.max(now,loaded.clock+1),header={version:2 as const,worldId:world.worldId,epoch:world.epoch,opId:operationId(),id:mutation.id,at};
  let operation:JournalOperation;
  if(mutation.kind==="save"){
    const existing=loaded.places.find(place=>place.x===mutation.target.x&&place.y===mutation.target.y&&place.originalId===mutation.target.originalId);
    if(existing)return {...prior,value:existing};
    if(loaded.places.length>=SAVED_PLACES_LIMIT)return {...prior,value:null,error:"limit"};
    if(loaded.knownIds.has(mutation.id))return {...prior,value:null,error:"invalid"};
    try{operation={...header,kind:"create",place:{...captureSavedPlace(world,mutation.target,mutation.label,mutation.id,now),updatedAt:at}};}
    catch{return {...prior,value:null,error:"invalid"};}
  }else{
    const place=loaded.places.find(place=>place.id===mutation.id);
    if(!place)return {...prior,value:null,error:"missing"};
    if(mutation.kind==="remove")operation={...header,kind:"remove"};
    else if(mutation.kind==="rename")operation={...header,kind:"rename",label:labelFor(mutation.label)};
    else{
      if(world.revision<place.baseline.revision)return {...prior,value:place,error:"stale"};
      operation={...header,kind:"visit",baseline:captureSavedPlace(world,place,place.label,place.id,now).baseline};
    }
  }
  if(!validOperation(operation,world))return {...prior,value:null,error:"invalid"};
  const prefix=savedPlacesJournalPrefix(world);
  try{
    if(mutation.kind==="save"&&loaded.corruptLegacy){
      const reset:JournalOperation={...header,id:"legacy",opId:operationId(),kind:"legacy-reset"};
      storage.setItem(`${prefix}${reset.opId}`,JSON.stringify(reset));
    }
    storage.setItem(`${prefix}${operation.opId}`,JSON.stringify(operation));
  }catch{return {status:"unavailable",places:loaded.places,value:null};}
  try{
    const merged=readJournal(storage,world);pruneDominatedOperations(storage,merged);
    // Concurrent saves can exceed the soft limit. Preserve both rather than silently discard one.
    return {status:merged.status,places:merged.places,value:mutation.kind==="remove"?null:merged.places.find(place=>place.id===mutation.id)??null};
  }catch{
    // The append was accepted, but the result could not be read reliably. Keep the last known view.
    return {status:"unavailable",places:loaded.places,value:null};
  }
}
