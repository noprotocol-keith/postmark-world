// home-in-the-telling.test.mjs — THE FALSIFIER FOR WLD-9 (formerly POS-528).
//
// A resident standing at home on crowded ground must not be told their house is
// among the anonymous budget tail. The bare read (open-your-eyes) carries the
// acting resident's resolved home — tools/where-is.mjs § homeOf, the one resolver
// — beyond the ordinary 12-mark allowance, exactly once, when it is in view.
//
// Every world is a REAL fold of synthetic marks (claim order, the household grain
// and declared homes come from the fold). The crowd is built to OUTRANK the home,
// so the budget cut is what is being tested, not the ranking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "./marks-fold.mjs";
import { buildHeightfield, fieldOfView, DIALS } from "./world-engine.mjs";
import { openYourEyes } from "./world-verbs.mjs";
import { homeOf } from "./where-is.mjs";

const flatHF = buildHeightfield({ controlPoints: [{ x: 0, y: 0, h: 5 }, { x: 10000, y: 0, h: 5 }, { x: 0, y: 10000, h: 5 }, { x: -10000, y: 0, h: 5 }] });
const light = { dawn_pole_m: { x: 5000, y: -5000 }, dark_pole_m: { x: -5000, y: 5000 } };
const BUDGET = DIALS.context_budget; // 12

const PARCEL = (id, by, x, y = 0) => ({ id, by, household: by, kind: "parcel", tier: "market", at: { x, y }, extent: { w: 25, h: 25 }, date: "2026-08-01T00:00:00Z", body: "b" });
const HOUSE = (id, by, x, y) => ({ id, by, household: by, kind: "sited", tier: "market", at: { x, y }, extent: { w: 6, h: 6 }, date: "2026-09-01T00:00:00Z", body: "b" });
const HOME = (id, by, parent, value) => ({ id, by, household: by, kind: "predicated", tier: "market", parent, slot: "home", value, date: "2026-10-04T12:00:00Z", body: "b" });
// big, heavy and close: each one outranks any home in these fixtures
const CROWD = (n, around = { x: 7, y: 3 }) => Array.from({ length: n }, (_, i) => ({
  id: `crowd${i}/stall`, by: `crowd${i}`, household: `crowd${i}`, kind: "sited", tier: "market",
  at: { x: around.x + i * 0.5, y: around.y }, extent: { w: 40, h: 40 }, weight: 50, date: "2026-09-01T00:00:00Z", body: "b",
}));

function worldOf(marks, households = {}) {
  const f = fold({ marks, terrain: { features: [] }, stakes: [], tick: 1, households });
  assert.deepEqual(f.errors, [], "the fixture folds clean");
  return { ...f, terrain: { far_features: [], features: [], elevation: {} }, heightfield: flatHF, light, fogCeilingM: 22 };
}
const ids = (fov) => fov.carried.map((c) => c.id);
const count = (fov, id) => ids(fov).filter((x) => x === id).length;
const tailTotal = (fov) => Object.values(fov.aggregate.by_bearing).reduce((a, b) => a + b, 0);

const AT_HOME = { x: 6, y: 0 };
const PARCEL_ASH = PARCEL("ash/parcel", "ash", 0);

test("W1 · PRIMARY: 14 visible marks outrank the acting home; the bare read still carries the home once, plus the ordinary 12", () => {
  const w = worldOf([PARCEL_ASH, ...CROWD(14)]);
  const plain = openYourEyes(AT_HOME, w, { crossing: 0 }).fov;
  assert.equal(count(plain, "ash/parcel"), 0, "control: with no actor the home is in the anonymous tail (the omission)");
  assert.equal(plain.carried.length, BUDGET);
  assert.equal(plain.counts.visible, 15);

  const eyes = openYourEyes(AT_HOME, w, { crossing: 0, actor: "ash" });
  const fov = eyes.fov;
  assert.equal(count(fov, "ash/parcel"), 1, "the home is carried exactly once");
  assert.equal(fov.carried.filter((c) => c.id !== "ash/parcel").length, BUDGET, "the ordinary non-home allowance is untouched");
  assert.deepEqual(ids(fov).filter((x) => x !== "ash/parcel"), ids(plain), "and it is the same twelve, in the same order");
  // the aggregate describes what is actually left: 15 visible − 13 carried = 2
  assert.equal(fov.aggregate.hidden_by_budget, 2);
  assert.equal(tailTotal(fov), 2, "by_bearing sums to the real tail");
  assert.equal(fov.counts.shown, BUDGET + 1);
  assert.equal(fov.counts.clustered, 2);
  assert.equal(fov.counts.visible, 15, "visibility is unchanged");
  // the telling prose reads the same aggregate
  assert.match(eyes.tell(), /and 2 more marks/);
});

