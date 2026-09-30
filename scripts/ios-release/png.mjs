import assert from "node:assert/strict";
import { crc32, inflateSync } from "node:zlib";
import { PNG } from "pngjs";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function framedChunks(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length <= 64 * 1024 * 1024 && bytes.subarray(0, 8).equals(SIGNATURE), "Expected a bounded PNG capture.");
  const result = []; let offset = 8;
  while (offset < bytes.length) {
    assert(result.length < 10000 && offset + 12 <= bytes.length, "Invalid PNG chunk framing.");
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    assert(end <= bytes.length, "Truncated PNG chunk.");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    assert(/^[A-Za-z]{4}$/.test(type), "Invalid PNG chunk name.");
    assert.equal(crc32(bytes.subarray(offset + 4, end - 4)), bytes.readUInt32BE(end - 4), `Invalid ${type} CRC.`);
    result.push({ type, data: bytes.subarray(offset + 8, end - 4), bytes: bytes.subarray(offset, end) });
    offset = end;
  }
  assert(result[0]?.type === "IHDR" && result[0].data.length === 13 && result.at(-1)?.type === "IEND", "Incomplete PNG framing.");
  assert(result.filter((chunk) => chunk.type === "IHDR").length === 1 && result.filter((chunk) => chunk.type === "IEND").length === 1, "Duplicate header or end chunk.");
  assert(result.at(-1).data.length === 0 && result.some((chunk) => chunk.type === "IDAT"), "Invalid PNG image data framing.");
  assert(!result.some((chunk) => ["acTL", "fcTL", "fdAT"].includes(chunk.type)), "Animated captures require separate validation.");
  const firstData = result.findIndex((chunk) => chunk.type === "IDAT"), lastData = result.findLastIndex((chunk) => chunk.type === "IDAT");
  assert(result.slice(firstData, lastData + 1).every((chunk) => chunk.type === "IDAT"), "PNG IDAT chunks must be consecutive.");
  return result;
}

function scanlineBytes(header, width, height) {
  const depth = header[8], color = header[9], interlace = header[12];
  const formats = { 0: [1, [1, 2, 4, 8, 16]], 2: [3, [8, 16]], 3: [1, [1, 2, 4, 8]], 4: [2, [8, 16]], 6: [4, [8, 16]] };
  assert(formats[color]?.[1].includes(depth) && header[10] === 0 && header[11] === 0 && [0, 1].includes(interlace), "Invalid PNG encoding header.");
  const channels = formats[color][0];
  // Adam7 pass origin and strides. Empty passes have no filter byte.
  const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  return passes.reduce((total, [x, y, dx, dy]) => {
    const columns = Math.max(0, Math.ceil((width - x) / dx)), rows = Math.max(0, Math.ceil((height - y) / dy));
    return total + (columns && rows ? (1 + Math.ceil(columns * channels * depth / 8)) * rows : 0);
  }, 0);
}

/** Validate every chunk and the sole allocation header before invoking the decoder. */
export function readCapturePng(bytes) {
  const chunks = framedChunks(bytes), header = chunks[0].data;
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
  assert(width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 32000000, "Capture dimensions exceed the decode limit.");
  const expected = scanlineBytes(header, width, height);
  const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
  // pngjs bounds only noninterlaced inflation, and can truncate surplus rows.
  // Validate exact decompression first, including Adam7, without unbounded output.
  const inflated = inflateSync(compressed, { maxOutputLength: expected, info: true });
  assert.equal(inflated.buffer.length, expected, "PNG scanline byte count differs from its header.");
  assert.equal(inflated.engine.bytesWritten, compressed.length, "PNG has trailing data after its compressed stream.");
  const image = PNG.sync.read(bytes, { checkCRC: true });
  assert.equal(image.width, width); assert.equal(image.height, height);
  return { image, chunks };
}
