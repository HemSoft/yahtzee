import { convexTest } from "convex-test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { instrument } from "../../scripts/quality/instrument";
import { isProductionSource, productionLoadFilter } from "../../scripts/quality/sources";

const require = createRequire(import.meta.url);
function backend() {
  return convexTest(schema, {
    "../../convex/_generated/server.ts": () => import("../../convex/_generated/server"),
    "../../convex/gameSessions.ts": () => import("../../convex/gameSessions"),
    "../../convex/games.ts": () => import("../../convex/games"),
    "../../convex/gameLogs.ts": () => import("../../convex/gameLogs"),
    "../../convex/highScores.ts": () => import("../../convex/highScores"),
  });
}
let seed = 73;
const fixtureMath = Object.create(Math) as Math;
fixtureMath.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
globalThis.Math = fixtureMath;
let database = backend(); let loseResponse = false; let delay = 0;
const outputs = new Map<string, Blob>();
for (const client of ["web", "desktop", "mobile"]) {
  const result = await Bun.build({
    entrypoints: [resolve(`tests/clients/${client}.tsx`)], target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify("test"), __DEV__: "true" },
    plugins: [{ name: "isolated-client-backend", setup(build) {
      if (process.env.TEST_COVERAGE === "1") build.onLoad({ filter: productionLoadFilter }, async ({ path }) => {
        const source = await Bun.file(path).text();
        return { contents: isProductionSource(path) ? instrument(source, path).code : source,
          loader: path.endsWith(".tsx") ? "tsx" : path.endsWith(".jsx") ? "jsx" : /\.[cm]?ts$/.test(path) ? "ts" : "js" };
      });
      build.onResolve({ filter: /^convex\/react$/ }, () => ({ path: resolve("tests/clients/backend-client.tsx") }));
      build.onResolve({ filter: /^react-native$/ }, () => ({ path: require.resolve("react-native-web") }));
      build.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: resolve("tests/clients/native-storage.ts") }));
    } }],
  });
  if (!result.success) throw new Error(result.logs.join("\n"));
  outputs.set(`/${client}.js`, result.outputs[0]);
}
const html = await Bun.file("apps/web/index.html").text();
Bun.serve({
  hostname: "127.0.0.1", port: Number(process.env.TEST_PORT ?? 5187),
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/health") return Response.json({ ready: true });
    if (path === "/coverage" && process.env.TEST_COVERAGE === "1") {
      return Response.json((globalThis as typeof globalThis & { __coverage__?: unknown }).__coverage__ ?? {});
    }
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    if (outputs.has(path)) return new Response(outputs.get(path), { headers: { "content-type": "text/javascript" } });
    if (["/web", "/desktop", "/mobile"].includes(path)) {
      return new Response(html.replace('/src/main.tsx', `${path}.js`), { headers: { "content-type": "text/html" } });
    }
    if (path === "/control" && request.method === "POST") {
      const control = await request.json() as { reset?: boolean; loseResponse?: boolean; delay?: number };
      if (control.reset) { database = backend(); seed = 73; loseResponse = false; delay = 0; }
      if (control.loseResponse) loseResponse = true;
      if (control.delay) delay = control.delay;
      return Response.json({ ok: true });
    }
    if (path === "/inspect") {
      return Response.json(await database.run(async (ctx) => ({
        logs: await ctx.db.query("gameLogs").take(100), scores: await ctx.db.query("highScores").take(100),
        receiptCount: (await ctx.db.query("highScoreReceipts").take(100)).length,
      })));
    }
    if (path === "/rpc" && request.method === "POST") {
      const { kind, name, args } = await request.json() as { kind: string; name: string; args: unknown };
      try {
        let result: unknown;
        if (kind === "query" && name === "gameLogs:list") result = await database.query(api.gameLogs.list, args as never);
        else if (kind === "query" && name === "highScores:top") result = await database.query(api.highScores.top, args as never);
        else if (kind === "action" && name === "gameSessions:start") result = await database.action(api.gameSessions.start, args as never);
        else if (kind === "mutation" && name === "games:move") {
          if (process.env.TEST_REJECT_COMPLETION === "1") {
            const input = args as FunctionArgs<typeof api.games.move>;
            const state = await database.query(api.games.read, { gameId: input.gameId, secret: input.secret });
            if (input.move.kind === "score" && Object.keys(state.game.players[0].scores).length === state.game.totalRounds - 1) {
              return Response.json({ error: "Injected persistent completion rejection" }, { status: 503 });
            }
          }
          const milliseconds = delay; delay = 0;
          if (milliseconds) await Bun.sleep(milliseconds);
          result = await database.mutation(api.games.move, args as never);
          if (loseResponse) { loseResponse = false; return Response.json({ error: "Injected loss after commit" }, { status: 503 }); }
        } else return new Response("Unknown fixture API", { status: 404 });
        return Response.json(result);
      } catch {
        return Response.json({ error: "Backend rejected fixture request" }, { status: 400 });
      }
    }
    return new Response("Not found", { status: 404 });
  },
});
console.log("Isolated client/backend fixture ready on loopback; no deployment connection.");
