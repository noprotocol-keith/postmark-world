// creatures.mjs — the creatures from the Mists: the hidden schedule and the fold (WLD-56).
//
// Ruled in Sitting E (Darko, 2026-10-14 §§ 3, 6, 7; the record is Starstory
// docs/2026-10-14/halloween/sitting-E-entities.md). A creature is a living node: its
// spawn is a LIVE create by `the-town`, its reactions are its own live acts, and it
// leaves by a live withdraw, reason `faded` (12 h after its spawn) or `fled` (the
// only leaving by outcome). Each crossing's save photographs the living ones.
// Engineering settled by Wright on WLD-56 (W1–W8), from Plumb's gap read.
//
// Everything here is PURE: no clock, no store, no network. The office's writer tick
// calls it to know what is due, and the save calls it to know what is alive; anyone
// holding the log calls it to check both.
//
// ── THE SEED: COMMIT, THEN REVEAL (W2) ─────────────────────────────────────────
// "The schedule stays hidden until each spawn" and "afterwards it's public in the
// log and can be re-derived" (Darko 21:12, 21:31). So each crossing has its own
// secret, secret_N = HMAC-SHA256(master, "creatures/" + N), and the master key lives
// only on the box. At the window's first tick `the-town` writes a `seed` act
// carrying commitment_N = sha256(secret_N): public, and it says nothing about the
// schedule. At the window's close it writes a `reveal` act carrying secret_N, and
// anyone re-derives the whole window (`scheduleFor`) and checks it against the
// commitment and the spawns (`auditWindow`). A per-crossing secret is why one
// reveal never exposes the next window.
//
// ── THE SCHEDULE ────────────────────────────────────────────────────────────────
// A pure function of (N, secret_N, the window's dials, the Mists at N, the town's
// keep-out at the window's opening sha). Each spawn has a kind, a minute in the
// window, and a place: in the band on the clear side of the wall, never inside it,
// never in a clearing, never on or near the town's ground (tools/mists-keep.mjs).
// A spawn with no place found after a bounded search is not made, and the schedule
// says so (`unplaced`), the same way on every replay.
//
// ⚑ PENDING DARKO (D1, D2): the counts per kind, the band's depth and the keep-out
// margin are placeholders, each Plumb's recommendation, passed in as dials. Nothing
// here hard-codes a creature's numbers; CREATURE_DIALS_PENDING is only the default
// the tests and the tick use until the class mark carries the ruled dials.
//
// ── THE FOLD (W4, W5) ──────────────────────────────────────────────────────────
// A creature is a fold of the log's rows: `spawn` (the-town, object = its id),
// its own acts (actor = its id; a payload `after` is its state from then on), and
// `withdraw` (object = its id, payload.reason faded | fled). Its 12 h span is
// physics: past `fades_at` it is gone whether or not the tick has written the
// withdraw yet. `creaturesAt` folds a crossing's snapshot plus the acts since it,
// never the whole history (snapshot per settlement, delta only). The creature's
// short memory is NOT here and is never saved: "for its own span only" (§ 7).

import { createHash, createHmac } from "node:crypto";
import { mistsAt, mistsHere } from "./world-engine.mjs";
import { mistsKeepRects, keptByTheTown, MISTS_KEEP } from "./mists-keep.mjs";
import { CROSSING_EPOCH_UTC, CROSSING_MS } from "./walk.mjs";

export const TOWN = "the-town";
export const DESPAWN_REASONS = Object.freeze(["faded", "fled"]);
export const ID_PREFIX = "creature:";

/** The placeholder dials, PENDING Darko's D1 and D2 (Plumb's recommendations,
 *  WLD-56 gap read § 3). The ruled values will ride the creature class's dials. */
export const CREATURE_DIALS_PENDING = Object.freeze({
  counts: Object.freeze({ wolf: 2, raven: 4, bat: 3 }),   // D2: per 12 h window
  band_from_m: 0,                                         // D1: the band, measured from the wall's face into the clear ground
  band_to_m: 400,                                         //     (the fringe: fringe_m)
  keep_m: MISTS_KEEP.keepM,                               // D1: how far from the town's ground a creature may stand
  apart_m: 150,                                           //     how far apart two spawns of one window stand
  span_h: 12,                                             // ruled (§ 7): a creature lasts 12 h from its spawn
});

