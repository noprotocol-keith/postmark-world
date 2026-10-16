// ways-in-view.test.mjs — row 72: the ways of the room you have entered are always in view.
//
//   node --test tools/ways-in-view.test.mjs
//
// Found 2026-10-16 in the playground: in the Spire's 60 m Red Stair Hall the
// small door to the Blue Room, 52 m off, lost its seat to the sight budget (marks
// rank by angular size), so the page never drew it and a stranger could only
// pass the one door they stood at. With A1 (Darko 2026-10-16 19:15) every portal
// of a room you have entered is at hand from anywhere in it, so every one is
// seen, the way the acting resident's home rides past the budget (WLD-9). It never
// makes a hidden mark visible. Darko's call is open: this commit is removable whole.
//
// Every world is a REAL fold of synthetic marks, with a crowd built to OUTRANK the
// far door, so the budget cut is what is being tested, not the ranking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "./marks-fold.mjs";
import { buildHeightfield, fieldOfView } from "./world-engine.mjs";
import { waysAt } from "./portals.mjs";
import { openYourEyes } from "./world-verbs.mjs";

const flatHF = buildHeightfield({ controlPoints: [{ x: 0, y: 0, h: 5 }, { x: 10000, y: 0, h: 5 }, { x: 0, y: 10000, h: 5 }, { x: -10000, y: 0, h: 5 }] });
const light = { dawn_pole_m: { x: 5000, y: -5000 }, dark_pole_m: { x: -5000, y: 5000 } };
const BUDGET = 4;

const SITED = (id, x, y, w, h, extra = {}) => ({ id, by: "t", household: "t", kind: "sited", tier: "market", at: { x, y }, extent: { w, h },
  date: "2026-09-01T00:00:00Z", body: "b", ...extra });
const HALL = SITED("t/hall", 0, 0, 60, 40);
const FAR_DOOR = SITED("t/far-door", -28, 0, 2, 2, { entry: { word: "neutral", into: "t/next" } });
const NEAR_DOOR = SITED("t/near-door", 28, 0, 2, 2, { entry: { word: "neutral", into: "t/next" } });
const NEXT = SITED("t/next", -60, 0, 20, 20);
// big, heavy and close: each one outranks a 2×2 door 53 m off
const CROWD = Array.from({ length: 6 }, (_, i) => ({ id: `crowd${i}/stall`, by: `crowd${i}`, household: `crowd${i}`, kind: "sited",
  tier: "market", at: { x: 20 + i * 2, y: 45 }, extent: { w: 30, h: 30 }, weight: 50, date: "2026-09-01T00:00:00Z", body: "b" }));

function worldOf(marks) {
  const f = fold({ marks, terrain: { features: [] }, stakes: [], tick: 1, households: {} });
  assert.deepEqual(f.errors, [], "the fixture folds clean");
  return { ...f, terrain: { far_features: [], features: [], elevation: {} }, heightfield: flatHF, light, fogCeilingM: 22 };
}
const carried = (fov) => fov.carried.map((c) => c.id);
const AT = { x: 25, y: 0, name: "ann" };

test("waysAt names the portals of the innermost mark you have entered, and nothing when you have entered nothing", () => {
  const marks = [HALL, FAR_DOOR, NEAR_DOOR, NEXT];
  assert.deepEqual(waysAt(["t/hall"], marks), ["t/far-door", "t/near-door"]);
  assert.deepEqual(waysAt([], marks), []);
  assert.deepEqual(waysAt(null, marks), []);
});

test("not entered, the budget cuts the far door as it always has", () => {
  const w = worldOf([HALL, FAR_DOOR, NEAR_DOOR, NEXT, ...CROWD]);
  const { fov } = openYourEyes(AT, w, { budget: BUDGET });
  assert.equal(carried(fov).includes("t/far-door"), false, "the crowd outranks it for the seats there are");
  assert.equal(fov.carried.length, BUDGET);
});

test("entered in the hall, both of its ways are carried past the budget, once each, and the rest keep their seats", () => {
  const w = worldOf([HALL, FAR_DOOR, NEAR_DOOR, NEXT, ...CROWD]);
  const bare = openYourEyes(AT, w, { budget: BUDGET }).fov;
  const { fov } = openYourEyes(AT, w, { budget: BUDGET, entered: ["t/hall"] });
  const ids = carried(fov);
  assert.ok(ids.includes("t/far-door") && ids.includes("t/near-door"));
  assert.equal(ids.filter((x) => x === "t/far-door").length, 1);
  const others = (list) => list.filter((x) => x !== "t/far-door" && x !== "t/near-door");
  assert.equal(others(ids).length, BUDGET, "the ways ride outside the budget: every one of its seats is still filled");
  assert.deepEqual(others(ids).slice(0, others(carried(bare)).length), others(carried(bare)), "and filled in the bare read's own order");
});

test("always never makes a hidden mark visible: a way standing at the reader's own point is not conjured", () => {
  const w = worldOf([HALL, FAR_DOOR, NEXT, ...CROWD]);
  const fov = fieldOfView(AT, w, { budget: BUDGET, always: ["t/nowhere"] });
  assert.equal(carried(fov).includes("t/nowhere"), false);
});
