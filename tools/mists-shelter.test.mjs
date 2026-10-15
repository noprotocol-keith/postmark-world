// mists-shelter.test.mjs — AN ENTERED MARK IS SHELTER (Darko 2026-10-15). Within a mark a walker has entered (on
// their enter stack), the Mists neither slow the walk nor stop it, and nothing inside the mark is cut from their
// reads. It follows entering, never standing: without the stack every answer is the old one.
// Run: node --test tools/mists-shelter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHeightfield, fieldOfView, mistsAt, mistsHere, mistsRoad, DIALS } from "./world-engine.mjs";
import { openYourEyes, shelterOf } from "./world-verbs.mjs";

const flatAt = (h) => buildHeightfield({ controlPoints: [{ x: 0, y: 0, h }, { x: 10000, y: 0, h }, { x: 0, y: 10000, h }, { x: -10000, y: 0, h }] });
const light = { dawn_pole_m: { x: 5000, y: -5000 }, dark_pole_m: { x: -5000, y: 5000 } };
const CLEAR = { ...DIALS, fog_base: 0, fog_swing: 0 };
// a 2 km map; the Mists arrive at crossing 10
const MISTS = {
  border_m: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
  fringe_m: 300, wall_sight_m: 20, density: { from: 0.9, to: 0.9 },
  schedule: [{ crossing: 10, front_m: 0, veil: 0.4 }],
};
const terrainWith = (mists) => ({ mists, far_features: [] });
const worldOf = (marks) => ({ marks, terrain: terrainWith(MISTS), heightfield: flatAt(5), light, fogCeilingM: 22 });

// THE GROUNDS: a sited mark out past the north border, in the wall, with a tower inside it
const GROUNDS = { id: "beyond/grounds", kind: "sited", household: "beyond", at: { x: 0, y: -1150 }, extent: { w: 300, h: 300 }, weight: 3, top_m: 2 };
const TOWER = { id: "beyond/tower", kind: "sited", household: "beyond", at: { x: 60, y: -1220 }, extent: { w: 10, h: 10 }, weight: 5, top_m: 30 };
const OUTSIDE = { id: "beyond/cairn", kind: "sited", household: "beyond", at: { x: 400, y: -1150 }, extent: { w: 4, h: 4 }, weight: 1, top_m: 3 };
const STAND = { x: 0, y: -1100 };   // inside the Grounds, in the wall, 130 m from the tower
const shown = (fov) => fov.carried.map((m) => m.id);
const marks = [GROUNDS, TOWER, OUTSIDE];

test("the ground is the wall, and the tower is past arm's reach: without shelter it is hidden", () => {
  const m = mistsAt(10, MISTS);
  assert.equal(mistsHere(STAND, m).inWall, true);
  assert.ok(Math.hypot(TOWER.at.x - STAND.x, TOWER.at.y - STAND.y) > m.wallSightM);
  assert.ok(!shown(fieldOfView(STAND, worldOf(marks), { crossing: 10, dials: CLEAR })).includes("beyond/tower"));
});

test("entered, the Grounds hold no mist for your reads: the tower inside is seen", () => {
  const { fov } = openYourEyes(STAND, worldOf(marks), { crossing: 10, dials: CLEAR, entered: ["beyond/grounds"] });
  assert.ok(shown(fov).includes("beyond/tower"));
});

test("shelter is the entered mark only: a mark outside it is still behind the wall", () => {
  const { fov } = openYourEyes(STAND, worldOf(marks), { crossing: 10, dials: CLEAR, entered: ["beyond/grounds"] });
  assert.ok(!shown(fov).includes("beyond/cairn"));
});

test("it follows entering, never standing: no stack, the old answer, field for field", () => {
  const w = worldOf(marks);
  for (const entered of [null, [], ["not/a-mark"]]) {
    assert.deepEqual(openYourEyes(STAND, w, { crossing: 10, dials: CLEAR, entered }).fov, openYourEyes(STAND, w, { crossing: 10, dials: CLEAR }).fov);
  }
});

test("entered, a walk inside the Grounds is the open road; the same walk unentered is refused", () => {
  const w = worldOf(marks);
  const a = { x: -50, y: -1100 }, b = { x: 60, y: -1250 };
  assert.ok(mistsRoad(a, b, 10, MISTS).refused, "unentered: the wall stops it");
  const r = mistsRoad(a, b, 10, MISTS, { shelter: shelterOf(w, ["beyond/grounds"]) });
  assert.equal(r.refused, undefined);
  assert.deepEqual([r.factor, r.deepest], [1, 0]);
});

test("entered, a walk that leaves the Grounds into the wall is still refused", () => {
  const r = mistsRoad({ x: 0, y: -1100 }, { x: 400, y: -1100 }, 10, MISTS, { shelter: shelterOf(worldOf(marks), ["beyond/grounds"]) });
  assert.ok(r.refused);
});

test("no shelter, no change: every road reads exactly as before", () => {
  const roads = [[{ x: 0, y: 0 }, { x: 0, y: -900 }], [{ x: 0, y: -900 }, { x: 0, y: -1100 }], [{ x: 200, y: 600 }, { x: -300, y: 900 }]];
  for (const [a, b] of roads) {
    assert.deepEqual(mistsRoad(a, b, 10, MISTS, { shelter: null }), mistsRoad(a, b, 10, MISTS));
    assert.deepEqual(mistsRoad(a, b, 10, MISTS, { shelter: shelterOf(worldOf(marks), []) }), mistsRoad(a, b, 10, MISTS));
  }
});
