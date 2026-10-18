// holdings-page.test.mjs — LOGOS v2 part 2 on the World page (POS-678): the
// pure half of spectator/holdings.mjs, against the office's own answer shapes.
//
// The shapes are the office train's (train/2026-w43 @ dd226dbd):
//   - the close look at a mark: world-kinds.mjs § investigateMark, merged into
//     the apex's `focus` as { holder: { capacity, open }, holds: { holder,
//     count, class, shows, kinds } }, with kinds sharpened (kind-holding.mjs §
//     blurOf, sharp: true);
//   - a resident's close look: world-apex.mjs § investigateOn, `holds` (whole
//     things) and `holds_by_kind`;
//   - your hands: world-hold.mjs § world_holdings, `holding: [{ thing }]` and `kinds`;
//   - the ground within reach: world-hold.mjs § groundRow, `holder` on a held thing;
//   - the say card: voices.mjs § conversations (`earshot_m`, `fade_minutes`,
//     `hearable_since`), and the say class's dials.
//
// ── THE CAN-FAIL FLIPS ─────────────────────────────────────────────────────
//   holderLines ignoring `kinds`                 → 1 reds
//   holderLines dropping holder.capacity/open    → 1 and 2 red
//   carriersFrom ignoring the ground's holder    → 4 reds
//   carriedAt using the thing's own `at`         → 4 and 5 red
//   a ground row with no holder that only sets    → 6 reds (the kite stays in her hands)
//   handsLines counting holding.length            → 3b reds
//   sayCardNote with the old "five minutes"      → 7 reds
//   isThingKind reading only cls === "thing"     → 8 reds

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  holderLines, residentHoldLines, handsLines, holdingParts,
  handsList, carriersFrom, carriedAt, carriedWords,
  sayCardNote, isThingKind,
} from "../spectator/holdings.mjs";

// the second bowl, as sb-cleo's close look gave it (PART2-MCP-QA.md K2), with a bag in it
const BOWL_FOCUS = {
  id: "sb-ash/a-halloween-bowl", body: "A second pumpkin bowl.",
  holder: { capacity: 30, open: true },
  holds: { holder: "sb-ash/a-halloween-bowl", count: 5, class: "thing", shows: "5 things",
    kinds: [{ kind: "candy", count: 4, shows: "4 candies" }] },
  can: ["take", "give"],
  class_pointer: 'kind: halloween-candy-bowl · a thing · a sited — explain: "halloween-candy-bowl"',
};

test("1. a holder's card: the blurred headline, its sharpened kinds, its whole things and its room", () => {
  const lines = holderLines(BOWL_FOCUS);
  assert.deepEqual(lines.kinds, [{ kind: "candy", count: 4, shows: "4 candies" }]);
  assert.equal(lines.whole, 1, "the bag is the one the kinds do not cover");
  assert.equal(lines.capacity, 30);
  assert.equal(lines.open, true);
  const parts = holdingParts(lines);
  assert.equal(parts.head, "5 things · 5 of 30", "the office's blur, then its room");
  assert.deepEqual(parts.items, ["4 candies", "1 whole thing"]);
  assert.match(parts.open, /^open: other households may give into it and take from it$/);
});

test("2. a closed holder says so; an empty one says nothing is in it; a mark that holds nothing has no block", () => {
  const closed = holderLines({ holder: { capacity: 5, open: false }, holds: { holder: "sb-cleo/a-locked-satchel", count: 2, class: "candy", shows: "2 candies", kinds: [{ kind: "candy", count: 2, shows: "2 candies" }] } });
  assert.equal(holdingParts(closed).open, "closed: only its maker's household may give into it or take from it");
  assert.equal(holdingParts(closed).head, "2 candies · 2 of 5");
  const empty = holderLines({ holder: { capacity: 10, open: true }, holds: { holder: "sb-ash/a-small-pouch", count: 0, class: null, shows: "empty" } });
  assert.equal(holdingParts(empty).head, "nothing · 0 of 10");
  assert.deepEqual(holdingParts(empty).items, []);
  assert.equal(holderLines({ id: "the-town/a-tree", body: "a tree" }), null, "no holds, no holding block");
  assert.equal(holderLines({ error: "bounce" }), null);
  assert.equal(holdingParts(null), null);
});

