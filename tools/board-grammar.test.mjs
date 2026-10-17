// board-grammar.test.mjs — the bounty grammar reaches the store, and the gate
// holds it to the law.   node --test tools/board-grammar.test.mjs
//
// THE PROBLEM THIS EXISTS FOR: the board page is not its own database — a
// notice IS a world mark (class: bounty + ask + reward + status), and the
// board's reader (site src/lib/board.mjs) has exactly one source: the fold's
// world-state.json. Before this file's siblings landed, the fold's emission
// whitelist silently STRIPPED those fields, so no notice — letter-posted or
// door-posted — could ever reach the page. These tests are the falsifiers:
// drop the carry and they go red by name.
//
// THE CROSS-REPO CONTRACT (kept in words here, in code over there): the reader
// wants `class`, `ask`, `reward`, `status`, `threshold` (civic only),
// `ledger_weight` (rendered as "backed": raw escrow + breadth bonus, no fan-up,
// no terrain), `stamps`, `parent` (placement decides board membership), `by`,
// `date`, `body`. If board.mjs's grammar moves, this file is the world-side
// half that must move with it.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

// Every fixture this file makes is removed when the file finishes — see
// mark-lint.test.mjs's note of the same date (2026-09-01): 3,020 `boardlint-*`
// directories were standing in the box's /tmp the day it filled.
const SCRATCH = [];
const scratch = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); SCRATCH.push(d); return d; };
after(() => { for (const d of SCRATCH) rmSync(d, { recursive: true, force: true }); });
import { fileURLToPath } from "node:url";
import { fold, loadMarks } from "./marks-fold.mjs";
import { propertyOf } from "./class-properties.mjs";
import { instanceClassOf } from "./mark-kind.mjs";
// what a record IS, in either form (W2: `class:` folds into `kind:`); a class
// node's own name is still its `class:`
const classOf = (m) => (m.kind === "class" ? m.class : instanceClassOf(m));

const HERE = dirname(fileURLToPath(import.meta.url));
const LINT = join(HERE, "mark-lint.mjs");
const REAL = join(HERE, "..", "WORLD", "marks", "let-there-be-light");
const MARKS_DIR = join(HERE, "..", "WORLD", "marks");
const BOARD = "the-town/the-bounty-board";

const terrain = { features: [], far_features: [] };

// The board at the Town Centre and one notice pinned to it, world coordinates
// (an in-memory fold takes marks as already framed). The plain bench is the
// control: no grammar, no escrow — it must serialize without a single new key.
const marks = () => [
  { id: BOARD, kind: "sited", by: "the-town", household: "the-town", tier: "constitution",
    at: { x: 250, y: -100 }, extent: { w: 30, h: 20 }, date: "2026-08-11", body: "The Bounty Board, in BETA." },
  { id: "wright/bounty-a-map-of-the-quay", kind: "post", by: "wright", household: "wright", date: "2026-08-11",
    body: "Pinned to the board.", class: "bounty",
    ask: "Draw the quay as it stands, with every mail-house named.", reward: 12, status: "open" },
  { id: "rei/the-far-bench", kind: "sited", by: "rei", household: "rei",
    at: { x: 900, y: 900 }, extent: { w: 4, h: 4 }, date: "2026-08-11", body: "a bench, far off" },
];

// wright's own 5 raw + rei's 10 raw with the town's breadth bonus of 2 baked
// into the external household's first row (the town's world-stake.mjs shape).
const stakes = () => [
  { tick: 0, holder: "wright", mark: "wright/bounty-a-map-of-the-quay", n: 5, weight: 5 },
  { tick: 0, holder: "rei", mark: "wright/bounty-a-map-of-the-quay", n: 10, weight: 12 },
];

const serialized = (state) => JSON.parse(JSON.stringify(state));
const markOf = (state, id) => state.marks.find((m) => m.id === id);

