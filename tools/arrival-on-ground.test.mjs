// arrival-on-ground.test.mjs — a walk that has arrived stands ON its target's
// ground, by the same test the enter's reach asks (WLD-5, 2026-10-14).
//
// THE DEFECT, measured on world 17b64ef1 (office lane plumb-arrival): 15,560
// simulated rim walks to every sited mark, and the published arrival point fell
// outside the mark it had arrived at in 1,107 of them:
//   · 1,066 of 14,700 at boxes, by up to 0.05 m: the arrival lies ON the box's
//     edge and was rounded to a tenth of a metre, half the time outward. Every
//     walk to a mark smaller than the grid (the register entries are 0.02 m)
//     failed, and 12 of 5,600 to marks of 5 m or more.
//   · all 41 at the Main Channel and the Pando River: a long, bent ring whose
//     anchor is off its own water, so the road toward the anchor missed the ring
//     and the walk fell back to the box's rim, which is not the river.
//   · `center` walks had the first defect too, at the anchor of a mark smaller
//     than the grid (380 of 14,860).
// The office's enter measures reach as "within the extent" (pointWithinMark), so
// each of those walkers was refused at the mark they had just arrived at, and a
// walk with enter_on_arrival could not be entered at arrival.
//
// THE RULE NOW (walk.mjs § pointOnGround, § walkTargetFor): an arrival is
// rounded inward, never out; an arrival with no box stands exactly on its
// `toward`; a ring whose anchor is off its ground is walked to its nearest bank.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { positionAt, walkTargetFor, extentForArrival, pointOnGround } from "./walk.mjs";
import { pointWithinMark } from "./world-verbs.mjs";

const WORLD = JSON.parse(readFileSync(new URL("../WORLD/world-state.json", import.meta.url), "utf8"));
const SITED = (WORLD.marks ?? []).filter((m) => m.kind === "sited" && m.at && m.extent);

/** Where a walk from `from` to mark `m` stands once it has arrived, as the office declares it. */
function arrivalAt(m, from, mode) {
  let toward = { x: m.at.x, y: m.at.y };
  let targetExtent = extentForArrival(mode, { w: m.extent.w, h: m.extent.h });
  const ringed = walkTargetFor(m, from, mode);
  if (ringed) { toward = ringed.toward; targetExtent = null; }
  const p = positionAt({ from, toward, at: 100, targetExtent, targetMarkId: m.id, pace: 60 }, 1e6);
  return { p, ringed: !!ringed };
}

/** Every sited mark, twenty roads each from a seeded scatter 50 m to 3 km out. */
function probe(marks, mode) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = { walks: 0, outside: [] };
  for (const m of marks) {
    for (let k = 0; k < 20; k++) {
      const ang = rnd() * 2 * Math.PI, d = 50 + rnd() * 3000;
      const from = { x: Math.round((m.at.x + Math.cos(ang) * d) * 10) / 10, y: Math.round((m.at.y + Math.sin(ang) * d) * 10) / 10 };
      const { p } = arrivalAt(m, from, mode);
      assert.equal(p.arrived, true);
      out.walks += 1;
      if (!pointWithinMark({ x: p.x, y: p.y }, m)) out.outside.push({ id: m.id, from, at: { x: p.x, y: p.y } });
    }
  }
  return out;
}

test("THE PROBE · every rim walk to every sited mark in the world arrives ON the mark", () => {
  const r = probe(SITED, "rim");
  assert.ok(r.walks > 10_000, `the world must actually be probed (${r.walks} walks)`);
  assert.deepEqual(r.outside.slice(0, 5), [], `${r.outside.length} of ${r.walks} rim arrivals stand outside their mark`);
});

test("THE PROBE · and every center walk", () => {
  const r = probe(SITED, "center");
  assert.deepEqual(r.outside.slice(0, 5), [], `${r.outside.length} of ${r.walks} center arrivals stand outside their mark`);
});

// The same, on a fixed sample that does not move with the world: the register
// entries smaller than the grid, a box on the half-tenth, and the two rivers'
// shape in miniature.
const FIXTURES = [
  { id: "t/register-entry", kind: "sited", at: { x: 2422.02, y: 5592.68 }, extent: { w: 0.02, h: 0.02 } },
  { id: "t/margin-line", kind: "sited", at: { x: 2421.7, y: 5590.2335 }, extent: { w: 0.08, h: 0.004 } },
  { id: "t/cone", kind: "sited", at: { x: 221.05, y: 95.55 }, extent: { w: 0.5, h: 0.5 } },
  { id: "t/hall", kind: "sited", at: { x: 1000.05, y: -40.05 }, extent: { w: 30.1, h: 12.3 } },
  // a bent river: its box's middle (the anchor) is dry land between the bends
  { id: "t/river", kind: "sited", at: { x: 0, y: 0 }, extent: { w: 400, h: 400 },
    points: [[-200, -200], [-160, -200], [-160, 160], [160, 160], [160, -200], [200, -200], [200, 200], [-200, 200]] },
];

test("THE FIXTURES · marks smaller than the grid, boxes on the half-tenth and a river whose anchor is dry all arrive on their ground, both modes", () => {
  const r = { rim: probe(FIXTURES, "rim"), center: probe(FIXTURES, "center") };
  assert.equal(r.rim.walks, 100);
  assert.deepEqual(r.rim.outside, []);
  assert.deepEqual(r.center.outside, []);
});

test("pointOnGround · inward, never outward: the tenth-metre point when one fits, a finer one when the box is smaller, never off the box", () => {
  const box = { x: 221.05, y: 95.55, w: 0.5, h: 0.5 };   // 220.8 .. 221.3
  assert.deepEqual(pointOnGround({ x: 221.3, y: 95.33 }, box), { x: 221.3, y: 95.3 }, "on the edge: the grid point on the box");
  assert.deepEqual(pointOnGround({ x: 220.79999999, y: 95.5 }, box), { x: 220.8, y: 95.5 });
  const tiny = { x: 2422.02, y: 5592.68, w: 0.02, h: 0.02 };   // no tenth, no hundredth strictly inside the x range but 2422.01..2422.03
  const q = pointOnGround({ x: 2422.01, y: 5592.67 }, tiny);
  assert.ok(Math.abs(q.x - 2422.01) < 1e-9 && Math.abs(q.y - 5592.67) < 1e-9, JSON.stringify(q));
  assert.ok(q.x >= tiny.x - tiny.w / 2 && q.x <= tiny.x + tiny.w / 2 && q.y >= tiny.y - tiny.h / 2 && q.y <= tiny.y + tiny.h / 2);
});

test("a walker who has NOT arrived keeps the tenth-metre rounding, and the leg's arithmetic is unchanged", () => {
  const p = positionAt({ from: { x: 0, y: 0 }, toward: { x: 1000, y: 0 }, at: 100, targetExtent: { w: 20, h: 20 }, pace: 60 }, 100 + 0.0012345);
  assert.equal(p.arrived, false);
  assert.equal(p.x, Math.round(0.0012345 * 60000 * 10) / 10);
  assert.equal(p.remainingM, Math.round(990 - 0.0012345 * 60000));
});
