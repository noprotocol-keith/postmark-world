// no-clump.test.mjs — play row 55, as RULED (Darko 2026-10-16 17:36): "we're
// not doing any kind of no clumping rule … The tokens should stay in their
// correct geometric positions. And we already have code … that asks you which
// one did you mean to click on." So no token is moved, at any zoom, and a click
// on a pile opens the chooser with every token in it, creatures named as
// creatures. (The seating fix 55 first shipped drifted as he zoomed: its ring
// was in screen pixels.)
// Run: node --test tools/no-clump.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creatureGlyphSVG, chooserLeadLine, contestedMarksAtPoint, MARK_SNAP_RADIUS_PX, walkerHoverId } from "../spectator/viewer.mjs";

const SOURCE = readFileSync(new URL("../spectator/viewer.mjs", import.meta.url), "utf8");
const layer = SOURCE.slice(SOURCE.indexOf("  function liveCreatureGlyphs(px, tier) {"), SOURCE.indexOf("  function creatureNameplateHTML(id) {"));

test("a stacked trio draws at its true points: one place, three tokens, nothing moved", () => {
  const at = { x: 380.2, y: -537 };
  for (const kind of ["wolf", "raven", "bat"])
    assert.match(creatureGlyphSVG({ creature: { id: `creature:${kind}-253-play1`, kind }, at }), /^<g transform="translate\(380\.2 -537\)">/);
  assert.match(layer, /out \+= creatureGlyphSVG\(\{ creature: c, at: px\(\{ x: c\.x, y: c\.y \}\),/, "the token's own point, from the record");
  assert.doesNotMatch(SOURCE, /seatCreatureTokens|seats\.get\(/, "no seating anywhere");
  assert.doesNotMatch(layer, /markerScale|walkState\.walkers/, "nothing on screen moves a creature");
});

test("the chooser offers every clickable under the cursor, no kind special-cased (Darko 17:37)", () => {
  // the live trio stacked at one point beside darko: all three are under the cursor
  const darko = { id: walkerHoverId("darko"), x: 752, y: 630 };
  const trio = ["wolf", "raven", "bat"].map((k) => ({ id: `creature:${k}-253-play1`, x: 760, y: 630 }));
  const away = { id: "creature:wolf-252-play2", x: 760 + MARK_SNAP_RADIUS_PX + 30, y: 630 };
  const here = contestedMarksAtPoint({ x: 760, y: 630 }, [darko, ...trio, away]);
  assert.deepEqual([...here].sort(), [darko.id, ...trio.map((t) => t.id)].sort(), "darko and all three");
  assert.ok(!here.includes(away.id), "a token that is not under the cursor is not offered");
});

test("the chooser names creatures as creatures", () => {
  assert.equal(chooserLeadLine(["creature:wolf-1", "creature:bat-1", "creature:raven-1"]), "3 creatures are here — which one?");
  assert.equal(chooserLeadLine([walkerHoverId("visitor"), "creature:wolf-1", "creature:bat-1"]), "1 resident and 2 creatures are here — which one?");
  assert.equal(chooserLeadLine([walkerHoverId("visitor"), "creature:wolf-1", "the-town/a-stone"]), "1 resident, 1 creature and 1 mark are here — which one?");
  assert.equal(chooserLeadLine(["the-town/a", "the-town/b"]), "2 marks are stacked here — which one?", "a pile of marks reads as it always did");
});

test("pins: the people click takes what is under the cursor, the same snap every mark uses", () => {
  assert.match(SOURCE, /const peopleHere = contestedMarksAtPoint\(\{ x: e\.clientX, y: e\.clientY \}, \[\.\.\.screenWalkerCandidates\(\), \.\.\.screenCreatureCandidates\(\)\]\);/);
  assert.doesNotMatch(SOURCE, /tokenPileAtPoint/, "no pile grown past the cursor");
});

test("pins: the chooser files creatures under their own label, never \"other marks\"", () => {
  assert.match(SOURCE, /isCreature: isCreatureId \}\);/);
  assert.match(SOURCE, /section\("creatures", groups\.creatures\)/);
});
