// light-mode.test.mjs — the World page's light mode (WLD-43 part 2, Darko
// 2026-10-13: "yes to the fix for everyone, then light mode").
//
//   node --test tools/light-mode.test.mjs
//
// For a machine the Mists are heavy on: their motion held still as
// prefers-reduced-motion holds it, no roll-in, and the site's bat still, by one
// class on <html> (`wv-light`) that the viewer's CSS and the site's motif read.
// Who decides (viewer.mjs § LIGHT): a link (?light=1 / ?light=0), then the
// visitor's own choice from the toggle beside the bell (auto, on, off, kept on
// the device), then auto: few cores, little memory, or a slow first bake.
//
// The rule is read directly; the page is DRIVEN for everything a reader would
// see. When Playwright is absent the page half SKIPS AND SAYS SO.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIGHT, LIGHT_NEXT, lightModeFor } from "../spectator/viewer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("who decides: a link, then the visitor's choice, then the machine", () => {
  const big = { cores: 16, memory: 8 };
  assert.deepEqual(lightModeFor(big), { on: false, why: "auto" }, "an able machine, nobody asked: off");
  assert.deepEqual(lightModeFor({ ...big, query: "?light=1" }), { on: true, why: "link" });
  assert.deepEqual(lightModeFor({ cores: 2, query: "?a=b&light=0", choice: "on" }), { on: false, why: "link" }, "a link outranks the choice and the machine");
  assert.deepEqual(lightModeFor({ ...big, choice: "on" }), { on: true, why: "chosen" });
  assert.deepEqual(lightModeFor({ cores: 2, memory: 2, slow: true, choice: "off" }), { on: false, why: "chosen" }, "the visitor's own word outranks every auto reason");
  assert.deepEqual(lightModeFor({ ...big, slow: true }), { on: true, why: "slow" }, "a slow first bake, kept from before");
  assert.deepEqual(lightModeFor({ cores: 4, memory: 8 }), { on: true, why: "cores" }, "four cores or fewer");
  assert.deepEqual(lightModeFor({ cores: 5, memory: 8 }), { on: false, why: "auto" });
  assert.deepEqual(lightModeFor({ cores: 8, memory: 4 }), { on: true, why: "memory" }, "4 GB or less (Chromium's deviceMemory)");
  assert.deepEqual(lightModeFor({ cores: 0, memory: 0 }), { on: false, why: "auto" }, "a browser that says nothing is not called small");
  assert.deepEqual(lightModeFor({ ...big, query: "?light=yes" }), { on: false, why: "auto" }, "only 1 and 0 are a link's words");
  assert.deepEqual(LIGHT_NEXT, { auto: "on", on: "off", off: "auto" }, "the toggle goes round");
  assert.equal(LIGHT.bakeMsPerKpx, 3, "the bake's threshold, ms per 1,000 px of its first layer");
});

// ── the page ────────────────────────────────────────────────────────────────
async function loadChromium() { try { return (await import("playwright")).chromium; } catch { return null; } }
const freePort = () => new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.on("error", reject);
  probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});
const CLEANUP = [];
after(() => { for (const stop of CLEANUP.reverse()) { try { stop(); } catch { /* gone */ } } });
async function bootRig() {
  const port = await freePort();
  const proc = spawn(process.execPath, [join(ROOT, "spectator", "server.mjs")], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), ATLAS_ORIGIN: "http://127.0.0.1:1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  CLEANUP.push(() => proc.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the rig did not announce itself in 30s")), 30_000);
    proc.stdout.on("data", (b) => { if (String(b).includes(`localhost:${port}`)) { clearTimeout(timer); resolve(); } });
    proc.on("exit", (c) => { clearTimeout(timer); reject(new Error(`the rig exited ${c} before serving`)); });
  });
  return port;
}
let chromium = null, browser = null, port = null;
before(async () => {
  chromium = await loadChromium();
  if (!chromium) return;
  port = await bootRig();
  browser = await chromium.launch();
  CLEANUP.push(() => browser.close());
});

