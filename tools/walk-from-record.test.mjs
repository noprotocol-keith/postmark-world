// walk-from-record.test.mjs — play row 69, RULED (Darko 2026-10-16 19:03–19:04):
// "polling for your location is dumb when you literally declare the exact
// trajectory of your walk … we can keep the 15 second for like finding new
// walks and stuff, but … for your own walks, it should just be literally the
// like from what you declared." A body on a walk the page holds the record of
// is drawn where the world's own positionAt puts it, every frame while it
// moves; the reader's own walk from the moment its act answers; a stop the
// poll reports is an event.
// Run: node --test tools/walk-from-record.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { liveWalkerAt, onRecordedWalk } from "../spectator/viewer.mjs";
import { positionAt, fractionalCrossing } from "./walk.mjs";

const SOURCE = readFileSync(new URL("../spectator/viewer.mjs", import.meta.url), "utf8");
// a 20 m walk inside the Spire at 60 km a crossing (5 km/h): about 14 s
const t0 = Date.parse("2026-10-16T23:10:00Z");
const at0 = fractionalCrossing(t0);
const record = { handle: "visitor", from: { x: 3817.5, y: -5529.5 }, toward: { x: 3817.5, y: -5549.5 }, at: at0, pace: 60, targetExtent: null };
const sec = (n) => fractionalCrossing(t0 + n * 1000);
const before = { handle: "visitor", x: 3817.5, y: -5529.5, moving: false, toward: null };   // the last poll, before the walk

test("your own walk is drawn from what it declared, the moment it answers, at positionAt's place", () => {
  for (const n of [0, 1, 3.5, 7, 10]) {
    const w = liveWalkerAt(before, { record, declaredMs: t0, polledMs: t0 - 5000, nowCrossing: sec(n) });
    const p = positionAt(record, sec(n));
    assert.deepEqual([w.x, w.y], [p.x, p.y], `at ${n} s`);
    assert.equal(w.moving, !p.arrived);
  }
  // it moves continuously: no 15 s jump, every second a little further
  const ys = [0, 1, 2, 3, 4, 5].map((n) => liveWalkerAt(before, { record, declaredMs: t0, polledMs: t0 - 5000, nowCrossing: sec(n) }).y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] < ys[i - 1] && ys[i - 1] - ys[i] < 2, "about 1.4 m a second, never a jump");
  const done = liveWalkerAt(before, { record, declaredMs: t0, polledMs: t0 - 5000, nowCrossing: sec(30) });
  assert.equal(done.moving, false);
  assert.ok(Math.abs(done.y - record.toward.y) < 1e-9, "and it arrives where the record says");
});

test("everyone else between polls: the record the poll's walk is on, at positionAt's place", () => {
  const polled = { handle: "visitor", ...positionAt(record, sec(4)), moving: true, toward: record.toward };
  const w = liveWalkerAt(polled, { record, declaredMs: t0, polledMs: t0 + 4000, nowCrossing: sec(9) });
  assert.deepEqual([w.x, w.y], [positionAt(record, sec(9)).x, positionAt(record, sec(9)).y]);
  // a row with no toward (the earshot read's) is on this walk when the record put it where the poll saw it
  const bare = { handle: "visitor", x: polled.x, y: polled.y, moving: true };
  assert.ok(onRecordedWalk(bare, record, sec(4)));
  assert.ok(!onRecordedWalk({ ...bare, y: polled.y + 40 }, record, sec(4)), "40 m off is another walk");
});

test("a stop the poll reports is an event: the poll's place wins; an unknown walk stays where the poll saw it", () => {
  const stopped = { handle: "visitor", x: 3817.5, y: -5535, moving: false, toward: null };   // entered a door mid-walk
  assert.deepEqual(liveWalkerAt(stopped, { record, declaredMs: t0, polledMs: t0 + 6000, nowCrossing: sec(9) }), stopped);
  const other = { handle: "visitor", x: 3900, y: -5400, moving: true, toward: { x: 4000, y: -5400 } };
  assert.deepEqual(liveWalkerAt(other, { record, declaredMs: t0, polledMs: t0 + 6000, nowCrossing: sec(9) }), other);
  assert.equal(liveWalkerAt(other, {}), other, "no record, the poll's word");
});

