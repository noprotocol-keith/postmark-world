// no-clump.test.mjs — play row 55 (encounter run, 21:1x): three creature
// tokens within 8 m drew as one clump that covered V, and clicking it said "2
// marks are stacked here — which one?", missing the raven and calling creatures
// marks. Residents and creatures never hide each other now (each creature takes
// a free seat beside its own place, the residents never move), so every token
// is reached by its own click; and the chooser names creatures as creatures.
// Run: node --test tools/no-clump.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seatCreatureTokens, chooserLeadLine, walkerHoverId } from "../spectator/viewer.mjs";

const SOURCE = readFileSync(new URL("../spectator/viewer.mjs", import.meta.url), "utf8");
const sep = 28;
const apart = (pts) => { for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < sep - 1e-6) return false; return true; };

test("the encounter's clump: V and three creatures within a token of each other all come apart", () => {
  const V = { x: 100, y: 100 };
  const creatures = [{ id: "creature:wolf-1", x: 104, y: 100 }, { id: "creature:bat-1", x: 100, y: 104 }, { id: "creature:raven-1", x: 96, y: 100 }];
  const seats = seatCreatureTokens(creatures, [V], sep);
  assert.equal(seats.size, 3);
  assert.ok(apart([V, ...seats.values()]), "no token sits on another, the resident's included");
  for (const c of creatures) assert.ok(Math.hypot(seats.get(c.id).x - c.x, seats.get(c.id).y - c.y) <= sep * 3 + 1e-6, "each stays close to where it stands");
});

test("the resident never moves; a creature with room keeps its own place; the seats hold across draws", () => {
  const creatures = [{ id: "creature:wolf-1", x: 300, y: 300 }, { id: "creature:bat-1", x: 102, y: 100 }];
  const seats = seatCreatureTokens(creatures, [{ x: 100, y: 100 }], sep);
  assert.deepEqual(seats.get("creature:wolf-1"), { x: 300, y: 300 });
  assert.notDeepEqual(seats.get("creature:bat-1"), { x: 102, y: 100 });
  assert.deepEqual(seatCreatureTokens([...creatures].reverse(), [{ x: 100, y: 100 }], sep), seats, "the same seats whatever order they arrive in");
});

test("the chooser names creatures as creatures", () => {
  assert.equal(chooserLeadLine(["creature:wolf-1", "creature:bat-1", "creature:raven-1"]), "3 creatures are here — which one?");
  assert.equal(chooserLeadLine([walkerHoverId("visitor"), "creature:wolf-1", "creature:bat-1"]), "1 resident and 2 creatures are here — which one?");
  assert.equal(chooserLeadLine([walkerHoverId("visitor"), "creature:wolf-1", "the-town/a-stone"]), "1 resident, 1 creature and 1 mark are here — which one?");
  assert.equal(chooserLeadLine(["creature:wolf-1", "the-town/a-stone"]), "1 creature and 1 mark are here — which one?");
  assert.equal(chooserLeadLine(["the-town/a", "the-town/b"]), "2 marks are stacked here — which one?", "a pile of marks reads as it always did");
});

test("pins: the creature layer draws each token at its seat", () => {
  assert.match(SOURCE, /const seats = seatCreatureTokens\(shown\.map\(\(c\) => \(\{ id: c\.id, \.\.\.px\(\{ x: c\.x, y: c\.y \}\) \}\)\), residents, sep\);/);
  assert.match(SOURCE, /creatureGlyphSVG\(\{ creature: c, at: seats\.get\(c\.id\) \?\? px\(/);
  assert.match(SOURCE, /const sep = \(\(tier === "far" \? CREATURE_GLYPH\.plainSize : CREATURE_GLYPH\.size\) \+ 6\) \/ markerScale\(mapCtx\?\.zoomK\);/);
});