// ── the seed ────────────────────────────────────────────────────────────────────
/** secret_N: the crossing's own key, from the box's master key. Hex. */
export function secretFor(masterKey, crossing) {
  if (!masterKey) throw new Error("secretFor: no master key");
  return createHmac("sha256", String(masterKey)).update(`creatures/${crossing | 0}`).digest("hex");
}

/** commitment_N: what the seed act publishes before any spawn. Hex. */
export function commitmentOf(secret) {
  return createHash("sha256").update(String(secret)).digest("hex");
}

/** A uniform draw in [0, 1) from a secret, named by its key: sha256(secret | key), first 48 bits. */
function draw(secret, key) {
  const b = createHash("sha256").update(`${secret}|${key}`).digest();
  return (b.readUIntBE(0, 6)) / 2 ** 48;
}

// ── the window ──────────────────────────────────────────────────────────────────
/** Crossing N's window, [start, end), in ms. */
export function windowOf(crossing) {
  const startMs = CROSSING_EPOCH_UTC + (crossing | 0) * CROSSING_MS;
  return { crossing: crossing | 0, startMs, endMs: startMs + CROSSING_MS };
}

/** A creature's id: `creature:<kind>-<crossing>-<i>`. The colon keeps it out of the
 *  handle namespace (W8). */
export const creatureId = (kind, crossing, i) => `${ID_PREFIX}${kind}-${crossing | 0}-${i}`;
export const isCreatureId = (id) => typeof id === "string" && id.startsWith(ID_PREFIX);

/** Is the dial on for crossing N? `from_crossing` null (or absent) is off. */
export function creaturesOn(crossing, fromCrossing) {
  return fromCrossing !== null && fromCrossing !== undefined && Number.isFinite(Number(fromCrossing)) && (crossing | 0) >= Number(fromCrossing);
}

// ── the place ───────────────────────────────────────────────────────────────────
/** A point in the band: a side of the clear box weighted by its length, a place
 *  along it, and a depth into the clear ground from the wall's face. */
function bandPoint(m, u1, u2, from, to) {
  const c = m.clear;
  const sides = [
    { len: c.maxX - c.minX, at: (s, d) => ({ x: c.minX + s, y: c.minY + d }) },   // north face, inward is +y
    { len: c.maxX - c.minX, at: (s, d) => ({ x: c.minX + s, y: c.maxY - d }) },   // south
    { len: c.maxY - c.minY, at: (s, d) => ({ x: c.minX + d, y: c.minY + s }) },   // west
    { len: c.maxY - c.minY, at: (s, d) => ({ x: c.maxX - d, y: c.minY + s }) },   // east
  ];
  const total = sides.reduce((a, s) => a + Math.max(0, s.len), 0);
  if (!(total > 0)) return null;
  let u = u1 * total, side = sides[sides.length - 1];
  for (const s of sides) { if (u < s.len) { side = s; break; } u -= s.len; }
  const p = side.at(u, from + (to - from) * u2);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Does p stand in the band, on the clear box's ground (not a clearing's), off the town's? */
function placeable(m, p, from, to, keep) {
  const c = m.clear;
  if (!(p.x >= c.minX && p.x <= c.maxX && p.y >= c.minY && p.y <= c.maxY)) return false;
  const boxWallM = Math.min(p.x - c.minX, c.maxX - p.x, p.y - c.minY, c.maxY - p.y);
  if (boxWallM < from || boxWallM > to) return false;
  const here = mistsHere(p, m);
  if (here.inWall) return false;
  if ((m.clearings ?? []).some((k) => Math.hypot(p.x - k.x, p.y - k.y) <= k.r)) return false;
  return !keptByTheTown(keep, p.x, p.y);
}

const TRIES = 64;

/**
 * Crossing N's schedule, from its secret. Returns { crossing, spawns, unplaced }:
 * spawns are [{ id, kind, index, crossing, at_ms, at, fades_at, x, y }] in time order
 * (ties by id), unplaced [{ id, kind, index }] the spawns no place was found for.
 *
 *   mists        the skeleton's `mists` block at the window's opening sha
 *   marks        the standing marks at that sha (the town's keep-out is read from them)
 *   dials        { counts, band_from_m, band_to_m, keep_m, apart_m, span_h }
 *   fromCrossing the creature class's launch dial; null is off (W6)
 *
 * Empty when the dial is off for N or the Mists are out of season (mistsAt null).
 */
