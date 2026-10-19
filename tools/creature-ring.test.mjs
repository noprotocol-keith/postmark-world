// creature-ring.test.mjs — WLD-82 (RULED by Darko 2026-10-19 17:09): each live
// creature's awareness ring, at its kind's ring_m, as a faint dotted circle in
// the creature's red, wearing the map's one faint-ring style (the expired
// conversation's line), never a copy of it. The office's find row carries the
// ring_m (office WLD-82 part 1 of 2); no ring_m, no ring.
// Run: node --test tools/creature-ring.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creatureRingSVG, liveCreaturesFrom } from "../spectator/viewer.mjs";

const SOURCE = readFileSync(new URL("../spectator/viewer.mjs", import.meta.url), "utf8");
// a CSS rule by its exact selector, at the start of a line
const escRe = (t) => t.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
const rule = (sel) => (SOURCE.match(new RegExp("^" + escRe(sel) + " \\{[^}]*\\}", "m")) ?? [""])[0];

test("the find row's ring_m rides through to the page's creature; none when the office sends none", () => {
  const [wolf, bat] = liveCreaturesFrom({ found: { creatures: [
    { id: "creature:wolf-259-1", kind: "wolf", name: "a grey wolf", at: { x: 10, y: 20 }, ring_m: 80 },
    { id: "creature:bat-259-1", kind: "bat", at: { x: 0, y: 0 } },
  ] } });
  assert.equal(wolf.ring_m, 80);
  assert.equal("ring_m" in bat, false, "no field, no ring");
});

test("the ring is the kind's ring_m in painting pixels, centred on the creature", () => {
  assert.equal(creatureRingSVG({ at: { x: 100, y: 200 }, ringM: 80, mPerPx: 5 }),
    '<circle cx="100" cy="200" r="16" class="wv-faint-ring ov-creature-aware"/>');
  assert.equal(creatureRingSVG({ at: { x: 100, y: 200 }, ringM: undefined, mPerPx: 5 }), "", "no ring_m, no ring");
  assert.equal(creatureRingSVG({ at: { x: 100, y: 200 }, ringM: 80, mPerPx: 0 }), "", "no scale, no ring");
  assert.equal(creatureRingSVG({ at: { x: "x", y: 0 }, ringM: 80, mPerPx: 5 }), "", "no point, no ring");
});

test("ONE faint-ring style: the expired conversation's dotted line, worn by the ring in the creature's red", () => {
  const shared = rule(".wv-faint-ring, .wv-convo");
  assert.match(shared, /stroke-dasharray:3 4;/, "dotted, as an expired conversation is");
  assert.match(shared, /stroke-width:1\.5;/);
  assert.doesNotMatch(rule(".wv-convo"), /stroke-dasharray/, "the conversation's own rule carries no second copy of the line");
  const aware = rule(".ov-creature-aware");
  assert.match(aware, /stroke:#d8706a;/, "the creature's own red (its token's rim)");
  assert.doesNotMatch(aware, /dasharray|stroke-width/, "the line is the shared one, not a copy");
  assert.match(rule(".wv-convo.is-live"), /stroke-dasharray:none;/, "a live conversation still breathes solid");
});

test("[pin] the page draws each creature's ring under the tokens, from its own ring_m", () => {
  assert.match(SOURCE, /rings \+= creatureRingSVG\(\{ at: px\(\{ x: c\.x, y: c\.y \}\), ringM: c\.ring_m, mPerPx: mapCtx\?\.mPerPx \}\);/);
  assert.match(SOURCE, /return rings \+ out;/, "rings first: under every token");
});
