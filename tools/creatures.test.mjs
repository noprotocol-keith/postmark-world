// creatures.test.mjs — the hidden schedule, its seed and the fold (WLD-56).
//
// Read against the real world: WORLD/skeleton.json's Mists and WORLD/world-state.json's
// marks, so "in the band" and "off the town's ground" are asked of the town as it stands.
// The counts and the band are the PENDING placeholders (D1, D2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mistsAt, mistsHere } from "./world-engine.mjs";
import { mistsKeepRects, keptByTheTown } from "./mists-keep.mjs";
import {
  CREATURE_DIALS_PENDING, TOWN, secretFor, commitmentOf, windowOf, creatureId, isCreatureId, creaturesOn,
  scheduleFor, dueSpawns, auditWindow, creaturesAt, dueFades, creaturesSnapshot,
} from "./creatures.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MISTS = JSON.parse(readFileSync(join(ROOT, "WORLD/skeleton.json"), "utf8")).mists;
const MARKS = JSON.parse(readFileSync(join(ROOT, "WORLD/world-state.json"), "utf8")).marks;
const INPUTS = { mists: MISTS, marks: MARKS, fromCrossing: 244 };
const MASTER = "a test master key, never the box's";

test("the seed: a secret per crossing, and a commitment that names it without telling it", () => {
  const s270 = secretFor(MASTER, 270), s271 = secretFor(MASTER, 271);
  assert.match(s270, /^[0-9a-f]{64}$/);
  assert.equal(secretFor(MASTER, 270), s270, "the same crossing, the same secret");
  assert.notEqual(s270, s271, "each crossing its own: one reveal never tells the next window");
  assert.notEqual(secretFor("another key", 270), s270, "the master key decides it");
  assert.equal(commitmentOf(s270), commitmentOf(s270));
  assert.notEqual(commitmentOf(s270), s270);
  assert.throws(() => secretFor("", 270), /no master key/);
});

test("the schedule: the pending counts, every one placed in the band, off the town, apart, at a minute in its window", () => {
  for (const N of [250, 270, 282]) {
    const sched = scheduleFor(N, secretFor(MASTER, N), INPUTS);
    const m = mistsAt(N, MISTS), keep = mistsKeepRects(MARKS, MISTS.clearings_m);
    const { startMs, endMs } = windowOf(N);
    const byKind = {};
    for (const s of sched.spawns) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    assert.deepEqual(sched.unplaced, [], `crossing ${N}: every spawn found a place`);
    assert.deepEqual(byKind, { ...CREATURE_DIALS_PENDING.counts }, `crossing ${N}: the counts`);
    for (const s of sched.spawns) {
      const here = mistsHere(s, m);
      assert.equal(here.inWall, false, `${s.id} stands on the clear side`);
      const c = m.clear, boxWallM = Math.min(s.x - c.minX, c.maxX - s.x, s.y - c.minY, c.maxY - s.y);
      assert.ok(boxWallM >= 0 && boxWallM <= 400, `${s.id} is in the band (${Math.round(boxWallM)} m from the face)`);
      assert.equal(keptByTheTown(keep, s.x, s.y), false, `${s.id} is off the town's ground`);
      assert.ok(m.clearings.every((k) => Math.hypot(s.x - k.x, s.y - k.y) > k.r), `${s.id} is in no clearing`);
      assert.ok(s.at_ms >= startMs && s.at_ms < endMs && s.at_ms % 60000 === 0, `${s.id} spawns at a minute in its window`);
      assert.equal(Date.parse(s.fades_at) - s.at_ms, 12 * 3600 * 1000, `${s.id} lives 12 h`);
      assert.equal(s.id, creatureId(s.kind, N, s.index));
      for (const o of sched.spawns) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.y - s.y) >= CREATURE_DIALS_PENDING.apart_m, `${s.id} and ${o.id} stand apart`);
    }
    for (let i = 1; i < sched.spawns.length; i += 1) assert.ok(sched.spawns[i - 1].at_ms <= sched.spawns[i].at_ms, "in time order");
  }
});

