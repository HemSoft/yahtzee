import assert from "node:assert/strict";
import test from "node:test";
import { crc32, deflateSync } from "node:zlib";
import { PNG } from "pngjs";
import { captureBlockers, sha256 } from "./evidence.mjs";

const record = { sourceCommit: "a".repeat(40) };
function blockers(bytes) {
  const capture = { filename: "capture.png", sourceCommit: record.sourceCommit, deviceFamily: "iphone", locale: "en-US", appearance: "light", width: 1, height: 1, sha256: sha256(bytes) };
  return captureBlockers(capture, record, () => bytes);
}
function encoded(colorType, alpha) {
  const image = new PNG({ width: 1, height: 1 });
  image.data.set([255, 255, 255, alpha]);
  return PNG.sync.write(image, { colorType });
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function transparentPalette(alpha) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 3;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("PLTE", Buffer.from([255, 255, 255])),
    chunk("tRNS", Buffer.from([alpha])), chunk("IDAT", deflateSync(Buffer.from([0, 0]))), chunk("IEND", Buffer.alloc(0))]);
}

for (const colorType of [4, 6]) for (const alpha of [0, 255]) {
  test(`App Store captures reject color type ${colorType} with alpha ${alpha}`, () => {
    const bytes = encoded(colorType, alpha);
    assert.equal(PNG.sync.read(bytes).alpha, true);
    assert(blockers(bytes).includes("Capture PNG has an alpha channel or transparency"));
  });
}
for (const alpha of [0, 255]) {
  test(`App Store captures reject palette transparency metadata with alpha ${alpha}`, () => {
    const bytes = transparentPalette(alpha);
    assert.equal(PNG.sync.read(bytes).alpha, true);
    assert(blockers(bytes).includes("Capture PNG has an alpha channel or transparency"));
  });
}
test("App Store captures reject RGB transparency metadata even without transparent pixels", () => {
  const rgb = encoded(2, 255);
  const bytes = Buffer.concat([rgb.subarray(0, 33), chunk("tRNS", Buffer.alloc(6)), rgb.subarray(33)]);
  const image = PNG.sync.read(bytes);
  assert.equal(image.alpha, true); assert.equal(image.data[3], 255);
  assert(blockers(bytes).includes("Capture PNG has an alpha channel or transparency"));
});
test("duplicate PNG headers cannot replace the header checked before allocation", () => {
  const rgb = encoded(2, 255);
  const duplicate = Buffer.concat([rgb.subarray(0, 33), rgb.subarray(8, 33), rgb.subarray(33)]);
  // pngjs accepts this invalid duplicate. Use a tiny fixture, not an allocation bomb.
  assert.equal(PNG.sync.read(duplicate).width, 1);
  assert(blockers(duplicate).some((message) => message.includes("invalid PNG")));
});
test("unknown ancillary chunks still require valid CRCs", () => {
  const rgb = encoded(2, 255), metadata = chunk("tEXt", Buffer.from("fixture\0draft"));
  metadata[metadata.length - 1] ^= 1;
  const damaged = Buffer.concat([rgb.subarray(0, 33), metadata, rgb.subarray(33)]);
  assert(blockers(damaged).some((message) => message.includes("invalid PNG")));
});
test("RGB captures without an alpha channel retain the existing byte checks", () => {
  const bytes = encoded(2, 255);
  assert.equal(PNG.sync.read(bytes).alpha, false);
  assert.deepEqual(blockers(bytes), []);
});
