import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

export function privacyErrors(manifests, upstream) {
  const errors = [];
  const sdk = manifests.find((item) => item.path === "ExpoFileSystem_privacy.bundle/PrivacyInfo.xcprivacy");
  if (!sdk) errors.push("Expo FileSystem privacy manifest is missing from its built resource bundle.");
  else if (!isDeepStrictEqual(sdk.fields, upstream)) errors.push("Built Expo FileSystem privacy declarations differ from the locked SDK source.");
  const aggregate = manifests.find((item) => item.path === "PrivacyInfo.xcprivacy");
  for (const api of upstream.NSPrivacyAccessedAPITypes ?? []) {
    const declared = aggregate?.fields.NSPrivacyAccessedAPITypes?.find((item) => item.NSPrivacyAccessedAPIType === api.NSPrivacyAccessedAPIType);
    for (const reason of api.NSPrivacyAccessedAPITypeReasons ?? []) {
      if (!declared?.NSPrivacyAccessedAPITypeReasons?.includes(reason)) errors.push(`Aggregate lacks ${api.NSPrivacyAccessedAPIType} reason ${reason}.`);
    }
  }
  return errors;
}

function manifestPaths(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Inspect unexpected native bundle symlink before qualification: ${relative}`);
    if (entry.isDirectory()) return manifestPaths(join(directory, entry.name), relative + "/");
    return entry.isFile() && entry.name === "PrivacyInfo.xcprivacy" ? [relative] : [];
  });
}

function readPlist(path) {
  const result = spawnSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", path], { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Cannot inspect property list: ${path}`);
  return JSON.parse(result.stdout);
}

export function inspectNativePrivacy(app, appRoot, output) {
  const require = createRequire(join(appRoot, "package.json"));
  const expoRequire = createRequire(require.resolve("expo/package.json"));
  const sdkRoot = dirname(expoRequire.resolve("expo-file-system/package.json"));
  const source = join(sdkRoot, "ios/PrivacyInfo.xcprivacy");
  const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const manifests = manifestPaths(app).sort().map((path) => ({ path, sha256: digest(join(app, path)), fields: readPlist(join(app, path)) }));
  const upstream = readPlist(source);
  const info = readPlist(join(app, "Info.plist"));
  const report = {
    kind: "static-native-privacy-inspection", manifests,
    sdk: { package: "expo-file-system", version: JSON.parse(readFileSync(join(sdkRoot, "package.json"), "utf8")).version, sourceSha256: digest(source), fields: upstream },
    purposeStrings: Object.fromEntries(Object.entries(info).filter(([key]) => key.endsWith("UsageDescription"))),
    transportSecurity: info.NSAppTransportSecurity ?? null,
    encryptionDeclaration: info.ITSAppUsesNonExemptEncryption ?? null,
    expoUpdates: readPlist(join(app, "Expo.plist")),
    errors: privacyErrors(manifests, upstream),
    limits: ["Not a measurement of network traffic", "Not a signed-archive or SDK-signature audit", "Not App Store privacy or export-compliance approval"],
  };
  writeFileSync(join(output, "privacy-inspection.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}
