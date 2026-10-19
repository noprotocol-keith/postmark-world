// creature-far-token.test.mjs — play fix 49 (Darko, playground 2026-10-15
// 21:10): "a creature icon that replaces any specific art for creatures the
// same way that the blank resident kind of replaces any resident profile
// pictures at far zoom." At far a creature is the plain token: the walker's
// far size and legs, pastel red, no kind's silhouette. The silhouette shows
// only at the zooms where a resident's picture shows (mid and near).
// Run: node --test tools/creature-far-token.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creatureGlyphSVG, walkerFrameSVG, CREATURE_GLYPH, WALKER_FRAME } from "../spectator/viewer.mjs";

const SOURCE = readFileSync(new URL("../spectator/viewer.mjs", import.meta.url), "utf8");
const wolf = { id: "creature:wolf-1", kind: "wolf", name: "a grey wolf" };
const at = { x: 100, y: 200 };
const sil = { d: "M 10 10 L 90 90 Z" };
const legs = (svg, cls) => [...svg.matchAll(new RegExp(`<line ([^>]*) class="${cls}"`, "g"))].map((m) => m[1]);

test("far: the plain token, no silhouette even when one is handed in", () => {
  const svg = creatureGlyphSVG({ creature: wolf, at, silhouette: sil, plain: true });
  assert.match(svg, /class="ov-creature is-plain ov-creature-wolf"/);
  assert.doesNotMatch(svg, /ov-creature-art|clipPath/);
  assert.match(svg, new RegExp(`class="ov-creature-disc"`));
  assert.match(svg, new RegExp(`r="${WALKER_FRAME.far / 2}" class="ov-creature-disc"`), "the walker's far size");
});

test("the plain token is the blank walker's body: the same circle and the same two legs", () => {
  const plain = creatureGlyphSVG({ creature: wolf, at, plain: true });
  const blank = walkerFrameSVG({ at, handle: "someone" });
  assert.deepEqual(legs(plain, "ov-creature-leg"), legs(blank, "wv-walker-leg"));
  assert.equal(CREATURE_GLYPH.plainSize, WALKER_FRAME.far);
  assert.equal(CREATURE_GLYPH.plainLeg, WALKER_FRAME.legFar);
});

test("mid and near: the full token with the kind's silhouette, as before", () => {
  const svg = creatureGlyphSVG({ creature: wolf, at, silhouette: sil });
  assert.doesNotMatch(svg, /is-plain/);
  assert.match(svg, /class="ov-creature-art"/);
  assert.match(svg, new RegExp(`r="${WALKER_FRAME.near / 2}" class="ov-creature-disc"`));
});

test("pins: the painting asks for the plain token exactly at the far tier", () => {
  assert.match(SOURCE, /const plain = tier === "far";\s*out \+= creatureGlyphSVG\(\{ creature: c, at: px\(\{ x: c\.x, y: c\.y \}\), silhouette: plain \? null : creatureSilhouette\(c\.kind\),/);
  assert.match(SOURCE, /if \(tier === "far"\) \{\s*for \(const w of bodies\)/, "the tier where the walker goes blank");
});