test("the grammar reaches the store: class/ask/reward/status survive the fold", () => {
  const state = serialized(fold({ marks: marks(), terrain, stakes: stakes() }));
  const n = markOf(state, "wright/bounty-a-map-of-the-quay");
  assert.equal(n.class, "bounty");
  assert.equal(n.ask, "Draw the quay as it stands, with every mail-house named.");
  assert.equal(n.reward, 12);
  assert.equal(n.status, "open");
  // (parent is the write-path's to author — the tree IS containment — so the
  // board-membership half of the contract is asserted in the disk-fixture
  // fold below, where a directory exists to carry it.)
});

test("DISK ROUND-TRIP: a nested notice folds with its grammar and its board parent", () => {
  // records → parseRecord → loadMarks → fold → serialize: the whole real
  // pipeline. The reader's isNotice needs BOTH halves — class AND placement.
  const { dir } = fixtureTree();
  const slug = join(dir, "let-there-be-light", "the-bounty-board", "a-notice");
  mkdirSync(slug, { recursive: true });
  writeFileSync(join(slug, "mark.md"), notice({ status: "done" }));
  const state = serialized(fold({ marks: loadMarks(dir), terrain, stakes: [] }));
  const n = state.marks.find((m) => m.id === "testerhh/a-notice");
  assert.ok(n, "the notice folded");
  assert.equal(n.class, "bounty");
  assert.equal(n.ask, "Draw the quay.");
  assert.equal(n.reward, 12);
  // "done" because absence is the lawful default (the reader reads absent as
  // open) — carriage is only provable with a value that isn't the default.
  assert.equal(n.status, "done");
  // THE SECOND SILENT BREAK this file exists for: the store never carried
  // placement on sited marks (`parent` rides only predicated/naming — checked
  // against the live store, 288 of 612, none sited), so the reader's isNotice
  // could never match. Classed marks now disclose placement in the reader's
  // own field name.
  assert.equal(n.placementParent, "the-town/the-bounty-board", "placement carries board membership");
});

test("ledger_weight is the backed number: raw escrow + breadth bonus, no fan-up", () => {
  const state = serialized(fold({ marks: marks(), terrain, stakes: stakes() }));
  const n = markOf(state, "wright/bounty-a-map-of-the-quay");
  assert.equal(n.stamps, 15, "raw escrow: 5 own + 10 external");
  assert.equal(n.ledger_weight, 17, "15 raw + 2 breadth bonus");
  // and it agrees with the receipt the fold already publishes
  assert.equal(n.ledger_weight, n.weight_parts.own_escrow + n.weight_parts.breadth.bonus);
});

test("a world with no notices serializes without a single new key", () => {
  const state = serialized(fold({ marks: marks(), terrain, stakes: stakes() }));
  const bench = markOf(state, "rei/the-far-bench");
  for (const key of ["class", "ask", "reward", "status", "threshold", "placementParent", "ledger_weight"])
    assert.equal(key in bench, false, `${key} must be absent on an unclassed, unstaked mark`);
});

// The resident-instantiable whitelist (Keemin-ruled 2026-08-17, the lantern
// ruling): a class is resident-instantiable when its INSTANCE BINDS ONLY ITS
// AUTHOR -- an object you hold (thing), a notice you owe (bounty). Classes
// whose instances would bind others -- physics and their dials, schedules
// others board, identities, ground, papers, money, registry records -- stay
// town-only until the resident-classes design (#1797) rules the general
// mechanism. This set grows by ruling, never by drift.
// note joined same-day (vermillion/the-note-in-her-rafters, the first field
// case): a note-instance carries no grants, no dials, no machinery claim --
// the world's note verb reads its own store, never marks -- so the class is
// a label on paper that binds only its author. Decorative by construction.
// `idea` joined 2026-08-30 (founder-ruled, the Think Tank): Stage 1 of the
// Idea Lifecycle is publishing an idea mark — one claim, the resident's own
// hand, standing in the Think Tank. The whitelist grows by ruling, never by
// drift, and this line is that ruling carried by name.
//
// ⚠ SUPERSEDED 2026-10-16 18:44 (LOGOS/classes.md § Instantiation: "It replaces
// the hand-kept `RESIDENT_INSTANTIABLE` whitelist"): who may make an instance is
// the class's `makers` property, a constitution true/false inherited down
// `extends`, whose roots one principle sets (the-town/nothing-you-control-mints).
// The list above is the record of how the roots stood until then; the set below
// is read off the tree, never kept by hand.
const residentMay = (live, klass) => propertyOf(live, klass, "makers")?.value === true;

