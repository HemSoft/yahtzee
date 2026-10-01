import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { privacyErrors } from "./privacy.mjs";

const upstream = { NSPrivacyTracking: false, NSPrivacyCollectedDataTypes: [], NSPrivacyAccessedAPITypes: [
  { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"] },
] };
const complete = () => [
  { path: "PrivacyInfo.xcprivacy", fields: structuredClone(upstream) },
  { path: "ExpoFileSystem_privacy.bundle/PrivacyInfo.xcprivacy", fields: structuredClone(upstream) },
];

test("native privacy check accepts matching SDK and aggregate declarations without asserting legal approval", () => {
  assert.deepEqual(privacyErrors(complete(), upstream), []);
});

test("an empty SDK resource bundle cannot pass because another manifest covers the same API", () => {
  assert.match(privacyErrors(complete().slice(0, 1), upstream).join("\n"), /missing from its built resource bundle/);
});

test("SDK drift and incomplete aggregate reasons remain errors", () => {
  const manifests = complete();
  manifests[1].fields.NSPrivacyTracking = true;
  manifests[0].fields.NSPrivacyAccessedAPITypes[0].NSPrivacyAccessedAPITypeReasons.pop();
  const errors = privacyErrors(manifests, upstream);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /differ from the locked SDK/);
  assert.match(errors[1], /85F4.1/);
  assert.equal(privacyErrors([], upstream).length, 3);
});

test("Expo FileSystem opts out of the precompiled package that omitted its manifest", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../apps/mobile/package.json", import.meta.url), "utf8"));
  assert.deepEqual(pkg.expo?.autolinking?.ios?.buildFromSource, ["expo-file-system"]);
});
