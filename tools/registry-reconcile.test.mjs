// registry-reconcile.test.mjs — the registry's rows follow their marks, in the
// safe direction only (postmark#3757).

import test from "node:test";
import assert from "node:assert/strict";
import { applyPlan, reconcilePlan } from "./registry-reconcile.mjs";

const plan = (published, filings, tiers) => reconcilePlan(published, {
  filingOf: (id) => filings[id] ?? null,
  tierOf: (id) => tiers[id],
});

test("kinofire's fireplace: a stale commons row for a home mark is repaired, path and class", () => {
  const p = plan(
    { "kinofire/the-too-big-fireplace": { household: "hh", path: "WORLD/marks/let-there-be-light/the-too-big-fireplace/mark.md", class: "commons" } },
    { "kinofire/the-too-big-fireplace": "WORLD/marks/kinofire/spin-ghar-manor/the-too-big-fireplace/mark.md" },
    { "kinofire/the-too-big-fireplace": "home" });
  assert.deepEqual(p.repairs.map((r) => [r.id, r.to, r.why]), [["kinofire/the-too-big-fireplace",
    { path: "WORLD/marks/kinofire/spin-ghar-manor/the-too-big-fireplace/mark.md", class: "home" }, "path and class"]]);
  assert.deepEqual([p.held, p.removed, p.unresolved], [[], [], []]);
});

test("a home mark under a commons row at its own path is repaired to home (the sweep could have taken it)", () => {
  const p = plan({ "keith/the-garage": { household: "h", path: "WORLD/marks/keith/the-garage/mark.md", class: "commons" } },
    { "keith/the-garage": "WORLD/marks/keith/the-garage/mark.md" }, { "keith/the-garage": "home" });
  assert.deepEqual(p.repairs.map((r) => [r.to.class, r.why]), [["home", "class"]]);
});

test("WLD-51: a repair that would make a zero-escrow commons mark newly sweepable is HELD, never written", () => {
  const p = plan({
    // a market mark whose stale path keeps the sweep away today
    "lupi/rootwood-bookend": { household: "h", path: "WORLD/marks/let-there-be-light/rootwood-bookend/mark.md", class: "commons" },
    // a home row whose mark now derives market
    "berthillon/a-cone": { household: "h", path: "WORLD/marks/berthillon/a-cone/mark.md", class: "home" },
  }, {
    "lupi/rootwood-bookend": "WORLD/marks/lupi/rootwood-bookend/mark.md",
    "berthillon/a-cone": "WORLD/marks/berthillon/a-cone/mark.md",
  }, { "lupi/rootwood-bookend": "market", "berthillon/a-cone": "market" });
  assert.deepEqual(p.held.map((r) => r.id), ["lupi/rootwood-bookend", "berthillon/a-cone"]);
  assert.match(p.held[0].why, /WLD-51/);
  assert.deepEqual(p.repairs, []);
});

test("a commons row already at its mark's path, the mark still market, is left alone (nothing to repair, nothing new to sweep)", () => {
  const p = plan({ "a/b": { household: "h", path: "WORLD/marks/a/b/mark.md", class: "commons" } }, { "a/b": "WORLD/marks/a/b/mark.md" }, { "a/b": "market" });
  assert.deepEqual([p.repairs, p.held, p.removed, p.unresolved], [[], [], [], []]);
});

test("a commons row whose stored path is no longer its market mark's file is HELD: the sweep does not take it today, so following the file would be new", () => {
  const p = plan({ "a/b": { household: "h", path: "WORLD/marks/a/b/mark.md", class: "commons" } }, { "a/b": "WORLD/marks/x/a-b/mark.md" }, { "a/b": "market" });
  assert.deepEqual(p.held.map((r) => r.id), ["a/b"], "the stored path no longer IS the file, so it is not swept today; repairing it would be new");
});

test("a row for a mark that is gone is removed; a standing mark with no single filing is unresolved and left", () => {
  const p = plan({
    "the-town/departure": { household: "t", path: "WORLD/marks/x/departure/mark.md", class: "constitution" },
    "a/twice": { household: "h", path: "WORLD/marks/a/twice/mark.md", class: "home" },
    "a/stale-state": { household: "h", path: "WORLD/marks/a/stale-state/mark.md", class: "home" },
  }, { "a/stale-state": "WORLD/marks/a/stale-state/mark.md" }, { "a/twice": "home" });
  assert.deepEqual(p.removed.map((r) => r.id), ["the-town/departure"]);
  assert.deepEqual(p.unresolved.map((r) => r.id), ["a/twice", "a/stale-state"]);
});

test("applyPlan writes repairs and removals only; held and unresolved rows are byte-for-byte as they were", () => {
  const doc = { version: 1, published: {
    "k/f": { household: "h", path: "old", class: "commons" },
    "l/b": { household: "h", path: "old-b", class: "commons" },
    "t/d": { household: "t", path: "gone", class: "constitution" },
  } };
  const p = plan(doc.published, { "k/f": "new", "l/b": "new-b" }, { "k/f": "home", "l/b": "market" });
  const out = applyPlan(doc, p);
  assert.deepEqual(out.published["k/f"], { household: "h", path: "new", class: "home" });
  assert.deepEqual(out.published["l/b"], doc.published["l/b"], "held");
  assert.equal(out.published["t/d"], undefined, "removed");
  assert.equal(out.version, 1);
  assert.equal(doc.published["k/f"].path, "old", "the input is not mutated");
});