test("3. a resident's hands: their whole things by name and their kinds; your own hands from world_holdings", () => {
  const inv = residentHoldLines({ handle: "sb-ash", holds: ["sb-ash/a-candy-bag"],
    holds_by_kind: { holder: "sb-ash", count: 1, class: "candy", shows: "1 candy", kinds: [{ kind: "candy", count: 1, shows: "1 candy" }] } });
  assert.equal(inv.count, 2);
  const names = { "sb-ash/a-candy-bag": "A Candy Bag" };
  assert.deepEqual(holdingParts(inv, { nameOf: (id) => names[id] ?? id }).items, ["1 candy", "A Candy Bag"]);
  assert.equal(holdingParts(inv).head, "2 things", "kinds and whole things together are things");
  const mine = handsLines({ handle: "sb-cleo", count: 0, holding: [], kinds: { holder: "sb-cleo", count: 2, class: "candy", shows: "2 candies", kinds: [{ kind: "candy", count: 2, shows: "2 candies" }] } });
  assert.equal(holdingParts(mine).head, "2 candies", "the office's blur when kinds are the whole holding");
  assert.equal(holdingParts(handsLines({ holding: [], kinds: { count: 0, class: null, shows: "empty" } })).head, "nothing");
  assert.equal(handsLines({ error: "bounce", defect: "these are YOUR hands" }), null);
  assert.equal(residentHoldLines({ handle: "x" }), null, "a read that carried neither says nothing");
});

test("3b. your hands count what the door counted, not the page it sent (20 a page, 24 to carry)", () => {
  const page = Array.from({ length: 20 }, (_, i) => ({ thing: `sb-ash/thing-${i}` }));
  const lines = handsLines({ handle: "sb-ash", count: 23, shown: 20, limit: 20, offset: 0, complete: false, next_offset: 20, holding: page,
    kinds: { holder: "sb-ash", count: 1, class: "candy", shows: "1 candy", kinds: [{ kind: "candy", count: 1, shows: "1 candy" }] } });
  assert.equal(lines.count, 24, "23 whole things and 1 candy");
  assert.equal(lines.whole, 3, "the three the page did not list");
  assert.equal(holdingParts(lines).head, "24 things");
  assert.match(holdingParts(lines).items.at(-1), /^3 whole things$/);
  const list = handsList("sb-ash", { count: 23, complete: false, holding: page }, 5);
  assert.equal(list.complete, false, "a page short of the count says nothing about the rest");
});

const at = (x, y) => ({ x, y });
const bodies = { "sb-ash": at(214, -352), "sb-cleo": at(210, -350) };
const places = { bodyAt: (h) => bodies[h] ?? null };

test("4. a carried thing is drawn with its carrier: your hands, the ground's holder, a looked-at resident", () => {
  const known = carriersFrom([
    handsList("sb-ash", { count: 1, complete: true, holding: [{ thing: "sb-ash/a-cloth-bag-two", made_by: "sb-ash" }] }, 10),
    { at: 10, ground: [
      { thing: "sb-cleo/a-lantern", holder: "sb-cleo", stands_at: at(210, -350), place_from: "holder" },
      { thing: "the-town/a-stool", stands_at: at(1, 1), place_from: "fold", takeable: true },
    ] },
    { at: 8, holder: "sb-dov", things: ["sb-dov/a-kite"], complete: true },
  ]);
  assert.equal(known.holders.get("sb-ash/a-cloth-bag-two"), "sb-ash");
  assert.equal(known.holders.get("sb-cleo/a-lantern"), "sb-cleo");
  assert.equal(known.holders.get("sb-dov/a-kite"), "sb-dov");
  assert.equal(known.holders.has("the-town/a-stool"), false, "a thing nobody holds stays where it stands");
  assert.equal(known.placed.has("the-town/a-stool"), false, "and a canon place is the record's own, not moved");
  const two = carriedAt("sb-ash/a-cloth-bag-two", known, places);
  assert.deepEqual([two.x, two.y, two.holder], [214, -352, "sb-ash"]);
  assert.equal(carriedWords("sb-ash/a-cloth-bag-two", known, { self: "sb-ash" }), "in your hands");
  assert.equal(carriedWords("sb-cleo/a-lantern", known, { self: "sb-ash" }), "in sb-cleo's hands");
  assert.equal(carriedWords("the-town/a-stool", known, { self: "sb-ash" }), null);
});

