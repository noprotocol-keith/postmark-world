// part2-on-the-page.test.mjs — LOGOS v2 part 2 on the World page (POS-678),
// driven in a browser against a stub office that answers in the office's own
// shapes (office train/2026-w43 @ dd226dbd; see tools/holdings-page.test.mjs
// for where each shape comes from).
//
// The overnight A/B walk (docs/2026-10-18/w43-ship/SPIRE-AB-QA.md § Bags and
// bowls on the page) found the page showing none of part 2. These are its
// findings, each read off the rendered page:
//
//   1. a holder's column says what it holds, by kind, with its room and
//      whether it is open; a resident's column says what is in their hands
//   2. a bag in your own hands is drawn with you, and its column says "in
//      your hands", never "11 m southeast of you"
//   4. a Halloween bowl reads as a thing, never "A place"
//   5. the say card says the office's numbers: 60 m, drawn 15 minutes, heard
//      until the next settlement (the page said "fades from hearing in five
//      minutes")
//
// ── THE CAN-FAIL FLIPS ─────────────────────────────────────────────────────
//   drop `...holdingFacts(holding)` from markColumnView      → 1 reds
//   drop the carried relocation in overlayMarks              → 2 reds (the pips part)
//   radialWhere without the carried line                     → 2 reds (the column says "11 m · southeast of you")
//   markWhat without thingClasses                            → 4 reds
//   sayNote() back to the old sentence                       → 5 reds
//
// The browser is CI's (suite.yml installs playwright); the box skips by name.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createServer as createHttp } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { townRegionMarks } from "../spectator/viewer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVED = JSON.parse(readFileSync(join(ROOT, "WORLD/world-state.json"), "utf8"));

const PLAYWRIGHT_PATHS = ["playwright"];
async function loadChromium() {
  for (const spec of PLAYWRIGHT_PATHS) {
    try { return (await import(spec)).chromium; } catch { /* try the next */ }
  }
  return null;
}
const freePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.on("error", reject);
  probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});
const CLEANUP = [];
after(() => { for (const stop of CLEANUP.reverse()) { try { stop(); } catch { /* already gone */ } } });

// the rig's own household, so no mark of the town's shares an id
const ACTOR = "rig-ash";
const HERE = { x: 221, y: 95.5 };   // in the Town Centre, where the record's own rings are
const BOWL = "rig-ash/a-halloween-bowl";
const BAG = "rig-ash/a-cloth-bag-one";
const RECORDS = {
  [BOWL]: { id: BOWL, by: ACTOR, household: ACTOR, kind: "halloween-candy-bowl", tier: "market", at: { ...HERE }, extent: { w: 1, h: 1 },
    body: "A second pumpkin bowl." },
  // its canon place, ~11 m southeast of where the actor stands: where the page used to draw it
  [BAG]: { id: BAG, by: ACTOR, household: ACTOR, kind: "thing", holder: true, capacity: 3, tier: "market", at: { x: 229, y: 103.5 }, extent: { w: 1, h: 1 },
    body: "A cloth bag." },
};
const READ = {
  handle: ACTOR,
  standpoint: { x: HERE.x, y: HERE.y, name: "the rig's yard", stance: "embodied", handle: ACTOR },
  within: [],
  nearby: [
    { id: BOWL, at: { ...HERE }, bearing: "N", distance_m: 0, kind: "halloween-candy-bowl", tier: "market" },
    { id: BAG, at: { x: 229, y: 103.5 }, bearing: "SE", distance_m: 11, kind: "thing", tier: "market" },
  ],
  // the ground set, as a real read carries it: townGround refuses a set with no region rings
  records: { ...Object.fromEntries(townRegionMarks(SERVED.marks).map((m) => [m.id, m])), ...RECORDS },
  present: { radius_m: 120, residents: [] },
  actions: [{ action: "say", blurb: "Speak where you stand.", from: "the-town/resident", class: "resident", grant: "yours",
    fields: { text: "string" }, dispatches_to: "world_say" }],
  telling: "The rig's yard is quiet.",
};
// world-kinds.mjs § investigateMark, merged into the apex focus
const FOCUS = {
  [BOWL]: { id: BOWL, body: "A second pumpkin bowl.", holder: { capacity: 30, open: true },
    holds: { holder: BOWL, count: 5, class: "thing", shows: "5 things", kinds: [{ kind: "candy", count: 4, shows: "4 candies" }] },
    can: ["take", "give", "refill"], class_pointer: 'kind: halloween-candy-bowl · a thing · a sited — explain: "halloween-candy-bowl"' },
  [BAG]: { id: BAG, body: "A cloth bag.", holder: { capacity: 3, open: true },
    holds: { holder: BAG, count: 2, class: "candy", shows: "2 candies", kinds: [{ kind: "candy", count: 2, shows: "2 candies" }] },
    can: [], class_pointer: 'kind: thing · a sited · a mark — explain: "thing"' },
};
// world-hold.mjs § world_holdings, and the ground within reach (groundRow)
const TAKE = {
  read: "take",
  holdings: { handle: ACTOR, count: 1, shown: 1, limit: 20, offset: 0, complete: true,
    holding: [{ thing: BAG, made_by: ACTOR }],
    kinds: { holder: ACTOR, count: 3, class: "candy", shows: "3 candies", kinds: [{ kind: "candy", count: 3, shows: "3 candies" }] } },
  ground: { at: { ...HERE }, reach_m: 60, count: 1, things: [
    { thing: BAG, made_by: ACTOR, stands_at: { ...HERE }, place_from: "holder", distance_m: 0, holder: ACTOR, takeable: false },
  ] },
};
// world-apex.mjs § investigateOn
const INVESTIGATED = { handle: ACTOR, holds: [BAG],
  holds_by_kind: { holder: ACTOR, count: 3, class: "candy", shows: "3 candies", kinds: [{ kind: "candy", count: 3, shows: "3 candies" }] } };
