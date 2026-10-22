import { describe,expect,it } from "vitest";
import { memoryMaterial, originalLabel, overviewLabel } from "../src/lib/client/memory-presentation";

describe("expressive originals",()=>{
  it("keeps a material stable when an author edits their words",()=>{
    const before={id:"75093fbc-0a56-4c79-bf57-a1e9b38a56fa",type:"text" as const,title:"Old",body:"Earlier words"};
    expect(memoryMaterial({...before,title:"Edited",body:"A much longer original with new words"})).toBe(memoryMaterial(before));
    expect(before.body).toBe("Earlier words");
  });
  it("preserves the special purpose of photos and links",()=>{
    expect(memoryMaterial({id:"same-id",type:"image"})).toBe("photo");
    expect(memoryMaterial({id:"same-id",type:"link"})).toBe("link");
  });
  it("uses authored titles at overview distance and a bounded body excerpt for untitled originals",()=>{
    expect(overviewLabel({title:"My own title",body:"Body"})).toBe("My own title");
    expect(overviewLabel({title:"",body:"   One small thought\nabout home.  "})).toBe("One small thought about home.");
    expect(overviewLabel({title:"",body:"x".repeat(100)}).length).toBeLessThanOrEqual(57);
  });
  it("names a bodyless photo factually without inventing a caption",()=>{
    expect(originalLabel({type:"image",title:"",body:"",authorName:"visitor"})).toBe("Photo by @visitor");
    expect(originalLabel({type:"image",title:"  ",body:" \n ",authorName:"another person"})).toBe("Photo by @another person");
  });
  it("keeps an actual title or caption ahead of a factual fallback",()=>{
    const photo={type:"image" as const,title:"Their title",body:"Their caption",authorName:"visitor"};
    expect(originalLabel(photo)).toBe("Their title");
    expect(originalLabel({...photo,title:""})).toBe("Their caption");
  });
});
