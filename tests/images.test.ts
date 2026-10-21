import {describe,expect,it} from "vitest";
import sharp from "sharp";
import {sanitizeImage} from "../src/lib/server/images";

describe("image publication",()=>{
  it("rejects disguised executable markup",async()=>{
    await expect(sanitizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>'))).rejects.toMatchObject({code:"invalid_image"});
  });
  it("strips metadata and bounds oversized dimensions while keeping an actual raster",async()=>{
    const original=await sharp({create:{width:1900,height:300,channels:3,background:"#354fb2"}}).jpeg().withExif({IFD0:{Artist:"Private camera metadata"}}).toBuffer();
    const result=await sanitizeImage(original);
    const metadata=await sharp(result.bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.exif).toBeUndefined();
  });
  it("rejects a corrupt file even when the name could have looked like an image",async()=>{
    await expect(sanitizeImage(Buffer.from("not actually a PNG"))).rejects.toMatchObject({code:"invalid_image"});
  });
});