test("LIVE TREE: class law -- town marks define; residents instantiate only what makers allows", () => {
  const live = loadMarks(MARKS_DIR);
  const classed = live.filter((m) => classOf(m) !== undefined);

  // ⚠ NARROWED 2026-08-26, and the narrowing is the LAW'S OWN LINE, not a
  // loosening to make a new mark fit.
  //
  // This filter used to be `by === "the-town"`, which reads "the town only ever
  // authors class DEFINITIONS." That was true for as long as it was true, and
  // it stopped being true the first time the town's pen authored a classed
  // INSTANCE out in the world. The record already draws the distinction — the
  // step-1 promotion, 2026-08-18, LOGOS/classes.md § Instantiation:
  //
  //   "a class-carrying mark standing in the Keeping Works DECLARES its class;
  //    anywhere else it is an INSTANCE"
  //
  // — so the honest fix is to ask that question instead of inferring it from
  // authorship. The assertion below is STRICTER than what it replaced, not
  // weaker: it now pins the definition/instance boundary itself, and a
  // definition that wandered out of the works, or an instance that crept into
  // it, fails here where before either could pass.
  const inTheWorks = (m) => String(m._dir ?? "").split("\\").join("/").includes("/the-keeping-works/");
  const defs = classed.filter((m) => m.by === "the-town" && inTheWorks(m));
  const townInstances = classed.filter((m) => m.by === "the-town" && !inTheWorks(m));
  assert.ok(defs.length >= 11, `expected the Keeping Works roster, found ${defs.length}`);
  for (const m of defs)
    assert.equal(m.tier, "constitution", `${m.id}: type marks are constitution-tier`);
  // ⚠ AND HERE IS WHAT I ASSERTED FIRST AND THE RECORD REFUTED.
  //
  // The tempting second clause was "a town-authored classed mark outside the
  // works may not wear constitution" — instances are ordinary, standing is
  // derived from ground, a bench that binds without stamps is asserting a tier.
  // It reads well and it is FALSE about this world. Four live marks refute it,
  // all lawful, all founder-placed: `the-town/1f3d9`, `the-town/1f916` and
  // `the-town/postmark` (class `town`, the harbor registry's charters — "the
  // founder pen siting the mark until traffic earns a door of its own"), and
  // `the-town/the-wheelhouse` (class `timetable`, that class's own standing
  // institution). Chartered infrastructure IS constitution wherever it stands.
  //
  // So the checkable claim is not about tier at all — it is about DECLARING.
  // The roster is built from the works and only from the works, and that is the
  // property a stray definition would break.
  const townInstanceIds = townInstances.map((m) => m.id);
  assert.ok(townInstanceIds.length > 0, "the town authors instances as well as definitions — a sweep finding none is a sweep that ran on nothing");
  const rosterFromWorks = new Set(defs.map((m) => m.class));
  for (const m of townInstances)
    assert.ok(rosterFromWorks.has(classOf(m)),
      `${m.id}: an instance names a class the WORKS declares — the roster comes from the works alone, so a class known only by an instance is a class nothing defined`);
  assert.ok(defs.some((m) => m.class === "bounty"), "the bounty class stands in the roster");
  // ⚠ EXCEPTIONS BY RULING — the law's own line: the set grows by ruling,
  // never by drift, and an exception is a ruling with a name and a date.
  // 2026-08-29, the night after the fight (founder, verbatim in substance:
  // "I'd like for you, wright, to own the marks from the dungeon — you wrote
  // them; now that the fight is over, as regular marks"): the dungeon's two
  // portal-grounds pass to their builder. The class stays town-only for
  // everyone else — an UNLISTED resident portal-ground still fails here, which
  // is what keeps this an exception and not a loosening. #1797's general
  // mechanism subsumes these entries when it lands; LOGOS/classes.md
  // § Instantiation carries the same words (nodes first).
  const INSTANCE_EXCEPTIONS_BY_RULING = new Map([
    ["wright/the-candle-vault", "founder ruling 2026-08-29 -- the dungeon passes to its builder"],
    ["wright/the-cellar-door", "founder ruling 2026-08-29 -- the dungeon passes to its builder"],
    // 2026-09-10, the third name, and by the same door the first two came
    // through -- a ruling with a name and a date, not a loosening (founder,
    // verbatim: "it looks like lanternstep's marks from my bday (the parlor
    // and everything in it) belong to the-town; they should be yours
    // (wright)"). The parlor is the room the dungeon opened off; it waited on
    // the portal sitting only for WHOSE it was, and that half is now ruled.
    // LOGOS/classes.md Instantiation carries the same words, nodes first.
    ["wright/the-lanternstep-parlor", "founder ruling 2026-09-10 -- the birthday parlor passes to its builder"],
  ]);
  for (const m of classed.filter((m) => m.by !== "the-town")) {
    if (INSTANCE_EXCEPTIONS_BY_RULING.has(m.id)) continue;
    assert.ok(residentMay(live, String(classOf(m))),
      `${m.id}: "${classOf(m)}" answers makers: false -- it is the town's alone (the-town/nothing-you-control-mints)`);
  }
  // and the roots answer as ruled (18:44, 19:39): the false root, the true
  // roots, and the sited classes that would put a resident in control of
  // something that mints or confers standing
  assert.equal(propertyOf(live, "postmark-node", "makers")?.value, false, "the root answers false");
  for (const k of ["thing", "note", "post", "predicate", "sited", "idea", "bounty", "candy", "halloween-candy-bowl", "halloween-candy-bag", "naming"])
    assert.ok(residentMay(live, k), `${k} answers makers: true`);
  for (const k of ["parcel", "portal-ground", "vehicle", "adversary", "dungeon", "home-mark", "stairs", "resident", "household", "mark"])
    assert.equal(residentMay(live, k), false, `${k} answers makers: false`);
  // Notice fields ride only bounty-classed marks (the board grammar); anywhere
  // else they are strays to investigate.
  for (const m of live.filter((m) => m.ask !== undefined || m.reward !== undefined || m.status !== undefined || m.threshold !== undefined))
    assert.equal(classOf(m), "bounty", `${m.id}: notice fields belong to the bounty grammar`);
});

