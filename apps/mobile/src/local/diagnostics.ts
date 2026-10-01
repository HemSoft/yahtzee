interface DiagnosticFields {
  version: string;
  build: string;
  platform: string;
  osVersion: string;
  windowClass: "compact" | "expanded";
}

/** Explicit fields only. Never stringify a store snapshot or an error/log object here. */
export function diagnosticText(fields: DiagnosticFields): string {
  return `Dice game ${fields.version}, build ${fields.build}\nPlatform: ${fields.platform} ${fields.osVersion}\nWindow: ${fields.windowClass}\nStorage schema: 1; scoring rules: 2\nNo names, scores, game IDs or saved data are included.`;
}
