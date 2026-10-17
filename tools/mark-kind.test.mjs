// mark-kind.test.mjs — what a record is and how it stands, in either form (LOGOS v2 part 2, W2).
//
//   - isPredicate follows the lineage: predicated, predicate (G10) and naming
//     (naming extends predicate, as the site's helper reads it). It is asked of
//     the record's kind, so a class or property node is never one: not even the
//     predicate class's own declaration.
//   - instanceClassOf reads the old form's `class:` and the new form's `kind:`.
//   - THE FOUR (O1's compare, 2026-10-17): the town charters and the wheelhouse
//     write `kind: town` / `kind: timetable` now, and keep their containment,
//     because G13 put both classes under sited and the fold asks the place.

import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isPredicate, instanceClassOf, isSited, isGround } from "./mark-kind.mjs";
import { loadMarks, containmentParents } from "./marks-fold.mjs";
import { classIndex, classChain } from "./class-properties.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("isPredicate: predicated, predicate and naming; never a class or property node", () => {
  for (const kind of ["predicated", "predicate", "naming"]) assert.equal(isPredicate({ kind }), true, kind);
  assert.equal(isPredicate({ kind: "class", class: "predicate" }), false, "the predicate class's declaration is not an instance predicate");
  assert.equal(isPredicate({ kind: "class", class: "naming" }), false);
  assert.equal(isPredicate({ kind: "property", name: "slot" }), false);
  for (const kind of ["sited", "parcel", "thing", undefined]) assert.equal(isPredicate({ kind }), false, String(kind));
});

test("instanceClassOf: the old form's class:, the new form's kind:, nothing for standing words and class space", () => {
  assert.equal(instanceClassOf({ kind: "sited", class: "thing" }), "thing");
  assert.equal(instanceClassOf({ kind: "thing" }), "thing");
  for (const kind of ["sited", "parcel", "predicated", "predicate", "naming"]) assert.equal(instanceClassOf({ kind }), undefined, kind);
  assert.equal(instanceClassOf({ kind: "class", class: "thing" }), undefined, "a class node IS the class");
  assert.equal(instanceClassOf({ kind: "property", name: "holder" }), undefined);
});

test("isSited and isGround ask the place, which the lint holds to sited's (and post's) classes", () => {
  const at = { x: 0, y: 0 }, extent = { w: 1, h: 1 };
  assert.equal(isSited({ kind: "thing", at, extent }), true);
  assert.equal(isSited({ kind: "sited", class: "thing", at, extent }), true);
  assert.equal(isSited({ kind: "parcel", at }), false);
  assert.equal(isGround({ kind: "parcel", at }), true);
  assert.equal(isSited({ kind: "predicate", at }), false, "a claim never stands on ground");
  assert.equal(isSited({ kind: "thing" }), false, "no place, no ground");
});

test("THE FOUR keep their containment in the new form: town and timetable stand under sited", () => {
  const marks = loadMarks(join(ROOT, "WORLD/marks"));
  const idx = classIndex(marks);
  const { parent } = containmentParents(marks);
  const want = {
    "the-town/postmark": ["town", "the-town/the-long-run-harbor"],
    "the-town/1f3d9": ["town", "the-town/the-long-run-harbor"],
    "the-town/1f916": ["town", "the-town/the-long-run-harbor"],
    "the-town/the-wheelhouse": ["timetable", "the-town/the-post-office"],
  };
  for (const [id, [klass, container]] of Object.entries(want)) {
    const m = marks.find((x) => x.id === id);
    assert.ok(m, `${id} stands`);
    assert.equal(instanceClassOf(m), klass);
    assert.ok(classChain(idx, klass).some((c) => c.class === "sited"), `${klass} is under sited (G13)`);
    assert.ok(isSited(m), `${id} is ground`);
    assert.equal(parent.get(id), container, `${id} is contained by ${container}, as on main`);
  }
});
