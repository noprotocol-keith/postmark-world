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
import { creatureGlyphSVG, chooserLeadLine, tokenPileAtPoint, walkerHoverId } from "../spectator/viewer.mjs";

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

test("a click on the pile offers every token in it, nearest first, even past the snap radius", () => {
  // the encounter's three: wolf 8 m E, bat 8 m S, raven 8 m W of V, drawn as overlapping tokens
  const V = { id: walkerHoverId("visitor"), x: 400, y: 300 };
  const wolf = { id: "creature:wolf-1", x: 416, y: 300 }, bat = { id: "creature:bat-1", x: 400, y: 316 }, raven = { id: "creature:raven-1", x: 384, y: 300 };
  const far = { id: "creature:wolf-2", x: 520, y: 300 };
  const pile = tokenPileAtPoint({ x: 416, y: 300 }, [V, wolf, bat, raven, far], { touchPx: 24 });
  assert.deepEqual(pile, ["creature:wolf-1", V.id, "creature:bat-1", "creature:raven-1"], "the raven, 32 px from the click, is in it");
  assert.ok(!pile.includes(far.id), "a token that touches nothing in the pile is not in it");
  assert.deepEqual(tokenPileAtPoint({ x: 0, y: 0 }, [V, wolf]), [], "a click on nothing is no pile");
  assert.deepEqual(tokenPileAtPoint({ x: 520, y: 300 }, [V, wolf, far]), [far.id], "one token alone is just itself");
});

test("the chooser names creatures as creatures", () => {
  assert.equal(chooserLeadLine(["creature:wolf-1", "creature:bat-1", "creature:raven-1"]), "3 creatures are here — which one?");
  assert.equal(chooserLeadLine([walkerHoverId("visitor"), "creature:wolf-1", "creature:bat-1"]), "1 resident and 2 creatures are here — which one?");
  assert.equal(chooserLeadLine([walkerHoverId("visitor"), "creature:wolf-1", "the-town/a-stone"]), "1 resident, 1 creature and 1 mark are here — which one?");
  assert.equal(chooserLeadLine(["the-town/a", "the-town/b"]), "2 marks are stacked here — which one?", "a pile of marks reads as it always did");
});

test("pins: the people click asks for the whole pile, one token's width read off a drawn token", () => {
  assert.match(SOURCE, /const peopleHere = tokenPileAtPoint\(\{ x: e\.clientX, y: e\.clientY \}, \[\.\.\.screenWalkerCandidates\(\), \.\.\.screenCreatureCandidates\(\)\],\s*\{ touchPx: disc\?\.width > 0 \? disc\.width : 24 \}\);/);
});

test("pins: the chooser files creatures under their own label, never \"other marks\"", () => {
  assert.match(SOURCE, /isCreature: isCreatureId \}\);/);
  assert.match(SOURCE, /section\("creatures", groups\.creatures\)/);
});
