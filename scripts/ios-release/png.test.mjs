import assert from "node:assert/strict";
import test from "node:test";
import { crc32, deflateSync } from "node:zlib";
import { PNG } from "pngjs";
import { readCapturePng } from "./png.mjs";

function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); result.write(type, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4); return result;
}
function image({ interlace = 0, raw = Buffer.from([0, 10, 20, 30]), compressed = deflateSync(raw), width = 1, height = 1, depth = 8, color = 2 } = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = depth; header[9] = color; header[12] = interlace;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}
test("one-pixel standard and Adam7 RGB images pass full validation", () => {
  for (const interlace of [0, 1]) assert.deepEqual([...readCapturePng(image({ interlace })).image.data], [10, 20, 30, 255]);
});
test("inflate output must match the sole bounded header for both image layouts", () => {
  for (const interlace of [0, 1]) {
    assert.throws(() => readCapturePng(image({ interlace, raw: Buffer.alloc(5) })), /larger|output length|scanline/);
    assert.throws(() => readCapturePng(image({ interlace, raw: Buffer.alloc(3) })), /scanline/);
  }
});
test("IDAT does not hide trailing or concatenated compressed streams", () => {
  const compressed = deflateSync(Buffer.from([0, 10, 20, 30]));
  for (const suffix of [Buffer.from([0]), compressed]) assert.throws(() => readCapturePng(image({ compressed: Buffer.concat([compressed, suffix]) })), /compressed stream/);
});
test("invalid chunk order, duplicate ends and animation chunks are refused", () => {
  const bytes = image();
  assert.throws(() => readCapturePng(Buffer.concat([bytes, bytes.subarray(-12)])), /Duplicate/);
  const frame = chunk("acTL", Buffer.alloc(8));
  assert.throws(() => readCapturePng(Buffer.concat([bytes.subarray(0, 33), frame, bytes.subarray(33)])), /Animated/);
  const empty = chunk("IDAT", Buffer.alloc(0)), ancillary = chunk("tEXt", Buffer.from("a\0b"));
  assert.throws(() => readCapturePng(Buffer.concat([bytes.subarray(0, -12), ancillary, empty, bytes.subarray(-12)])), /consecutive/);
});
test("oversized dimensions stop before decompression", () => {
  assert.throws(() => readCapturePng(image({ width: 8193, compressed: Buffer.from([0]) })), /dimensions/);
});
test("valid gray, RGB, alpha and 16-bit PNG formats still decode", () => {
  for (const colorType of [0, 2, 4, 6]) {
    const bytes = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([10, 10, 10, 255]) }, { colorType });
    assert.equal(readCapturePng(bytes).image.width, 1);
  }
  for (const interlace of [0, 1]) {
    const bytes = image({ depth: 16, interlace, raw: Buffer.from([0, 10, 10, 20, 20, 30, 30]) });
    assert.deepEqual([...readCapturePng(bytes).image.data], [10, 20, 30, 255]);
  }
});