test("4b. A THING INSIDE A BAG IS NOT MOVED (a known gap): no read names it, and a thing-holder row moves nothing", () => {
  // the office never sends this row (whereThingStands gives a thing-held thing no place); if it did, the page claims nothing
  const known = carriersFrom([{ at: 1, ground: [{ thing: "sb-ash/a-cloth-bag-one", holder: "sb-ash/a-cloth-bag-two", stands_at: at(203, -344) }] }]);
  assert.equal(known.holders.has("sb-ash/a-cloth-bag-one"), false);
  assert.equal(carriedAt("sb-ash/a-cloth-bag-one", known, places), null, "drawn where the record has it");
  assert.equal(carriedWords("sb-ash/a-cloth-bag-one", known, { self: "sb-ash" }), null);
});

test("5. a thing whose carrier cannot be placed is drawn nowhere, never where it used to stand", () => {
  const known = carriersFrom([{ at: 1, holder: "sb-far", things: ["sb-far/a-hat"], complete: true }]);
  const far = carriedAt("sb-far/a-hat", known, places);
  assert.equal(far.unplaced, true);
  assert.equal(far.x, null);
  assert.equal(carriedAt("the-town/a-stool", known, places), null, "nobody holds it: it stands where it stands");
});

test("6. the freshest read wins: a kite set down leaves its holder, and stands where the ground read says", () => {
  const looked = { at: 100, holder: "sb-cleo", things: ["sb-cleo/a-kite"], complete: true };
  assert.equal(carriersFrom([looked]).holders.get("sb-cleo/a-kite"), "sb-cleo");
  const dropped = { at: 200, ground: [{ thing: "sb-cleo/a-kite", stands_at: at(230, -360), place_from: "set-down", takeable: true }] };
  const known = carriersFrom([dropped, looked]);   // handed in any order: applied oldest first
  assert.equal(known.holders.has("sb-cleo/a-kite"), false, "the fresher row with no holder clears the older look");
  assert.deepEqual(carriedAt("sb-cleo/a-kite", known, places), { x: 230, y: -360, holder: null, setDown: true });
  assert.equal(carriersFrom([{ ...dropped, at: 50 }, looked]).holders.get("sb-cleo/a-kite"), "sb-cleo", "an older row does not undo a fresher look");
  // a complete list says the holder holds nothing else; an incomplete one says nothing about the rest
  const before = { at: 10, holder: "sb-ash", things: ["sb-ash/a-pouch", "sb-ash/a-bag"], complete: true };
  assert.equal(carriersFrom([before, { at: 20, holder: "sb-ash", things: ["sb-ash/a-bag"], complete: true }]).holders.has("sb-ash/a-pouch"), false);
  assert.equal(carriersFrom([before, { at: 20, holder: "sb-ash", things: ["sb-ash/a-bag"], complete: false }]).holders.get("sb-ash/a-pouch"), "sb-ash");
});

test("7. the say card's numbers are the office's: 60 m, drawn 15 minutes, heard until the settlement", () => {
  const conversations = { now: "2026-10-18T03:00:00Z", earshot_m: 60, fade_minutes: 15, hearable_since: "2026-10-17T22:00:00Z", close_minutes: 30, live: [], closed: [] };
  const note = sayCardNote({ conversations });
  assert.equal(note, "a voice carries 60 metres and stays drawn on the map for 15 minutes. everyone in earshot can hear it until the next settlement, nobody else does, and the town keeps its conversations browsable.");
  assert.doesNotMatch(note, /five minutes/);
  assert.match(sayCardNote({ dials: { earshot_m: 45, fade_min: { value: 20 } }, conversations }), /carries 45 metres .* for 20 minutes/,
    "the say card's own dials win where the palette carries them");
  assert.equal(sayCardNote({}), "a voice carries as far as earshot. everyone in earshot hears it, nobody else does, and the town keeps its conversations browsable.",
    "no read, no number");
});

test("8. a kind of thing is a thing, by the class chain or the office's class pointer", () => {
  assert.equal(isThingKind("thing"), true);
  assert.equal(isThingKind("halloween-candy-bowl", { pointer: BOWL_FOCUS.class_pointer }), true);
  assert.equal(isThingKind("halloween-candy-bowl", { chain: ["halloween-candy-bowl", "thing", "sited", "postmark-node"] }), true);
  assert.equal(isThingKind("portal-ground", { pointer: 'kind: portal-ground · a sited — explain: "portal-ground"' }), false);
  assert.equal(isThingKind("halloween-candy-bowl"), false, "with no lineage in hand, nothing is guessed");
});