test("pins: drawn from the record each frame while something moves, never in a hidden tab, never re-implemented", () => {
  assert.match(SOURCE, /import \{[^}]*\bpositionAt\b[^}]*\} from "\.\.\/tools\/walk\.mjs";/);
  assert.match(SOURCE, /const inView = sceneWalkerSet\(\{ walkers: \(walkState\.walkers \?\? \[\]\)\.map\(liveBody\),/);
  assert.match(SOURCE, /function animateWalks\(\) \{\s*if \(walkFrame \|\| \(typeof document !== "undefined" && document\.hidden\)\) return;/);
  assert.match(SOURCE, /if \(!moving\(\)\.length\) return;/, "nothing runs while all are still");
  assert.match(SOURCE, /walkFrame = requestAnimationFrame\(tick\);/);
  // your own walk: the record from the act's answer, drawn before the poll is even asked
  assert.match(SOURCE, /ownWalkDeclared\(handle, response\.body\);\s*await pollWalkers\(\);/);
  assert.match(SOURCE, /ownWalkDeclared\(state\.handle, answer\);/);
  // a landing is an event drawn in that frame
  assert.match(SOURCE, /if \(answer\.landed\) ownStopAt\(state\.handle, answer\.landed\);/);
  // the walk records come from the walk ledger the page already reads, and a new walk asks once
  assert.match(SOURCE, /recordsFromDepartures\(departures\);/);
  assert.match(SOURCE, /\/world2\/walks\?since=/);
});

// ── fix 69's reload (Darko 19:18): "Reloading during a walk breaks everything
// until you could reach your destination." ──────────────────────────────────
test("a page loaded mid-walk draws your own walker at positionAt(record, now) from its first render", () => {
  // the page loaded 7 s into the walk: the first rows are the read's, which still say "standing at the start"
  const stale = { handle: "visitor", x: record.from.x, y: record.from.y, moving: false, toward: null };
  for (const n of [7, 8, 10]) {
    const w = liveWalkerAt(stale, { record, declaredMs: t0, polledMs: t0 + 7000, nowCrossing: sec(n), own: true });
    const p = positionAt(record, sec(n));
    assert.deepEqual([w.x, w.y], [p.x, p.y], `at ${n} s, not frozen at the start`);
    assert.equal(w.moving, true);
  }
  // at rest, the poll is the truth again; a crossing after the walk began stops it
  assert.deepEqual(liveWalkerAt(stale, { record, declaredMs: t0, polledMs: t0 + 40000, nowCrossing: sec(40), own: true }), stale);
  const entered = { handle: "visitor", x: 3817.5, y: -5536, moving: false };
  assert.deepEqual(liveWalkerAt(entered, { record, declaredMs: t0, polledMs: t0 + 9000, nowCrossing: sec(9), own: true, crossedMs: t0 + 5000 }), entered);
});

test("pins: the one hour-floored walks read, asked first and awaited by the first poll; never a millisecond since", () => {
  assert.match(SOURCE, /const walkWindowSince = \(\) => new Date\(Math\.floor\(\(Date\.now\(\) - walkWindowDays \* 86_400_000\) \/ 3_600_000\) \* 3_600_000\)\.toISOString\(\);/);
  assert.match(SOURCE, /const walkLedgerOnce = \(\) => \(walkLedgerFirst \?\?= loadWalkLedger\(\)\);/);
  assert.match(SOURCE, /\(async \(\) => \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*walkLedgerOnce\(\);/, "asked as the page boots");
  assert.match(SOURCE, /Promise\.resolve\(walkLedgerOnce\(\)\)\.catch\(\(\) => \{\}\)\s*\.then\(\(\) => pollWalkers\(\)\)/, "the first poll waits for it");
  assert.match(SOURCE, /Promise\.allSettled\(\[walkLedgerOnce\(\), settlements, loadStakeEvents\(\)\]\)/, "Lately shares it");
  const ask = SOURCE.slice(SOURCE.indexOf("function askNewWalkRecords(rows) {"), SOURCE.indexOf("let walkFrame = 0"));
  assert.match(ask, /loadWalkLedger\(\)/);
  assert.doesNotMatch(ask, /fetch\(|toISOString/, "no read of its own, no millisecond since");
  assert.doesNotMatch(SOURCE, /\/world2\/walks\?since=\$\{encodeURIComponent\(since\)\}`\), \{ credentials/, "the old per-walk read is gone");
});

test("arriving lands where the record says, even while the last poll still saw it walking", () => {
  const midway = { handle: "visitor", ...positionAt(record, sec(6)), moving: true };   // polled at 6 s, the walk ends at ~14 s
  const w = liveWalkerAt(midway, { record, declaredMs: t0, polledMs: t0 + 6000, nowCrossing: sec(20), own: true });
  assert.equal(w.moving, false);
  assert.ok(Math.abs(w.y - record.toward.y) < 1e-9, "at the walk's end, not snapped back to the poll's mid-walk point");
});