// voices.mjs § conversations
const CONVERSATIONS = { now: "2026-10-18T03:00:00.000Z", earshot_m: 60, fade_minutes: 15, hearable_since: "2026-10-17T22:00:00.000Z",
  close_minutes: 30, live: [], closed: [] };

async function bootStubOffice() {
  const port = await freePort();
  const asked = [];
  const srv = createHttp((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:" + port);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    asked.push(url.pathname + url.search);
    const send = (b) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(b)); };
    const q = url.searchParams;
    if (url.pathname === "/ops/whoami") return send({ principal: false, household: "rig-house", handles: [ACTOR] });
    if (url.pathname === "/world/apex") {
      if (q.get("mark")) return send({ ...READ, focus: FOCUS[q.get("mark")] ?? { error: "bounce", defect: "no such mark" } });
      if (q.get("investigate")) return send({ ...READ, investigated: q.get("investigate") === ACTOR ? INVESTIGATED : { error: "bounce" } });
      if (q.get("read") === "take") return send(TAKE);
      if (q.get("read") === "walk") return send({ read: "walk", walkers: { walkers: [] } });
      return send(READ);
    }
    if (url.pathname === "/world/present") return send({ at: 1000, residents: [{ handle: ACTOR, at: { ...HERE }, source: "walk" }] });
    if (url.pathname === "/world/walkers") return send({ at: 1000, walkers: [], standing: [{ handle: ACTOR, x: HERE.x, y: HERE.y }] });
    if (url.pathname === "/world/conversations") return send(CONVERSATIONS);
    // the resident's portfolio: nothing of theirs is published, so the read is the page's index
    if (url.pathname === "/world/my-marks") return send({ handle: ACTOR, drafts: [], docket: [], published: [], backed: [], complete: true, counts: { drafts: 0, docket: 0, published: 0, backed: 0 } });
    if (url.pathname === `/stamps/${ACTOR}`) return send({ handle: ACTOR, balance: 5 });
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "bounce", defect: "no such door in the rig" }));
  });
  await new Promise((resolve) => srv.listen(port, "127.0.0.1", resolve));
  CLEANUP.push(() => srv.close());
  return { port, asked };
}

