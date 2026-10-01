import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

const folder = new URL("../../apps/mobile/assets/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("provenance.json", folder), "utf8"));
const config = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8")).expo;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("editable source and all four raster exports match their recorded inputs", () => {
  assert.equal(manifest.sourceSha256, hash(readFileSync(new URL("icon-source.svg", folder), "utf8").replace(/\r\n/g, "\n")));
  assert.deepEqual(manifest.exports.map((image) => image.file).sort(), ["icon-dark.png", "icon-tinted.png", "icon.png", "launch-mark.png"]);
  for (const image of manifest.exports) {
    const bytes = readFileSync(new URL(image.file, folder));
    assert.equal(hash(bytes), image.sha256);
    const png = PNG.sync.read(bytes, { checkCRC: true });
    assert.equal(png.width, 1024); assert.equal(png.height, 1024);
    assert.equal(image.width, png.width); assert.equal(image.height, png.height);
    let transparent = false;
    for (let index = 0; index < png.data.length; index += 4) {
      if (png.data[index + 3] !== 255) transparent = true;
      if (image.file === "icon-tinted.png") {
        assert.equal(png.data[index], png.data[index + 1]); assert.equal(png.data[index], png.data[index + 2]);
      }
    }
    assert.equal(transparent, image.transparencyAllowed, image.file);
  }
});
test("native configuration resolves the intended icons and launch mark", () => {
  assert.equal(config.icon, "./assets/icon.png");
  assert.deepEqual(config.ios.icon, { light: "./assets/icon.png", dark: "./assets/icon-dark.png", tinted: "./assets/icon-tinted.png" });
  const splash = config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen")[1];
  assert.equal(splash.image, "./assets/launch-mark.png");
  assert.equal(splash.dark.image, splash.image);
  assert.equal(config.ios.supportsTablet, true);
  assert.equal(config.ios.requireFullScreen, false);
  assert.equal(config.orientation, "default");
  assert.equal(config.userInterfaceStyle, "automatic");
});