export function scheduleFor(crossing, secret, { mists, marks = [], dials = CREATURE_DIALS_PENDING, fromCrossing = null } = {}) {
  const N = crossing | 0;
  const out = { crossing: N, spawns: [], unplaced: [] };
  if (!creaturesOn(N, fromCrossing)) return out;
  const m = mistsAt(N, mists);
  if (!m) return out;
  if (!secret) throw new Error("scheduleFor: no secret for this crossing");
  const { startMs } = windowOf(N);
  const spanMs = Number(dials.span_h) * 3600 * 1000;
  const from = Number(dials.band_from_m), to = Number(dials.band_to_m), apart = Number(dials.apart_m) || 0;
  const keep = mistsKeepRects(marks, mists?.clearings_m ?? [], Number(dials.keep_m));
  const minutes = CROSSING_MS / 60000;
  // Each spawn's draws are named by its own id (its minute, then two per try), so
  // another kind's count never moves it; only "apart" couples spawns, in a fixed
  // order (kinds by name, then index).
  const placed = [];
  for (const kind of Object.keys(dials.counts ?? {}).sort()) {
    const n = Math.max(0, Math.floor(Number(dials.counts[kind]) || 0));
    for (let i = 1; i <= n; i += 1) {
      const id = creatureId(kind, N, i);
      const minute = Math.floor(draw(secret, `${id}|minute`) * minutes);
      let at = null;
      for (let t = 0; t < TRIES && !at; t += 1) {
        const p = bandPoint(m, draw(secret, `${id}|side|${t}`), draw(secret, `${id}|depth|${t}`), from, to);
        if (p && placeable(m, p, from, to, keep) && placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= apart)) at = p;
      }
      if (!at) { out.unplaced.push({ id, kind, index: i }); continue; }
      placed.push(at);
      const atMs = startMs + minute * 60000;
      out.spawns.push({ id, kind, index: i, crossing: N, at_ms: atMs, at: new Date(atMs).toISOString(),
        fades_at: new Date(atMs + spanMs).toISOString(), x: at.x, y: at.y });
    }
  }
  out.spawns.sort((a, b) => a.at_ms - b.at_ms || (a.id < b.id ? -1 : 1));
  return out;
}

/** The spawns due by `nowMs`: what the tick may write. Nothing later is ever told. */
export function dueSpawns(schedule, nowMs) {
  return schedule.spawns.filter((s) => s.at_ms <= nowMs);
}

/**
 * Check a closed window against its log: the reveal hashes to the seed's commitment,
 * and the spawns logged are exactly the schedule the revealed secret derives (ids,
 * kinds, minutes and places). Returns { ok, problems: [string] }.
 *   acts  the window's rows (seed, reveal, spawn); `inputs` as scheduleFor's.
 */
export function auditWindow(crossing, acts, inputs) {
  const N = crossing | 0, problems = [];
  const mine = acts.filter((a) => a.actor === TOWN && Number(a.payload?.crossing) === N);
  const seed = mine.find((a) => a.action === "seed"), reveal = mine.find((a) => a.action === "reveal");
  if (!seed) problems.push(`crossing ${N}: no seed act`);
  if (!reveal) problems.push(`crossing ${N}: no reveal act`);
  if (seed && reveal && commitmentOf(reveal.payload.secret) !== seed.payload.commitment)
    problems.push(`crossing ${N}: the revealed secret does not hash to the seed's commitment`);
  if (reveal && !problems.length) {
    const want = scheduleFor(N, reveal.payload.secret, inputs).spawns;
    const got = mine.filter((a) => a.action === "spawn");
    const key = (s) => `${s.id}|${s.kind}|${s.at}|${s.x}|${s.y}`;
    const wantK = new Set(want.map(key));
    const gotK = new Set(got.map((a) => key({ id: a.object, kind: a.payload.kind, at: new Date(a.at).toISOString(), x: a.payload.x, y: a.payload.y })));
    for (const k of wantK) if (!gotK.has(k)) problems.push(`crossing ${N}: the schedule's spawn ${k} is not in the log`);
    for (const k of gotK) if (!wantK.has(k)) problems.push(`crossing ${N}: the logged spawn ${k} is not the schedule's`);
  }
  return { ok: problems.length === 0, problems };
}

