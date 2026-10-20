// appearance-starter-set.test.mjs — the appearance class declares its starter
// set as its OPEN SLOTS (WLD-83; Darko 2026-10-20 08:46: "that's a great starter
// list"). `explain: "<class>"` answers `open` as the class's own sovereign
// properties (postmark-office class-read.mjs § explainClass: "the slots left to
// the maker"), so these marks are what `world { explain: "appearance" }` lists.
//
// The root's slot, `appearance`, is not among them: a property may not share
// its class's name (mark-lint G9), so the root is named in the class's own
// words ("its root slot appearance, the glance") — option A, settled by Wright.

import test from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarks } from "./marks-fold.mjs";
import { classIndex, ownProperties } from "./class-properties.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const marks = loadMarks(join(ROOT, "WORLD", "marks"));
const idx = classIndex(marks);
const klass = marks.find((m) => m.id === "the-town/appearance");

test("the class's open slots are the six of the starter set, each the maker's, each with a one-line meaning", () => {
  const open = ownProperties(idx, "the-town/appearance").filter((p) => (p.tier ?? "") === "sovereign");
  assert.deepEqual(open.map((p) => p.name).sort(), ["form", "manner", "pronouns", "sign", "voice", "wears"].sort());
  for (const p of open) {
    const line = String(p.body ?? "").trim();
    assert.ok(line.length > 0 && !line.includes("\n"), `${p.name} carries its meaning on one line`);
  }
});

test("the root is named in the class's own words, and no property shares the class's name (G9)", () => {
  assert.match(String(klass.body), /root slot appearance, the glance/);
  assert.equal(ownProperties(idx, "the-town/appearance").some((p) => p.name === "appearance"), false);
  assert.match(String(klass.body), /pronouns are the resident's own word, never inferred/i);
});