async function bootRig() {
  const port = await freePort();
  const proc = spawn(process.execPath, [join(ROOT, "spectator", "server.mjs")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ATLAS_ORIGIN: "http://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  CLEANUP.push(() => proc.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the rig did not announce itself in 30s")), 30_000);
    proc.stdout.on("data", (b) => { if (String(b).includes("localhost:" + port)) { clearTimeout(timer); resolve(); } });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error("the rig exited " + code + " before serving")); });
  });
  return { port };
}

let chromium = null, rig = null, browser = null, office = null, page = null;
const errors = [];
before(async () => {
  chromium = await loadChromium();
  if (!chromium) return;
  [rig, office] = await Promise.all([bootRig(), bootStubOffice()]);
  browser = await chromium.launch();
  CLEANUP.push(() => browser.close());
  page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  await page.addInitScript((base) => { try { localStorage.setItem("pm.office.base", base); } catch {} }, "http://127.0.0.1:" + office.port);
  await page.addInitScript(() => { try { localStorage.setItem("pm_key", "rig-key-not-a-secret"); } catch {} });
  await page.addInitScript((h) => { try { localStorage.setItem("pm.world.act_as", h); } catch {} }, ACTOR);
  await page.goto("http://localhost:" + rig.port + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".wv-telling-pane", { state: "attached", timeout: 90_000 });
  await page.evaluate(() => { const el = document.querySelector(".wv-tour-skip"); if (el && el.offsetParent) el.click(); });
  // the resident's read, then their hands (read: "take") — both asked of the office
  await page.waitForFunction(() => !!window.__pmViewer, null, { timeout: 60_000 });
  const until = Date.now() + 60_000;
  while (Date.now() < until && !office.asked.some((p) => p.includes("read=take"))) await new Promise((r) => setTimeout(r, 250));
  await page.waitForFunction((bag) => !!document.querySelector(`circle.ov-pip[data-id="${bag}"]`), BAG, { timeout: 60_000 })
    .catch(async (e) => {
      const pips = await page.evaluate(() => [...document.querySelectorAll("circle.ov-pip[data-id]")].map((c) => c.getAttribute("data-id")).slice(0, 20));
      throw new Error(`the bag was never drawn: pips ${JSON.stringify(pips)}; asked ${JSON.stringify(office.asked.slice(0, 40))}; errors ${JSON.stringify(errors)}; ${e.message}`);
    });
  await page.waitForTimeout(1500);
});

const skipReason = "playwright is absent, so part 2 on the page goes unguarded: run npm ci here (playwright is this package's devDependency)";

/** select an id as a click would, and read the column it opens */
async function columnFor(id, { until = null } = {}) {
  await page.evaluate((x) => window.__pmViewer.select(x), id);
  await page.waitForFunction(({ want }) => {
    const col = document.querySelector(".wv-homecol");
    return !!col && !col.hidden && (!want || col.textContent.includes(want));
  }, { want: until }, { timeout: 20_000 }).catch(() => {});
  return page.evaluate(() => {
    const col = document.querySelector(".wv-homecol");
    const facts = {};
    const dts = [...(col?.querySelectorAll(".wv-homecol-facts dt") ?? [])];
    for (const dt of dts) facts[dt.textContent.trim()] = dt.nextElementSibling?.textContent.replace(/\s+/g, " ").trim() ?? "";
    return {
      open: !!col && !col.hidden,
      title: col?.querySelector(".wv-homecol-title")?.textContent.trim() ?? "",
      meta: col?.querySelector(".wv-homecol-meta")?.textContent.trim() ?? "",
      icons: [...(col?.querySelectorAll(".wv-homecol-icon .wv-ic") ?? [])].map((e) => [...e.classList].find((c) => c.startsWith("ic-"))),
      meanings: [...(col?.querySelectorAll(".wv-homecol-icon-meaning") ?? [])].map((e) => e.textContent.trim()),
      facts,
      relations: [...(col?.querySelectorAll(".wv-homecol-rel") ?? [])].map((g) => ({
        label: g.querySelector(".wv-homecol-rel-label")?.textContent.trim(),
        items: [...g.querySelectorAll(".wv-homecol-go")].map((b) => b.getAttribute("data-homecol-go")),
      })),
    };
  });
}