// ── the fold ────────────────────────────────────────────────────────────────────
const msOf = (v) => (typeof v === "number" ? v : Date.parse(v));

/**
 * The living creatures at `atMs`: the snapshot's living ones, plus the acts since
 * it, folded in order (by `at`, then `id`/`seq` as the log gives them). Returns a
 * Map id → { id, kind, crossing, x, y, spawned_at, fades_at, moods, flags }.
 *
 *   snapshot  a crossing save's creatures.json (or null: start from nothing)
 *   acts      rows { at, actor, action, object, payload } after the snapshot's instant
 */
export function creaturesAt(snapshot, acts, atMs) {
  const living = foldRows(snapshot, acts, atMs);
  // the span is physics: past fades_at it has faded, written or not
  for (const [id, c] of living) if (msOf(c.fades_at) <= atMs) living.delete(id);
  return living;
}

/** The fades due by `nowMs`: creatures past their span whose withdraw is not yet
 *  written. What the tick writes, as `withdraw`, reason `faded`, at `fades_at`. */
export function dueFades(snapshot, acts, nowMs) {
  return [...foldRows(snapshot, acts, nowMs).values()]
    .filter((c) => msOf(c.fades_at) <= nowMs)
    .map((c) => ({ id: c.id, reason: "faded", at: c.fades_at }));
}

// the log alone: spawned, revised by its own acts, removed only by a written withdraw
function foldRows(snapshot, acts, atMs) {
  const living = new Map();
  const fromMs = snapshot ? msOf(snapshot.evaluated_at) : -Infinity;
  for (const c of snapshot?.creatures ?? []) living.set(c.id, { ...c, moods: { ...c.moods }, flags: [...(c.flags ?? [])] });
  const rows = acts
    .filter((a) => { const t = msOf(a.at); return t > fromMs && t <= atMs; })
    .map((a, i) => ({ a, i }))
    .sort((p, q) => msOf(p.a.at) - msOf(q.a.at) || p.i - q.i)
    .map((p) => p.a);
  for (const a of rows) {
    if (a.actor === TOWN && a.action === "spawn" && isCreatureId(a.object)) {
      const p = a.payload ?? {};
      living.set(a.object, {
        id: a.object, kind: p.kind, crossing: p.crossing, x: p.x, y: p.y,
        spawned_at: new Date(msOf(a.at)).toISOString(), fades_at: p.fades_at,
        moods: { ...(p.moods ?? {}) }, flags: [...(p.flags ?? [])],
      });
    } else if (a.action === "withdraw" && isCreatureId(a.object)) {
      living.delete(a.object);
    } else if (isCreatureId(a.actor) && living.has(a.actor) && a.payload?.after) {
      const c = living.get(a.actor), after = a.payload.after;
      if (after.moods) c.moods = { ...after.moods };
      if (after.flags) c.flags = [...after.flags];
    }
  }
  return living;
}

/** The crossing save's photograph, STATE/snapshot/<N>/creatures.json (W5): the
 *  living creatures at the boundary, by id. No memory: it lives for a creature's
 *  span only and is never saved. */
export function creaturesSnapshot(crossing, evaluatedAtMs, living) {
  const creatures = [...living.values()]
    .map((c) => ({ id: c.id, kind: c.kind, crossing: c.crossing, x: c.x, y: c.y, spawned_at: c.spawned_at, fades_at: c.fades_at,
      moods: Object.fromEntries(Object.keys(c.moods ?? {}).sort().map((k) => [k, c.moods[k]])), flags: [...(c.flags ?? [])].sort() }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    crossing: crossing | 0,
    evaluated_at: new Date(evaluatedAtMs).toISOString(),
    grammar: "creatures: the living creatures at evaluated_at, folded from the log (spawn, their own acts, withdraw); a creature's memory is never saved",
    creature_count: creatures.length,
    creatures,
  };
}