// ── the gate (mark-lint § 3d), run the way the fleet and the PR lane run it ──

function fixtureTree() {
  const dir = scratch("boardlint-");
  const root = join(dir, "let-there-be-light");
  mkdirSync(root, { recursive: true });
  copyFileSync(join(REAL, "mark.md"), join(root, "mark.md"));
  cpSync(join(REAL, "logos"), join(root, "logos"), { recursive: true });
  // the board, in the root's own frame; the notice at the board's centre (0,0
  // in a relative tree), so the fixture holds in either coordinate regime.
  const board = join(root, "the-bounty-board");
  mkdirSync(board, { recursive: true });
  writeFileSync(join(board, "mark.md"),
    "---\nkind: sited\nby: the-town\ntier: constitution\ndate: 2026-08-11\nat: { x: 250, y: -100 }\nextent: { w: 30, h: 20 }\n---\n\nThe Bounty Board, in BETA.\n");
  // the class TYPE mark, standing where definitions stand — the gate exempts
  // the definition BY PLACEMENT (the Keeping Works), the same way the reader
  // knows a notice by placement (review W-1), so the fixture must model both.
  const works = join(root, "the-keeping-works");
  mkdirSync(works, { recursive: true });
  writeFileSync(join(works, "mark.md"),
    "---\nkind: sited\nby: the-town\ntier: constitution\ndate: 2026-08-11\nat: { x: 400, y: 400 }\nextent: { w: 40, h: 40 }\n---\n\nThe Keeping Works: the class definitions stand here.\n");
  const type = join(works, "bounty");
  mkdirSync(type, { recursive: true });
  writeFileSync(join(type, "mark.md"),
    "---\nkind: class\nby: the-town\ntier: constitution\ndate: 2026-08-11\nclass: bounty\nextends: post\n---\n\nA bounty is one ask, a reward in stamps, a status: open or done.\n");
  // the post class it extends (15:12), so `kind: bounty` reads as a post (W2)
  mkdirSync(join(works, "post"), { recursive: true });
  writeFileSync(join(works, "post", "mark.md"),
    "---\nkind: class\nby: the-town\ntier: constitution\ndate: 2026-10-17\nclass: post\n---\n\nA post is an ask the town reads, not a claim on the world.\n");
  return { dir, root, board };
}