// crossing 247, five hours in (the Mists on, whatever today's crossing is), and
// the machine the page is told it runs on
async function open({ query = "", cores = 16, memory = 8, throttle = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "no-preference" });
  await ctx.addInitScript(({ cores, memory }) => {
    const RealDate = Date, realNow = RealDate.now.bind(RealDate);
    const off = (Date.UTC(2026, 5, 12) + 247 * 12 * 3600e3 + 5 * 3600e3) - realNow();
    globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(realNow() + off); else super(...a); } static now() { return realNow() + off; } };
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: () => cores, configurable: true });
    Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => memory, configurable: true });
  }, { cores, memory });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  if (throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle }); }
  await page.goto(`http://localhost:${port}/${query}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".wv-telling-pane", { state: "attached", timeout: 90_000 });
  await page.evaluate(() => { const el = document.querySelector(".wv-tour-skip"); if (el && el.offsetParent) el.click(); });
  await page.waitForSelector(".wv-light-toggle", { state: "attached", timeout: 180_000 });
  return { ctx, page, errors };
}
const read = (page) => page.evaluate(() => {
  const btn = document.querySelector(".wv-light-toggle"), bell = document.querySelector(".wv-bell");
  const running = document.getAnimations().filter((a) => a.playState === "running");
  return {
    light: document.documentElement.classList.contains("wv-light"),
    besideBell: !!btn && bell?.nextElementSibling === btn,
    pressed: btn?.getAttribute("aria-pressed"), label: btn?.getAttribute("aria-label"), on: btn?.classList.contains("on"), title: btn?.title,
    mistsMotion: running.filter((a) => a.effect?.target?.closest?.(".wv-mists-stage")).map((a) => a.animationName ?? "waapi"),
    stored: localStorage.getItem("pm_world_light"), slow: localStorage.getItem("pm_world_light_slow"),
  };
});

// what the Mists look like on the page: the wall, the paint, the feather
const mists = (page) => page.evaluate(() => ({
  wall: !!document.querySelector("#wv-mists-layer .wv-mists-wall"),
  paint: !!document.querySelector(".wv-mists-paint"),
  feather: !!document.querySelector(".wv-sheet-feather"),
}));

test("the page: ?light=1 draws the wall alone (no bake, no feather, nothing moving); the toggle beside the bell says so", async (t) => {
  if (!chromium) { t.skip("Playwright is not installed: light mode went UNGUARDED"); return; }
  const { ctx, page, errors } = await open({ query: "?light=1" });
  await page.waitForSelector("#wv-mists-layer .wv-mists-wall", { state: "attached", timeout: 120_000 });
  await page.waitForTimeout(4000);   // longer than this rig's whole bake at full speed
  const r = await read(page), m = await mists(page);
  assert.equal(r.light, true, "html.wv-light");
  assert.deepEqual(m, { wall: true, paint: false, feather: false }, "RULED (Darko 2026-10-13 21:11): the hard-edged wall stands alone, no bake and no feather");
  assert.deepEqual(r.mistsMotion, [], "nothing on the Mists' stage moves");
  assert.ok(r.besideBell, "the toggle sits right after the bell");
  assert.equal(r.pressed, "true"); assert.equal(r.on, true, "lit while light mode is in effect");
  assert.equal(r.label, "light mode: auto, on");
  assert.match(r.title, /set by the link/);
  assert.equal(r.stored, null, "a link is never stored");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the page: the toggle goes auto → on → off → auto, kept on the device, outranks the link, and the paint comes and goes with it", async (t) => {
  if (!chromium) { t.skip("Playwright is not installed: light mode went UNGUARDED"); return; }
  const { ctx, page, errors } = await open({ query: "?light=1" });
  await page.waitForSelector("#wv-mists-layer .wv-mists-wall", { state: "attached", timeout: 120_000 });
  const click = async () => { await page.click(".wv-light-toggle"); await page.waitForTimeout(400); return read(page); };
  let r = await click();
  assert.equal(r.stored, "on"); assert.equal(r.light, true); assert.equal(r.label, "light mode: on");
  r = await click();
  assert.equal(r.stored, "off"); assert.equal(r.light, false, "off outranks the ?light=1 the page was opened with");
  await page.waitForSelector(".wv-mists-paint img", { state: "attached", timeout: 120_000 });
  await page.waitForTimeout(500);
  r = await read(page);
  assert.ok(r.mistsMotion.length >= 2, `out of light mode the Mists are baked and drift again (${r.mistsMotion.join(",")})`);
  assert.equal((await mists(page)).feather, true, "and the sheet's feather is back");
  r = await click();
  assert.equal(r.stored, null, "back to auto: the choice is forgotten");
  assert.equal(r.light, false, "auto on an able machine (the link is spent once the visitor chose)");
  assert.equal(r.label, "light mode: auto, off");
  await page.click(".wv-light-toggle");   // on: the paint goes at once
  await page.waitForTimeout(400);
  assert.deepEqual(await mists(page), { wall: true, paint: false, feather: false }, "turned on, the paint and the feather go");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".wv-light-toggle", { state: "attached", timeout: 180_000 });
  r = await read(page);
  assert.equal(r.light, true, "kept on the device across a reload"); assert.equal(r.label, "light mode: on");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the page: auto turns light mode on for a small machine, and for a slow first bake, which stops (kept for the next visit)", async (t) => {
  if (!chromium) { t.skip("Playwright is not installed: light mode went UNGUARDED"); return; }
  for (const [machine, why] of [[{ cores: 4, memory: 8 }, /few cores/], [{ cores: 16, memory: 4 }, /little memory/]]) {
    const { ctx, page } = await open(machine);
    const r = await read(page);
    assert.equal(r.light, true, `${JSON.stringify(machine)}: light`);
    assert.match(r.title, why);
    await ctx.close();
  }
  // a slow machine: the first layer of the bake, timed under a 6× CPU throttle
  // (at full speed here it reads about 1.3 ms per 1,000 px; the line is 3)
  const { ctx, page, errors } = await open({ throttle: 6 });
  await page.waitForFunction(() => document.documentElement.classList.contains("wv-light"), null, { timeout: 180_000 });
  await page.waitForTimeout(6000);   // what was left of the bake would have finished and painted by now
  const r = await read(page);
  assert.equal(r.slow, "1", "the verdict is kept on the device");
  assert.match(r.title, /painted slowly here/);
  assert.equal((await mists(page)).paint, false, "the bake stopped at its verdict: no paint");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the page on a phone: no seventh circle; the bell opens a menu holding the bell and light mode", async (t) => {
  if (!chromium) { t.skip("Playwright is not installed: light mode went UNGUARDED"); return; }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => {
    const RealDate = Date, realNow = RealDate.now.bind(RealDate);
    const off = (Date.UTC(2026, 5, 12) + 247 * 12 * 3600e3 + 5 * 3600e3) - realNow();
    globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(realNow() + off); else super(...a); } static now() { return realNow() + off; } };
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: () => 16, configurable: true });
    Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 8, configurable: true });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".wv-bell", { state: "visible", timeout: 180_000 });
  // the tour greets a first visit and its scrim takes the taps: skip it once it is up
  await page.waitForSelector(".wv-tour-skip", { state: "visible", timeout: 15_000 }).then(() => page.click(".wv-tour-skip")).catch(() => {});
  await page.waitForSelector(".wv-tour-scrim", { state: "hidden", timeout: 15_000 }).catch(() => {});
  assert.equal(await page.isVisible(".wv-light-toggle"), false, "the light toggle's circle stands down on a phone");
  const bellBefore = await page.evaluate(() => localStorage.getItem("pm_world_bell"));
  await page.click(".wv-bell");
  await page.waitForSelector(".wv-bell-menu", { state: "visible" });
  const rows = () => page.evaluate(() => [...document.querySelectorAll(".wv-bell-menu-row")].map((b) => b.textContent));
  assert.deepEqual(await rows(), ["🔔 the bell: on", "🍃 light mode: auto (off)"], "two rows: the bell and light mode");
  assert.equal(await page.evaluate(() => localStorage.getItem("pm_world_bell")), bellBefore, "opening the menu is not ringing the change");
  await page.click('.wv-bell-menu-row[data-act="light"]');
  assert.deepEqual((await rows())[1], "🍃 light mode: on", "the light row goes round as the desktop toggle does");
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("wv-light")), true);
  await page.click('.wv-bell-menu-row[data-act="bell"]');
  assert.deepEqual((await rows())[0], "🔕 the bell: off", "and the bell row is the bell's own act");
  await page.keyboard.press("Escape");
  assert.equal(await page.isVisible(".wv-bell-menu"), false, "Escape closes it");
  assert.deepEqual(errors, []);
  await ctx.close();
});
