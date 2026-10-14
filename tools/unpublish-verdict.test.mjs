// unpublish-verdict.test.mjs — the one unpublish rule, case by case (postmark#3757).
//
// The sweep and the office's stakes warning both read this function, so every
// sentence a household is told about the next settlement is one of these rows.

import test from "node:test";
import assert from "node:assert/strict";
import { STALE_ROWS, UNPUBLISH_RULE, rowClassOf, unpublishVerdict } from "./unpublish-verdict.mjs";

const commons = { household: "house-of-many-doors", class: "commons", path: "WORLD/marks/let-there-be-light/the-uphill-firepit/mark.md" };

test("the dial stands at today's rule until WLD-51 is ruled", () => {
  assert.equal(STALE_ROWS, "skip");
  assert.match(UNPUBLISH_RULE, /registered path is on main/, "the rule's words name all three conditions");
  assert.equal(rowClassOf("market"), "commons");
  assert.equal(rowClassOf("home"), "home");
});

test("the three conditions, as the sweep has always asked them", () => {
  assert.deepEqual(unpublishVerdict({ ...commons, class: "home" }, { escrow: 0, pathOnMain: true }), { unpublish: false, why: "not-commons" });
  assert.deepEqual(unpublishVerdict({ ...commons, class: "constitution" }, { escrow: 0, pathOnMain: true }), { unpublish: false, why: "not-commons" });
  assert.deepEqual(unpublishVerdict(commons, { escrow: 2, pathOnMain: true }), { unpublish: false, why: "backed" });
  assert.deepEqual(unpublishVerdict(commons, { escrow: 0, pathOnMain: true }), { unpublish: true, why: "commons-unbacked", path: commons.path });
});

test("kinofire's firepit: a commons row whose path is not on main is not swept today", () => {
  assert.deepEqual(unpublishVerdict(commons, { escrow: 0, pathOnMain: false }), { unpublish: false, why: "stale-path" });
});

test("an input not measured is never a no: escrow or path unread answers null", () => {
  assert.deepEqual(unpublishVerdict(commons, { escrow: null, pathOnMain: true }), { unpublish: null, why: "escrow-unread" });
  assert.deepEqual(unpublishVerdict(commons, { escrow: 0, pathOnMain: null }), { unpublish: null, why: "path-unread" });
  assert.deepEqual(unpublishVerdict(commons, { escrow: 0 }), { unpublish: null, why: "path-unread" }, "the default is unread, not absent");
});

test("the path is asked only when the answer turns on it", () => {
  let asked = 0;
  const pathOnMain = () => { asked += 1; return true; };
  unpublishVerdict({ ...commons, class: "home" }, { escrow: 0, pathOnMain });
  unpublishVerdict(commons, { escrow: 1, pathOnMain });
  assert.equal(asked, 0, "a home row and a backed row cost no git read, as in the sweep before");
  unpublishVerdict(commons, { escrow: 0, pathOnMain });
  assert.equal(asked, 1);
});

test("\"rederive\" (WLD-51's other branch): a stale row is judged by where and what the mark is now", () => {
  const stale = { escrow: 0, pathOnMain: false, staleRows: "rederive" };
  assert.deepEqual(unpublishVerdict(commons, { ...stale, standing: "home", currentPath: "x" }), { unpublish: false, why: "rederived-not-commons" },
    "the fireplace derives home: never swept, whatever the row says");
  assert.deepEqual(unpublishVerdict(commons, { ...stale, standing: "market", currentPath: "WORLD/marks/lupi/rootwood-bookend/mark.md" }),
    { unpublish: true, why: "rederived-commons-unbacked", path: "WORLD/marks/lupi/rootwood-bookend/mark.md" },
    "a market mark at zero escrow is swept from where it is filed now");
  assert.deepEqual(unpublishVerdict(commons, { ...stale, standing: null }), { unpublish: false, why: "not-standing" }, "a row for a mark that is gone takes nothing");
  assert.deepEqual(unpublishVerdict(commons, { ...stale }), { unpublish: null, why: "standing-unread" });
  assert.deepEqual(unpublishVerdict(commons, { ...stale, standing: "market", currentPath: null }), { unpublish: null, why: "filing-unread" });
  assert.deepEqual(unpublishVerdict(commons, { ...stale, standing: "market", currentPath: "x", pathOnMain: true }),
    { unpublish: true, why: "commons-unbacked", path: commons.path }, "a row whose path IS on main is untouched by the dial");
  assert.throws(() => unpublishVerdict(commons, { escrow: 0, pathOnMain: false, staleRows: "sweep-everything" }), /unknown STALE_ROWS/);
});