// a notice is a post (ruled 2026-10-16 15:12): no at, no extent, it stands nowhere
const notice = (fields) => {
  const fm = { kind: "post", by: "testerhh", date: "2026-08-11", class: "bounty", ask: "Draw the quay.", reward: 12, ...fields };
  const lines = Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `---\n${lines}\n---\n\nPinned to the board.\n`;
};

function runLint(marksDir) {
  try { return execFileSync("node", [LINT, "--marks-dir", marksDir], { encoding: "utf8" }); }
  catch (e) { return String(e.stdout ?? "") + String(e.stderr ?? ""); }
}

function lintWithNotice(fields) {
  const { dir, board } = fixtureTree();
  const slug = join(board, "a-notice");
  mkdirSync(slug, { recursive: true });
  writeFileSync(join(slug, "mark.md"), notice(fields));
  return runLint(dir);
}

test("a lawful notice passes the gate", () => {
  const out = lintWithNotice({});
  assert.doesNotMatch(out, /ERROR[^\n]*a-notice/, "the lawful notice must not error");
  assert.doesNotMatch(out, /ask is \d+ chars/);
});

test("the gate names each broken field of a notice", () => {
  assert.match(lintWithNotice({ ask: "x".repeat(151) }), /ask is 151 chars; the cap is 150/);
  assert.match(lintWithNotice({ reward: 0 }), /reward: must be a whole number of stamps ≥ 1/);
  assert.match(lintWithNotice({ reward: undefined }), /reward: must be a whole number of stamps ≥ 1/);
  assert.match(lintWithNotice({ status: "closed" }), /status: is open or done/);
  assert.match(lintWithNotice({ class: "quest" }), /names no class the law knows/);
  assert.match(lintWithNotice({ threshold: 100 }), /threshold: is the town's bar/);
});

test("grammar without a class draws the advisory, never a silent pass", () => {
  const out = lintWithNotice({ class: undefined });
  assert.match(out, /ask\/reward\/status without class: bounty/);
});

// ── review W-1: the gate scopes by what the mark IS, not what it carried ────

test("W-1a: a BARE class:bounty on the board cannot slip the gate", () => {
  const out = lintWithNotice({ ask: undefined, reward: undefined, status: undefined });
  assert.match(out, /a bounty notice needs ask:/);
  assert.match(out, /reward: must be a whole number/);
});

test("W-1b: a predicated class:bounty on the board is named a non-notice", () => {
  const { dir, board } = fixtureTree();
  const slug = join(board, "a-sneaky-predicate");
  mkdirSync(slug, { recursive: true });
  writeFileSync(join(slug, "mark.md"),
    "---\nkind: predicated\nby: testerhh\ndate: 2026-08-11\nslot: sneak\nvalue: yes\nclass: bounty\n---\n\nA predicate wearing the class.\n");
  assert.match(runLint(dir), /a bounty notice is a post/);
});

// ⚠ SUPERSEDED 2026-10-16: "a class:bounty token OFF the board draws the
// off-board warning" retired with the warning itself. A bounty is a post and
// stands nowhere, so there is no ground for it to be off. What replaces it: a
// notice still written as a sited mark is refused, and a post that tries to
// stand somewhere is refused too.
test("a notice still written SITED is refused as no post; a post with a place is refused", () => {
  const { dir, root } = fixtureTree();
  const slug = join(root, "a-stray-notice");
  mkdirSync(slug, { recursive: true });
  writeFileSync(join(slug, "mark.md"), notice({ kind: "sited", at: "{ x: 600, y: 600 }", extent: "{ w: 1, h: 1 }" }));
  assert.match(runLint(dir), /a-stray-notice: a bounty notice is a post/);
  writeFileSync(join(slug, "mark.md"), notice({ at: "{ x: 600, y: 600 }" }));
  assert.match(runLint(dir), /a-stray-notice: a post carries no at\/extent/);
  assert.doesNotMatch(runLint(dir), /off the board/, "the retired warning is gone by its own words");
});

test("the definition in the Keeping Works stays exempt — no ask demanded of it", () => {
  const { dir } = fixtureTree();
  const out = runLint(dir);
  assert.doesNotMatch(out, /ERROR[^\n]*the-keeping-works\/bounty/);
});

test("the '#' truncation: the lint catches the face it CAN see (review O-1)", () => {
  // Honesty about reach: parseRecord strips from the first '#' BEFORE lint
  // reads the record, so a mid-string hash arrives already truncated and
  // lint-clean — the DOOR's bounce is the real wall (office pin), and the
  // PR lane's human eyes are the belt. What lint does catch is the ask that
  // STARTS with '#': it parses to empty and the needs-ask error fires. Since
  // WLD-41 the lint also reads the file for a '#' inside a QUOTED value
  // (marks-fold.mjs § lossyValues); a bare mid-string '#' is still a comment.
  const { dir, board } = fixtureTree();
  const slug = join(board, "a-hash-headed-notice");
  mkdirSync(slug, { recursive: true });
  writeFileSync(join(slug, "mark.md"), notice({ ask: "#3 map the quay" }));
  assert.match(runLint(dir), /a bounty notice needs ask:/);
});

// ── THE IDEA GRAMMAR (the Think Tank, founder-ruled 2026-08-30) ─────────────
//
// THE LAW these quote: "One thought by a resident, of the town: the body IS
// the claim. Sited anywhere or predicated under any mark; the Think Tank reads
// them all." — the idea class mark (version 2, 2026-09-01). Stage 1 of the
// Idea Lifecycle is this mark standing; the blueprint PR (stage 2) cites it.
// No ask, no reward, no status: that stage lives in the blueprint repo, one
// writer per fact.
//
// AND THE FOUR WORDS THIS FILE EXISTS TO HOLD (founder-ruled 2026-09-01):
// "Ideas can be predicates." An idea is a class, never a place or a kind —
// sited it is an idea OF the ground it stands in, predicated it is an idea OF
// the mark it stands under. Both anchors, one class. Drop either half of the
// gate and the cases below go red by name.
// ⚠ SUPERSEDED 2026-10-16 15:12 (LOGOS/classes.md § Posts): "ideas are no
// longer marks. They are posts, which are a different subclass of
// postmark-node." The four words above are the record of how ideas stood until
// then; an idea neither stands sited nor predicated now, and what it is an
// idea OF is its sovereign `about:` (16:02 item 3). The cases below hold the
// new grammar the way the old ones held the old: a lawful idea clears, a
// thoughtless one errs, an idea filed anywhere draws no word about where, its
// about: must name a mark, and every standing kind is refused quoting the ruling.
test("IDEA: a POST — \"ideas are no longer marks. They are posts\" (2026-10-16); a thoughtless one errs on the one-claim law; about: names a mark; a sited, predicated or parcel idea is refused quoting the ruling; makers carries it", () => {
  assert.ok(residentMay(loadMarks(MARKS_DIR), "idea"),
    "the 2026-08-30 ruling, carried by makers: residents publish ideas with their own hand — idea answers true through post");
  const { dir, root } = fixtureTree();
  const works = join(root, "the-keeping-works");
  // the post class with its about: property, and idea beneath it, as the works declare them
  mkdirSync(join(works, "post", "post-about"), { recursive: true });
  writeFileSync(join(works, "post", "mark.md"),
    "---\nkind: class\nby: the-town\ntier: constitution\ndate: 2026-10-17\nclass: post\n---\n\nA post is an ask the town reads, not a claim on the world.\n");
  writeFileSync(join(works, "post", "post-about", "mark.md"),
    "---\nkind: property\nby: the-town\ntier: sovereign\ndate: 2026-10-17\nname: about\n---\n\nThe mark a post is about, when it is about one.\n");
  mkdirSync(join(works, "idea"), { recursive: true });
  writeFileSync(join(works, "idea", "mark.md"),
    "---\nkind: class\nby: the-town\ntier: constitution\ndate: 2026-08-30\nclass: idea\nextends: post\n---\n\nOne thought by a resident, of the town: the body IS the claim. A post; the Think Tank reads them all. BETA.\n");
  const tank = join(root, "the-think-tank");
  mkdirSync(tank, { recursive: true });
  writeFileSync(join(tank, "mark.md"),
    "---\nkind: sited\nby: the-town\ntier: constitution\ndate: 2026-08-30\nat: { x: 300, y: -100 }\nextent: { w: 30, h: 20 }\n---\n\nThe Think Tank, in BETA.\n");
  const idea = (body, fields = "") =>
    `---\nkind: idea\nby: testerhh\ndate: 2026-08-30\n${fields}---\n\n${body}`; // the kind names the class (W2)

  mkdirSync(join(tank, "a-town-calendar"), { recursive: true });
  writeFileSync(join(tank, "a-town-calendar", "mark.md"), idea("A calendar the town keeps together.\n"));
  let out = runLint(dir);
  assert.doesNotMatch(out, /ERROR[^\n]*a-town-calendar/, "a lawful idea — a post, thought present — clears the gate");

  mkdirSync(join(tank, "empty-thought"), { recursive: true });
  writeFileSync(join(tank, "empty-thought", "mark.md"), idea(""));
  out = runLint(dir);
  assert.match(out, /an idea needs its thought — the BODY is the claim/, "a thoughtless idea errs, citing the one-claim law");

  // an idea filed anywhere is an idea: the Tank is where ideas are READ (09-01),
  // and a post stands nowhere, so where its file sits says nothing
  mkdirSync(join(root, "stray-thought"), { recursive: true });
  writeFileSync(join(root, "stray-thought", "mark.md"), idea("A thought parked nowhere.\n"));
  out = runLint(dir);
  assert.doesNotMatch(out, /(ERROR|WARN)[^\n]*stray-thought/, "the stray thought draws no finding at all");

  // ── about: — what an idea is an idea OF (ruled 16:02 item 3) ────────────
  mkdirSync(join(root, "a-bench-at-the-quay"), { recursive: true });
  writeFileSync(join(root, "a-bench-at-the-quay", "mark.md"),
    idea("A bench at the quay, facing the water, for the waiting.\n", "about: the-town/the-think-tank\n"));
  out = runLint(dir);
  assert.doesNotMatch(out, /(ERROR|WARN)[^\n]*a-bench-at-the-quay/, "an idea about a mark that stands draws no finding at all");
  writeFileSync(join(root, "a-bench-at-the-quay", "mark.md"),
    idea("A bench at the quay, facing the water, for the waiting.\n", "about: nobody/no-such-mark\n"));
  assert.match(runLint(dir), /a-bench-at-the-quay: about: "nobody\/no-such-mark" names no mark in the record/,
    "an about: that names nothing is refused by name");

  // THE CROSS-REPO CONTRACT for the new shape: the office's tank read and the
  // site's ideas() join on `class`, and an idea reaches them now as a row of
  // kind post with NO `at` and its `about:` — the shape a reader written for
  // sited ideas alone will drop. Asserted world-side, so the day it stops
  // folding this way the sibling repos are told by a red test.
  writeFileSync(join(root, "a-bench-at-the-quay", "mark.md"),
    idea("A bench at the quay, facing the water, for the waiting.\n", "about: the-town/the-think-tank\n"));
  const folded = serialized(fold({ marks: loadMarks(dir), terrain, stakes: [] }));
  const row = folded.marks.find((m) => m.id === "testerhh/a-bench-at-the-quay");
  assert.ok(row, "the idea folds into the store at all");
  assert.equal(row.kind, "idea", "the kind is the class — the Tank's join key, in the form W2 writes (S1 reads either)");
  assert.equal(row.class, undefined, "and no class: rides beside it");
  assert.equal(row.at, undefined, "a post publishes NO at: — it stands nowhere");
  assert.equal(row.about, "the-town/the-think-tank", "it publishes what it is an idea OF");

  // and every standing kind is refused, quoting the ruling: an idea is no mark
  const asKind = {
    "a-sited-thought": "---\nkind: sited\nby: testerhh\ndate: 2026-09-01\nat: { x: 0, y: 0 }\nextent: { w: 1, h: 1 }\nclass: idea\n---\n\nA thought that tried to stand.\n",
    "a-predicated-thought": "---\nkind: predicated\nby: testerhh\ndate: 2026-09-01\nslot: idea\nvalue: a thought\nclass: idea\n---\n\nA thought that tried to predicate.\n",
    "a-parcelled-thought": "---\nkind: parcel\nby: testerhh\ndate: 2026-09-01\nat: { x: 40, y: 40 }\nclass: idea\n---\n\nA thought that tried to be ground.\n",
  };
  for (const [slug, text] of Object.entries(asKind)) {
    const parent = slug === "a-predicated-thought" ? tank : root;
    mkdirSync(join(parent, slug), { recursive: true });
    writeFileSync(join(parent, slug, "mark.md"), text);
  }
  out = runLint(dir);
  for (const [slug, kind] of [["a-sited-thought", "sited"], ["a-predicated-thought", "predicated"], ["a-parcelled-thought", "parcel"]]) {
    assert.match(out, new RegExp(`${slug}: an idea is a post — "ideas are no longer marks\\. They are posts`), `kind: ${kind} is refused, quoting the ruling`);
    assert.match(out, new RegExp(`${slug}: an idea is a post[^\\n]*got kind: "${kind}"`), "the refusal names the kind it got");
  }
});

// W2 (ruled 2026-10-16 16:02: "The `class:` field folds into `kind`"): a
// notice written the old way — a standing word beside `class:` — is still read
// as what it is, and is told the form it has now. Advisory, never a refusal:
// a door may still write the old form until its own readers move (O1).
test("THE OLD FORM still reads as what it is, and is told that class: folds into kind", () => {
  const out = lintWithNotice({});
  assert.doesNotMatch(out, /ERROR[^\n]*a-notice/, "kind: post + class: bounty is still a lawful notice");
  assert.match(out, /\[WARN\][^\n]*a-notice: class: bounty folds into kind: write kind: bounty/);
  const newForm = lintWithNotice({ kind: "bounty", class: undefined });
  assert.doesNotMatch(newForm, /(ERROR|WARN)[^\n]*a-notice: (?!flat field)/, `kind: bounty is the notice in the form it has now: ${newForm}`);
  assert.match(lintWithNotice({ kind: "quest", class: undefined }), /a-notice: kind must be one of [^\n]*or name a class the works declare \(got "quest"\)/,
    "a kind that names no class is refused by name");
});
