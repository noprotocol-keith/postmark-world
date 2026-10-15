// creature-law.test.mjs — the creature class and its three kinds, as the law stands (WLD-56).
//
// DRAFT with the class marks and kind files: their words and numbers are pending
// Darko's D1, D2, D4 and D6. What this holds is the shape the rulings fill in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarks } from "./marks-fold.mjs";
import { readKind } from "./creature-kind.mjs";
import { DESPAWN_REASONS } from "./creatures.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const marks = loadMarks(join(ROOT, "WORLD", "marks"));
const byClass = (c) => marks.find((m) => m.kind === "class" && m.by === "the-town" && String(m.class) === c);
const KINDS = ["wolf", "raven", "bat"];

test("the creature class: a living node, live canon, two ways to leave, and off by default", () => {
  const c = byClass("creature");
  assert.ok(c, "the-town/creature stands in the works");
  assert.equal(c.id, "the-town/creature");
  assert.equal(c.extends, "entity", "a creature is an entity: it lives");
  assert.equal(c.canon, "live");
  assert.deepEqual(c.despawn, [...DESPAWN_REASONS]);
  assert.deepEqual(c.actions, [], "no verbs of its own");
  assert.equal(c.dials.from_crossing, null, "the launch dial is off: nothing spawns until the town says so");
});

test("the three kinds: each a class extending creature, whose kind file is its law and names it", () => {
  for (const k of KINDS) {
    const m = byClass(k);
    assert.ok(m, `the-town/${k} stands in the works`);
    assert.equal(m.extends, "creature");
    assert.ok(Number.isInteger(m.dials.count_per_window) && m.dials.count_per_window > 0, `${k} has a count per window`);
    assert.equal(m.kind_file, `WORLD/kinds/${k}.kind`);
    assert.ok(existsSync(join(ROOT, m.kind_file)), `${m.kind_file} is there`);
    const kind = readKind(join(ROOT, m.kind_file));
    assert.equal(kind.kind, k, "the kind file names its class");
    assert.equal(kind.span_h, 12, "a creature lasts 12 h (ruled)");
    assert.ok(kind.reactions.some((r) => r.effects.some((e) => e.do === "flee")), `${k} can flee`);
    assert.ok(kind.reactions.some((r) => r.src.trim() === "true"), `${k} always has something to do`);
  }
});
