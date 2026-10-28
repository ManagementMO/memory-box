import type {MemoryType} from "./types";

/** Deliberately excludes reporter identities, Auth records and internal search data. */
export interface OperatorSource {
  id:string;
  type:MemoryType;
  title:string;
  body:string;
  url:string|null;
  authorName:string;
  visibility:"published"|"hidden";
  imageAvailable:boolean;
  seedImageUrl:string|null;
  x:number;
  y:number;
  version:number;
  updatedAt:string;
  inspiredBy:string|null;
}
export interface OperatorReport {
  id:string;
  memoryId:string|null;
  bounds:{x:number;y:number;width:number;height:number}|null;
  reason:string;
  createdAt:string;
  source:OperatorSource|null;
}
export interface OperatorQueue {
  reports:OperatorReport[];
  limit:number;
  hasMore:boolean;
}
export interface OperatorReportReview {
  reportId:string;
  requestId:string;
  state:"resolved"|"dismissed";
  reviewedAt:string;
  replayed:boolean;
}