test("the schedule is the secret's alone: the same inputs give the same window, another secret another", () => {
  const a = scheduleFor(270, secretFor(MASTER, 270), INPUTS), b = scheduleFor(270, secretFor(MASTER, 270), INPUTS);
  assert.deepEqual(a, b);
  const c = scheduleFor(270, secretFor("another key", 270), INPUTS);
  assert.notDeepEqual(c.spawns.map((s) => [s.x, s.y, s.at]), a.spawns.map((s) => [s.x, s.y, s.at]));
  // one more raven moves no wolf or bat: each spawn's draws are named by its own id
  const more = scheduleFor(270, secretFor(MASTER, 270), { ...INPUTS, dials: { ...CREATURE_DIALS_PENDING, counts: { ...CREATURE_DIALS_PENDING.counts, raven: 5 } } });
  const wolves = (s) => s.spawns.filter((x) => x.kind === "wolf" || x.kind === "bat").map((x) => `${x.id}@${x.at}(${x.x},${x.y})`).sort();
  assert.deepEqual(wolves(more), wolves(a));
});

test("the dial and the season: no schedule when the dial is off, before it, or before the Mists", () => {
  const secret = secretFor(MASTER, 270);
  assert.deepEqual(scheduleFor(270, secret, { ...INPUTS, fromCrossing: null }).spawns, [], "null is off");
  assert.deepEqual(scheduleFor(270, secret, { ...INPUTS, fromCrossing: undefined }).spawns, [], "absent is off");
  assert.deepEqual(scheduleFor(270, secret, { ...INPUTS, fromCrossing: 271 }).spawns, [], "before the launch crossing");
  assert.equal(scheduleFor(271, secretFor(MASTER, 271), { ...INPUTS, fromCrossing: 271 }).spawns.length, 9, "from it on");
  assert.deepEqual(scheduleFor(240, secretFor(MASTER, 240), { ...INPUTS, fromCrossing: 0 }).spawns, [], "no Mists before 244, no creatures");
  assert.equal(creaturesOn(270, "268"), true);
  assert.equal(creaturesOn(270, null), false);
});

test("hidden until each spawn: the tick is told only what is due", () => {
  const sched = scheduleFor(270, secretFor(MASTER, 270), INPUTS);
  const { startMs, endMs } = windowOf(270);
  assert.deepEqual(dueSpawns(sched, startMs - 1), []);
  const mid = sched.spawns[4].at_ms;
  assert.deepEqual(dueSpawns(sched, mid).map((s) => s.id), sched.spawns.filter((s) => s.at_ms <= mid).map((s) => s.id));
  assert.equal(dueSpawns(sched, endMs).length, sched.spawns.length);
});

// the window's log as the tick would write it
function windowLog(N, { tamper = null } = {}) {
  const secret = secretFor(MASTER, N), sched = scheduleFor(N, secret, INPUTS), { startMs, endMs } = windowOf(N);
  const acts = [{ at: new Date(startMs).toISOString(), actor: TOWN, action: "seed", object: null, payload: { crossing: N, commitment: commitmentOf(secret) } }];
  for (const s of sched.spawns) acts.push({ at: s.at, actor: TOWN, action: "spawn", object: s.id,
    payload: { crossing: N, kind: s.kind, x: s.x, y: s.y, fades_at: s.fades_at, moods: { fear: 1, curiosity: 1 }, flags: [] } });
  acts.push({ at: new Date(endMs).toISOString(), actor: TOWN, action: "reveal", object: null, payload: { crossing: N, secret } });
  if (tamper) tamper(acts);
  return { acts, sched, secret };
}