const pipAt = (id) => page.evaluate((x) => {
  const c = document.querySelector(`circle.ov-pip[data-id="${x}"]`);
  const g = c?.parentElement?.parentElement;
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(g?.getAttribute("transform") ?? "");
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}, id);

test("1. a holder's column says what it holds, by kind, its room and that it is open", async (t) => {
  if (!chromium) return t.skip(skipReason);
  const col = await columnFor(BOWL, { until: "5 of 30" });
  assert.ok(col.open, "the bowl's column opened");
  assert.equal(col.facts.holds, "5 things · 5 of 30", "the office's blur and its room: " + JSON.stringify(col.facts));
  assert.equal(col.facts["by kind"], "4 candies, 1 whole thing");
  assert.equal(col.facts.open, "open: other households may give into it and take from it");
  assert.ok(office.asked.some((p) => p.startsWith(`/world/apex?mark=${encodeURIComponent(BOWL)}`) && p.includes(`handle=${ACTOR}`)),
    "asked as the resident, through the close look: " + JSON.stringify(office.asked.filter((p) => p.includes("mark="))));
});

test("1b. a resident's column says what is in their hands", async (t) => {
  if (!chromium) return t.skip(skipReason);
  const col = await columnFor(`walker:${ACTOR}`, { until: "3 candies" });
  assert.ok(col.open, "the resident's column opened");
  assert.equal(col.facts.holds, "4 things", JSON.stringify(col.facts));
  assert.equal(col.facts["by kind"], "3 candies");
  const carrying = col.relations.find((r) => r.label === "carrying");
  assert.deepEqual(carrying?.items, [BAG], "their whole things, each a way into its column");
});

test("2. a bag in your hands is drawn with you, and its column says so", async (t) => {
  if (!chromium) return t.skip(skipReason);
  const bowl = await pipAt(BOWL), bag = await pipAt(BAG);
  assert.ok(bowl && bag, "both pips drawn");
  assert.ok(Math.hypot(bag.x - bowl.x, bag.y - bowl.y) < 0.01,
    `the bag rides you, at your body (where the bowl you stand on is): bag ${JSON.stringify(bag)}, bowl ${JSON.stringify(bowl)}`);
  const col = await columnFor(BAG, { until: "in your hands" });
  assert.equal(col.meta, "in your hands", "never its old place: " + JSON.stringify(col.meta));
  assert.equal(col.facts.holds, "2 candies · 2 of 3");
  const heldBy = col.relations.find((r) => r.label === "held by");
  assert.deepEqual(heldBy?.items, [`walker:${ACTOR}`]);
});

test("4. a Halloween bowl reads as a thing, never a place", async (t) => {
  if (!chromium) return t.skip(skipReason);
  const col = await columnFor(BOWL, { until: "5 of 30" });
  assert.ok(col.icons.includes("ic-thing"), "the thing icon: " + JSON.stringify(col.icons));
  assert.ok(!col.icons.includes("ic-place"), "not a place");
  assert.ok(!col.meanings.some((m) => /^A place/.test(m)), JSON.stringify(col.meanings));
});

test("5. the say card says the office's numbers", async (t) => {
  if (!chromium) return t.skip(skipReason);
  await page.evaluate(() => window.__pmViewer.select(null));
  await page.waitForSelector('[data-action-verb="say"]', { timeout: 30_000 });
  await page.click('[data-action-verb="say"]');
  await page.waitForFunction(() => /15 minutes/.test(document.querySelector(".wv-say-note")?.textContent ?? ""), null, { timeout: 20_000 }).catch(() => {});
  const note = await page.evaluate(() => document.querySelector(".wv-say-note")?.textContent ?? "");
  assert.equal(note, "a voice carries 60 metres and stays drawn on the map for 15 minutes. everyone in earshot can hear it until the next settlement, nobody else does, and the town keeps its conversations browsable.");
  assert.doesNotMatch(note, /five minutes/);
});

test("the page threw nothing", async (t) => {
  if (!chromium) return t.skip(skipReason);
  assert.deepEqual(errors, [], errors.join(" | "));
});
