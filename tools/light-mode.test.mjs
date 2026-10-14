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

test("the page: ?light=1 holds the Mists still and skips the roll-in; the toggle beside the bell says so", async (t) => {
  if (!chromium) { t.skip("Playwright is not installed: light mode went UNGUARDED"); return; }
  const { ctx, page, errors } = await open({ query: "?light=1" });
  await page.waitForSelector(".wv-mists-paint img", { state: "attached", timeout: 120_000 });
  await page.waitForTimeout(1500);
  const r = await read(page);
  assert.equal(r.light, true, "html.wv-light");
  assert.deepEqual(r.mistsMotion, [], "nothing on the Mists' stage moves: no drift, no creature, no roll-in");
  assert.ok(r.besideBell, "the toggle sits right after the bell");
  assert.equal(r.pressed, "true"); assert.equal(r.on, true, "lit while light mode is in effect");
  assert.equal(r.label, "light mode: auto, on");
  assert.match(r.title, /set by the link/);
  assert.equal(await page.evaluate(() => document.querySelector(".wv-mists-paint").style.opacity), "", "the paint shows (no roll-in held it back)");
  assert.equal(r.stored, null, "a link is never stored");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the page: the toggle goes auto → on → off → auto, kept on the device, and outranks the link it came by", async (t) => {
  if (!chromium) { t.skip("Playwright is not installed: light mode went UNGUARDED"); return; }
  const { ctx, page, errors } = await open({ query: "?light=1" });
  await page.waitForSelector(".wv-mists-paint img", { state: "attached", timeout: 120_000 });
  const click = async () => { await page.click(".wv-light-toggle"); await page.waitForTimeout(400); return read(page); };
  let r = await click();
  assert.equal(r.stored, "on"); assert.equal(r.light, true); assert.equal(r.label, "light mode: on");
  r = await click();
  assert.equal(r.stored, "off"); assert.equal(r.light, false, "off outranks the ?light=1 the page was opened with");
  assert.ok(r.mistsMotion.length >= 2, `the drift moves again (${r.mistsMotion.join(",")})`);
  r = await click();
  assert.equal(r.stored, null, "back to auto: the choice is forgotten");
  assert.equal(r.light, false, "auto on an able machine (the link is spent once the visitor chose)");
  assert.equal(r.label, "light mode: auto, off");
  await page.click(".wv-light-toggle");   // on, then a reload: the choice is kept
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".wv-light-toggle", { state: "attached", timeout: 180_000 });
  r = await read(page);
  assert.equal(r.light, true, "kept on the device across a reload"); assert.equal(r.label, "light mode: on");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the page: auto turns light mode on for a small machine, and for a slow first bake (kept for the next visit)", async (t) => {
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
  const r = await read(page);
  assert.equal(r.slow, "1", "the verdict is kept on the device");
  assert.match(r.title, /painted slowly here/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