test("W2 · a home already inside the carried set is not repeated and costs no seat", () => {
  const w = worldOf([PARCEL_ASH, ...CROWD(3)]);
  const plain = openYourEyes(AT_HOME, w, { crossing: 0 }).fov;
  assert.equal(count(plain, "ash/parcel"), 1, "control: it made the cut by itself");
  const fov = openYourEyes(AT_HOME, w, { crossing: 0, actor: "ash" }).fov;
  assert.equal(count(fov, "ash/parcel"), 1);
  assert.deepEqual(fov, plain, "byte-identical to the read without an actor");
  // exactly at the edge: 12 others outrank it is the boundary the pin starts to matter
  const edge = worldOf([PARCEL_ASH, ...CROWD(BUDGET - 1)]);
  const e = openYourEyes(AT_HOME, edge, { crossing: 0, actor: "ash" }).fov;
  assert.equal(e.carried.length, BUDGET, "the home takes the 12th seat on its own: no 13th");
  assert.equal(count(e, "ash/parcel"), 1);
});

test("W3 · a declared home is the house, not the default parcel", () => {
  const house = HOUSE("ash/the-red-door", "ash", 9, -6);
  const w = worldOf([PARCEL_ASH, house, HOME("ash/home", "ash", "ash/parcel", "ash/the-red-door"), ...CROWD(14)]);
  assert.equal(homeOf("ash", w).home_mark, "ash/the-red-door", "fixture: the declaration resolves");
  const fov = openYourEyes(AT_HOME, w, { crossing: 0, actor: "ash" }).fov;
  assert.equal(count(fov, "ash/the-red-door"), 1, "the declared house is carried");
  assert.equal(count(fov, "ash/parcel"), 0, "the parcel it stands on is not pinned with it");
  assert.equal(fov.carried.length, BUDGET + 1);
});

test("W4 · a housemate's home is the shared parcel, and only that: the holder's other marks are not pinned", () => {
  const shed = { ...HOUSE("ash/shed", "ash", -9, 9), extent: { w: 2, h: 2 } };
  const w = worldOf([PARCEL_ASH, shed, ...CROWD(14)], { ash: "the-roost", birch: "the-roost" });
  assert.equal(homeOf("birch", w).via, "household", "fixture: birch has no parcel of their own");
  const fov = openYourEyes(AT_HOME, w, { crossing: 0, actor: "birch" }).fov;
  assert.equal(count(fov, "ash/parcel"), 1, "the shared parcel is birch's home");
  assert.equal(count(fov, "ash/shed"), 0, "the household's other marks stay where the ranking put them");
  assert.equal(fov.carried.length, BUDGET + 1);
});

test("W5 · two residents, two homes: the actor actually selected is the one carried", () => {
  const w = worldOf([PARCEL_ASH, PARCEL("cedar/parcel", "cedar", 0, 40), ...CROWD(14, { x: 7, y: 20 })]);
  const stand = { x: 6, y: 20 };
  const asAsh = openYourEyes(stand, w, { crossing: 0, actor: "ash" }).fov;
  const asCedar = openYourEyes(stand, w, { crossing: 0, actor: "cedar" }).fov;
  assert.deepEqual([count(asAsh, "ash/parcel"), count(asAsh, "cedar/parcel")], [1, 0]);
  assert.deepEqual([count(asCedar, "ash/parcel"), count(asCedar, "cedar/parcel")], [0, 1]);
});

test("W6 · no actor, an unknown handle, or a home that is nowhere: nothing invented, ordinary selection", () => {
  const w = worldOf([PARCEL_ASH, ...CROWD(14)]);
  const plain = openYourEyes(AT_HOME, w, { crossing: 0 }).fov;
  for (const actor of [null, undefined, "", "nobody-here"]) {
    assert.deepEqual(openYourEyes(AT_HOME, w, { crossing: 0, actor }).fov, plain, `actor ${JSON.stringify(actor)} reads as no actor`);
  }
  // a world that carries no parcels/households at all (the bare engine fixtures) must not crash the read
  const bare = { marks: w.marks, terrain: w.terrain, heightfield: flatHF, light, fogCeilingM: 22 };
  assert.doesNotThrow(() => openYourEyes(AT_HOME, bare, { crossing: 0, actor: "ash" }));
  assert.equal(count(openYourEyes(AT_HOME, bare, { crossing: 0, actor: "ash" }).fov, "ash/parcel"), 0);
});

test("W7 · the pin never forces a home into view: one past sight stays out", () => {
  const far = PARCEL("ash/parcel", "ash", DIALS.max_sight_m + 500);
  const w = worldOf([far, ...CROWD(14)]);
  const fov = openYourEyes({ x: 6, y: 0 }, w, { crossing: 0, actor: "ash" }).fov;
  assert.equal(count(fov, "ash/parcel"), 0, "out of reach is out of the telling, as before");
  assert.deepEqual(fov, openYourEyes({ x: 6, y: 0 }, w, { crossing: 0 }).fov);
});

test("W8 · fieldOfView's own `keep` is inert for an id that is not in the cut", () => {
  const w = worldOf([PARCEL_ASH, ...CROWD(14)]);
  const plain = fieldOfView(AT_HOME, w, { crossing: 0 });
  assert.deepEqual(fieldOfView(AT_HOME, w, { crossing: 0, keep: "no/such-mark" }), plain);
  assert.deepEqual(fieldOfView(AT_HOME, w, { crossing: 0, keep: "crowd0/stall" }), plain, "already carried: no duplicate");
});
