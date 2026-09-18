// Run from the repository root after building the fixture bundle.
const bundle = new URL("../dist/scorecard.fixture.js", import.meta.url);
Bun.serve({
  hostname: "127.0.0.1", port: 5185,
  fetch(request) {
    if (new URL(request.url).pathname === "/fixture.js") return new Response(Bun.file(bundle));
    return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Keyboard test</title><div id="root"></div><script src="/fixture.js"></script></html>', { headers: { "Content-Type": "text/html" } });
  },
});
