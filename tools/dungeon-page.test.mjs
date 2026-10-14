// dungeon-page.test.mjs — the World page hides what a dungeon holds (WLD-5, G11).
//
// Darko, 2026-10-13 20:31: the opacity covers the public World map this week,
// and the rule is written ONCE in the world tools ("what this standpoint sees
// inside a dungeon, by the enter ledger", portals.mjs § standpointSight). The
// office's reads and this page both call it; the page keeps no copy.
//
// So this file asks the PAGE, not the function: the function's own behaviour is
// tools/portals.test.mjs's. It serves the real record twice, once as it stands
// and once with a dungeon drawn around a mark the Spectator's opening view
// draws, and asserts the mark is gone from the map the second time, while the
// map still draws. Taking `sightOf` out of applyWorldLayer reds it.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVED = JSON.parse(readFileSync(join(ROOT, "WORLD/world-state.json"), "utf8"));
const SOURCE = readFileSync(join(ROOT, "spectator/viewer.mjs"), "utf8");

// Playwright is a devDependency (POS-372): CI installs it, the box does not, and
// a skip says what goes unguarded.
async function loadChromium() {
  try { return (await import("playwright")).chromium; } catch { return null; }
}
const freePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.on("error", reject);
  probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});
const CLEANUP = [];
after(() => { for (const stop of CLEANUP.reverse()) { try { stop(); } catch { /* already gone */ } } });
async function bootRig() {
  const port = await freePort();
  const proc = spawn(process.execPath, [join(ROOT, "spectator", "server.mjs")], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), ATLAS_ORIGIN: "http://127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  CLEANUP.push(() => proc.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the rig did not announce itself in 30s")), 30_000);
    proc.stdout.on("data", (b) => { if (String(b).includes(`localhost:${port}`)) { clearTimeout(timer); resolve(); } });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`the rig exited ${code} before serving`)); });
  });
  return { port };
}
let chromium = null, rig = null, browser = null;
before(async () => {
  chromium = await loadChromium();
  if (!chromium) return;
  rig = await bootRig();
  browser = await chromium.launch();
  CLEANUP.push(() => browser.close());
});

/** The ids the Spectator's map draws once it has stopped redrawing. `worldState`
 *  replaces the served record when given. */
async function drawnIds(worldState = null) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  if (worldState)
    await page.route("**/world-state.json*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(worldState) }));
  await page.goto(`http://localhost:${rig.port}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".wv-telling-pane", { state: "attached", timeout: 90_000 });
  await page.waitForFunction(() => document.querySelectorAll("#wv-overlay [data-id]").length > 0, null, { timeout: 60_000 }).catch(() => {});
  // settle on the drawing itself, never on a duration
  let last = "", held = 0;
  for (let waited = 0; held < 900 && waited < 45_000; waited += 150) {
    await page.waitForTimeout(150);
    const now = await page.evaluate(() => [...document.querySelectorAll("#wv-overlay [data-id]")].map((e) => e.dataset.id).sort().join("|"));
    held = now === last ? held + 150 : 0;
    last = now;
  }
  const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll("#wv-overlay [data-id]")].map((e) => e.dataset.id))]);
  await page.close();
  return ids;
}

test("[pin] the page asks the world tools' one function, and keeps no dungeon rule of its own", () => {
  assert.match(SOURCE, /import \{[^}]*\bstandpointSight\b[^}]*\} from "\.\.\/tools\/world-verbs\.mjs"/);
  assert.match(SOURCE, /world = sightOf\(assembleWorld\(/, "the assembled world is scoped before anything draws from it");
  assert.match(SOURCE, /townWorld = sightOf\(\{/, "the town's copy of the record is scoped too");
  assert.doesNotMatch(SOURCE, /["']dungeon["']/, "no second implementation: the class name appears nowhere in the page");
});

test("THE MAP HIDES WHAT A DUNGEON HOLDS — a mark the Spectator draws vanishes once a dungeon stands around it", async (t) => {
  if (!chromium) return t.skip("playwright is absent: whether the World page hides a dungeon's contents is unguarded on this machine (the [pin] above still holds the wiring as text)");
  const before = await drawnIds();
  const byId = new Map(SERVED.marks.map((m) => [m.id, m]));
  const target = before.map((id) => byId.get(id))
    .find((m) => m && m.kind === "sited" && m.at && m.extent && !m.class && Math.max(m.extent.w, m.extent.h) < 200);
  assert.ok(target, `the opening view draws at least one small classless sited mark to wrap (drew ${before.length})`);

  const dungeon = {
    id: "wld5-test/the-walled-grounds", kind: "sited", by: "wld5-test", household: "wld5-test", class: "dungeon",
    at: { x: target.at.x, y: target.at.y }, extent: { w: target.extent.w + 40, h: target.extent.h + 40 },
    body: "A walled ground, for the test.", stamps: 0, weight: 0,
  };
  const after = await drawnIds({ ...SERVED, marks: [...SERVED.marks, dungeon] });
  assert.ok(after.length > 0, "the map still draws");
  assert.ok(!after.includes(target.id), `${target.id} stands inside a dungeon the Spectator has not entered, and the map does not draw it`);
});