test("the reveal re-derives the window: the audit passes on the tick's log and names any tampering", () => {
  assert.deepEqual(auditWindow(270, windowLog(270).acts, INPUTS), { ok: true, problems: [] });
  const moved = auditWindow(270, windowLog(270, { tamper: (a) => { a.find((x) => x.action === "spawn").payload.x += 1; } }).acts, INPUTS);
  assert.equal(moved.ok, false);
  assert.ok(moved.problems.some((p) => /not in the log/.test(p)) && moved.problems.some((p) => /not the schedule's/.test(p)), moved.problems.join("; "));
  const swapped = auditWindow(270, windowLog(270, { tamper: (a) => { a.at(-1).payload.secret = secretFor(MASTER, 271); } }).acts, INPUTS);
  assert.deepEqual(swapped.problems, ["crossing 270: the revealed secret does not hash to the seed's commitment"]);
  const extra = auditWindow(270, windowLog(270, { tamper: (a) => { a.push({ ...a[1], object: creatureId("wolf", 270, 9) }); } }).acts, INPUTS);
  assert.equal(extra.ok, false);
  assert.deepEqual(auditWindow(270, [], INPUTS).problems, ["crossing 270: no seed act", "crossing 270: no reveal act"]);
});

test("the fold: spawned, revised by its own acts, gone by `fled` at once or `faded` at 12 h, written or not", () => {
  const { acts, sched } = windowLog(270);
  const [a, b, c] = sched.spawns;
  const t = (ms) => new Date(ms).toISOString();
  const later = [
    { at: t(b.at_ms + 60000), actor: b.id, action: "snarl", object: "kogane", payload: { after: { moods: { fear: 2, curiosity: 1 }, flags: ["startled"] } } },
    { at: t(c.at_ms + 120000), actor: c.id, action: "flee", object: "kogane", payload: { after: { moods: { fear: 3, curiosity: 1 }, flags: [] } } },
    { at: t(c.at_ms + 120000), actor: TOWN, action: "withdraw", object: c.id, payload: { reason: "fled" } },
    { at: t(b.at_ms + 90000), actor: "kogane", action: "say", object: null, payload: { text: "hello" } },   // a resident's act is not the creature's
  ];
  const all = [...acts, ...later];
  const at = (ms) => creaturesAt(null, all, ms);
  assert.equal(at(a.at_ms - 1).has(a.id), false, "not before its spawn");
  assert.deepEqual(at(a.at_ms).get(a.id), { id: a.id, kind: a.kind, crossing: 270, x: a.x, y: a.y, spawned_at: a.at, fades_at: a.fades_at, moods: { fear: 1, curiosity: 1 }, flags: [] });
  const bLive = at(b.at_ms + 120000).get(b.id);
  assert.deepEqual([bLive.moods, bLive.flags], [{ fear: 2, curiosity: 1 }, ["startled"]], "its own act revises it");
  assert.equal(at(c.at_ms + 119999).has(c.id), true);
  assert.equal(at(c.at_ms + 120000).has(c.id), false, "fled: gone at once");
  assert.equal(at(Date.parse(a.fades_at) - 1).has(a.id), true);
  assert.equal(at(Date.parse(a.fades_at)).has(a.id), false, "faded at 12 h, before the tick writes it");
  const due = dueFades(null, all, Date.parse(a.fades_at));
  assert.ok(due.some((f) => f.id === a.id && f.reason === "faded" && f.at === a.fades_at), "the tick is told to write the fade");
  assert.ok(!due.some((f) => f.id === c.id), "a fled creature never fades");
  const written = [...all, { at: a.fades_at, actor: TOWN, action: "withdraw", object: a.id, payload: { reason: "faded" } }];
  assert.ok(!dueFades(null, written, Date.parse(a.fades_at)).some((f) => f.id === a.id), "a written fade is not due again");
});

test("the save: a snapshot plus the acts since it folds to the same creatures as the whole log (snapshot parity)", () => {
  const { acts, sched } = windowLog(270);
  const b = sched.spawns[1];
  const revise = { at: new Date(b.at_ms + 60000).toISOString(), actor: b.id, action: "snarl", object: "kogane", payload: { after: { moods: { fear: 3, curiosity: 0 }, flags: [] } } };
  const all = [...acts, revise];
  const boundary = windowOf(271).startMs;   // the crossing save at 271's boundary
  const snap = creaturesSnapshot(271, boundary, creaturesAt(null, all, boundary));
  assert.equal(snap.creature_count, snap.creatures.length);
  assert.ok(snap.creatures.every((c) => !("memory" in c)), "no memory is saved");
  assert.deepEqual(snap.creatures.map((c) => c.id), [...snap.creatures.map((c) => c.id)].sort(), "by id");
  // a round trip through JSON, as STATE/ holds it, and on into the next window
  const saved = JSON.parse(JSON.stringify(snap));
  const next = windowLog(271).acts;
  for (const ms of [boundary + 1, boundary + 6 * 3600e3, windowOf(272).startMs]) {
    const fromSnap = creaturesSnapshot(0, ms, creaturesAt(saved, next, ms));
    const fromAll = creaturesSnapshot(0, ms, creaturesAt(null, [...all, ...next], ms));
    assert.deepEqual(fromSnap, fromAll, `the same creatures at ${new Date(ms).toISOString()}`);
  }
  assert.ok(creaturesSnapshot(272, windowOf(272).startMs, creaturesAt(saved, next, windowOf(272).startMs)).creatures.every((c) => c.crossing === 271), "270's have all faded by 272");
});

test("ids: the creature: prefix keeps them out of the handle namespace", () => {
  assert.equal(creatureId("wolf", 268, 1), "creature:wolf-268-1");
  assert.equal(isCreatureId("creature:wolf-268-1"), true);
  assert.equal(isCreatureId("wolf-268-1"), false);
  assert.equal(isCreatureId(undefined), false);
});
