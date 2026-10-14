// portals.test.mjs — WLD-5: portals (`into`, `lands_at`) and the dungeon class.
//
// The world here is the ruled instance in miniature (Darko 2026-10-13 20:22, on
// WLD-21): the Grounds are the dungeon; entering them passes the Gilded Doors'
// outside face into the vestibule; the doors' inside face is the exit and lands
// at the Approach, just outside the Grounds' west edge. Each test names a fact
// that is true only if the ruling shipped, and the heist's broken landing
// (WLD-18) is the fixture the lint and the door are both held to.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { entryLawOf, termsAt, occupancyAt, parseEnterExitLedger } from "./enter-exit.mjs";
import {
  clampInto, landingOf, hiddenFrom, scopeWorld, portalFindings, applyPortalExceptions, portalsIn, portalsInto,
  dungeonsOf, heldDungeon, standpointSight, walkFence, LANDING_REACH_M,
} from "./portals.mjs";
import { enter, exit, enterPrompt, exitPrompt, containmentChain, investigate } from "./world-verbs.mjs";

const HEIST = "spire/the-gilded-doo-YOULL-NEVER-CATCH-ME";

function world({ heist = false } = {}) {
  const marks = [
    { id: "spire/grounds", kind: "sited", by: "spire", class: "dungeon",
      at: { x: 1000, y: 1000 }, extent: { w: 500, h: 400 }, body: "The Spire's grounds." },
    { id: "spire/vestibule", kind: "sited", by: "spire", at: { x: 800, y: 1000 }, extent: { w: 60, h: 60 }, body: "The vestibule." },
    { id: "spire/hall", kind: "sited", by: "spire", at: { x: 1000, y: 1000 }, extent: { w: 200, h: 200 }, body: "The great hall." },
    { id: "spire/chapel", kind: "sited", by: "spire", at: { x: 1150, y: 1100 }, extent: { w: 40, h: 40 }, body: "The chapel." },
    { id: "spire/candle", kind: "sited", by: "spire", at: { x: 1000, y: 1010 }, extent: { w: 1, h: 1 }, body: "A candle in the hall." },
    { id: "spire/the-approach", kind: "sited", by: "spire", at: { x: 720, y: 1000 }, extent: { w: 30, h: 30 }, body: "The approach." },
    { id: "spire/doors-outside", kind: "sited", by: "spire", at: { x: 745, y: 1000 }, extent: { w: 4, h: 2 },
      body: "The Gilded Doors.",
      entry: { word: "neutral", into: "spire/vestibule", lands_at: heist ? HEIST : "spire/doors-inside" } },
    { id: "spire/doors-inside", kind: "sited", by: "spire", at: { x: 775, y: 1000 }, extent: { w: 4, h: 2 },
      body: "The Gilded Doors, from inside.", entry: { word: "neutral", into: "spire/the-approach" } },
    { id: "spire/hall-door", kind: "sited", by: "spire", at: { x: 825, y: 1000 }, extent: { w: 2, h: 2 },
      body: "A door to the hall.", entry: { word: "neutral", into: "spire/hall", lands_at: "spire/hall-back" } },
    { id: "spire/hall-back", kind: "sited", by: "spire", at: { x: 905, y: 1000 }, extent: { w: 2, h: 2 },
      body: "The hall's door back.", entry: { word: "neutral", into: "spire/vestibule", lands_at: "spire/hall-door" } },
    { id: "spire/chapel-arch", kind: "sited", by: "spire", at: { x: 1095, y: 1050 }, extent: { w: 2, h: 2 },
      body: "An arch to the chapel.", entry: { word: "neutral", into: ["spire/chapel", "spire/vestibule"] } },
    { id: "spire/chapel-back", kind: "sited", by: "spire", at: { x: 1135, y: 1100 }, extent: { w: 2, h: 2 },
      body: "Back to the hall.", entry: { word: "neutral", into: "spire/hall", lands_at: "spire/chapel-arch" } },
    { id: "town/green", kind: "sited", by: "town", at: { x: 0, y: 0 }, extent: { w: 100, h: 100 }, body: "A green, far off." },
  ];
  return { marks };
}
const occ = (stack) => new Map(stack ? [["ann", stack]] : []);
const AT = (x, y) => ({ x, y, name: "ann" });

// ── the law's keys ───────────────────────────────────────────────────────────

test("the portal keys ride the entry law exactly as written, capitals and all", () => {
  const law = entryLawOf({ id: "x", entry: { word: "neutral", into: "a/b", lands_at: HEIST } });
  assert.deepEqual(law.into, ["a/b"]);
  assert.equal(law.lands_at, HEIST, "the shouting survives: nothing trims or lowercases the field");
  assert.deepEqual(entryLawOf({ id: "x", entry: { word: "neutral", into: ["a/b", "c/d"] } }).into, ["a/b", "c/d"]);
});

test("a law without the portal keys reads byte for byte as before", () => {
  const plain = { id: "x", body: "b", entry: { word: "welcomed", edge: "aboard", consequence: "c" } };
  assert.deepEqual(entryLawOf(plain), { word: "welcomed", edge: "aboard", consequence: "c", from: "x" });
  assert.equal("into" in termsAt(plain), false);
});

// ── the landing ──────────────────────────────────────────────────────────────

test("CLAMPING: a landing outside its into moves to the nearest point, a metre inside", () => {
  const room = { at: { x: 0, y: 0 }, extent: { w: 10, h: 10 } };
  assert.deepEqual(clampInto({ x: 20, y: 2 }, room), { x: 4, y: 2, clamped: true });
  assert.deepEqual(clampInto({ x: -3, y: -30 }, room), { x: -3, y: -4, clamped: true });
  assert.deepEqual(clampInto({ x: 1, y: 1 }, room), { x: 1, y: 1, clamped: false }, "a point already inside stays put");
});

test("CLAMPING into a ring lands strictly inside it", () => {
  const ring = { at: { x: 5, y: 5 }, extent: { w: 10, h: 10 }, points: [[0, 0], [10, 0], [10, 10], [0, 10]] };
  const at = clampInto({ x: 15, y: 5 }, ring);
  assert.equal(at.clamped, true);
  assert.ok(Math.abs(at.x - 9) < 1e-9 && Math.abs(at.y - 5) < 1e-9, `1 m inside the east edge, got ${at.x},${at.y}`);
});

test("THE DOOR BUG: a lands_at naming no mark is refused by quoting the field", () => {
  const w = world({ heist: true });
  const byId = new Map(w.marks.map((m) => [m.id, m]));
  const doors = byId.get("spire/doors-outside");
  const l = landingOf(entryLawOf(doors), byId.get("spire/vestibule"), byId);
  assert.equal(l.ok, false);
  assert.equal(l.field, "lands_at");
  assert.ok(l.because.includes(`"${HEIST}"`), l.because);
});

// ── the passage ──────────────────────────────────────────────────────────────

test("into the Grounds: one portal enters the dungeon and the vestibule, and lands at the inside face", () => {
  const w = world();
  const a = enter(AT(745, 1000), "spire/doors-outside", w, { occupancy: occ([]), handle: "ann", at: 300 });
  assert.equal(a.error, undefined);
  assert.deepEqual(a.entered, ["spire/grounds", "spire/vestibule"]);
  assert.equal(a.rows.length, 2);
  assert.match(a.rows[0], / · ann · enters spire\/grounds · ferry 300\.0000 · word neutral$/);
  assert.deepEqual(a.landing, { x: 775, y: 1000, mark: "spire/doors-inside", clamped: false });
  assert.deepEqual(a.portals.map((p) => p.id), ["spire/doors-inside", "spire/hall-door"]);
  // and the ledger agrees: the rows derive the stack the answer claims
  const acts = parseEnterExitLedger(a.rows.join("\n")).acts;
  assert.deepEqual(occupancyAt(acts).get("ann"), ["spire/grounds", "spire/vestibule"]);
});

test("room to room: the room left is exited, the room behind the door entered", () => {
  const a = enter(AT(825, 1000), "spire/hall-door", world(), { occupancy: occ(["spire/grounds", "spire/vestibule"]), handle: "ann", at: 301 });
  assert.deepEqual(a.exited, ["spire/vestibule"]);
  assert.deepEqual(a.entered, ["spire/hall"]);
  assert.deepEqual(a.within, ["spire/grounds", "spire/hall"]);
  assert.match(a.rows[0], /exits spire\/vestibule/);
  assert.match(a.rows[1], /enters spire\/hall/);
  assert.equal(a.landing.mark, "spire/hall-back");
});

test("THE WAY OUT: the inside face exits the dungeon and lands outside its extent", () => {
  const a = enter(AT(775, 1000), "spire/doors-inside", world(), { occupancy: occ(["spire/grounds", "spire/vestibule"]), handle: "ann", at: 302 });
  assert.deepEqual(a.exited, ["spire/grounds", "spire/vestibule"], "leaving the dungeon leaves every room in it");
  assert.deepEqual(a.entered, ["spire/the-approach"]);
  assert.deepEqual([a.landing.x, a.landing.y], [720, 1000]);
  assert.ok(a.landing.x < 750, "outside the Grounds' west edge");
});

test("the door bug at the portal: refused, the field quoted, standing at it, nothing recorded", () => {
  const a = enter(AT(745, 1000), "spire/doors-outside", world({ heist: true }), { occupancy: occ([]), handle: "ann" });
  assert.deepEqual(a.rows, []);
  assert.deepEqual(a.entered, []);
  assert.equal(a.stranded, "spire/doors-outside");
  assert.equal(a.broken.field, "lands_at");
  assert.equal(a.broken.value, HEIST);
  assert.match(a.broken.because, /names no mark, so this portal leads nowhere\. You are standing at spire\/doors-outside, and nothing was recorded\.$/);
});

test("a list of ways is picked from, and nothing is recorded until the walker picks", () => {
  const w = world();
  const held = occ(["spire/grounds", "spire/hall"]);
  const asked = enter(AT(1095, 1050), "spire/chapel-arch", w, { occupancy: held, handle: "ann" });
  assert.deepEqual(asked.rows, []);
  assert.deepEqual(asked.choose.map((c) => c.id), ["spire/chapel", "spire/vestibule"]);
  const picked = enter(AT(1095, 1050), "spire/chapel-arch", w, { occupancy: held, handle: "ann", into: "spire/chapel" });
  assert.deepEqual(picked.entered, ["spire/chapel"]);
  assert.deepEqual([picked.landing.x, picked.landing.y], [1150, 1100], "no lands_at: into's own anchor");
  const wrong = enter(AT(1095, 1050), "spire/chapel-arch", w, { occupancy: held, handle: "ann", into: "town/green" });
  assert.match(wrong.error, /is not one of spire\/chapel-arch's ways/);
});

test("only the portal's own word is asked: opposed refuses and is recorded; terms wait", () => {
  const w = world();
  const doors = w.marks.find((m) => m.id === "spire/doors-outside");
  doors.entry = { ...doors.entry, word: "opposed" };
  const r = enter(AT(745, 1000), "spire/doors-outside", w, { occupancy: occ([]), handle: "ann" });
  assert.equal(r.refused.effect, "refused");
  assert.match(r.rows[0], /enters spire\/doors-outside · ferry 0\.0000 · word opposed$/);
  doors.entry = { word: "neutral", edge: "within", consequence: "mind the step", into: "spire/vestibule" };
  const t = enter(AT(745, 1000), "spire/doors-outside", w, { occupancy: occ([]), handle: "ann" });
  assert.equal(t.awaiting.effect, "terms");
  assert.deepEqual(t.rows, []);
});

// ── the dungeon's rules ──────────────────────────────────────────────────────

test("a dungeon is entered by its portals, never directly", () => {
  const a = enter(AT(1000, 1000), "spire/grounds", world(), { occupancy: occ([]), handle: "ann" });
  assert.equal(a.refused, "dungeon");
  assert.deepEqual(a.portals.map((p) => p.id), ["spire/doors-outside"]);
  assert.deepEqual(portalsInto("spire/grounds", world().marks).map((p) => p.id), ["spire/doors-outside"]);
});

test("a mark the dungeon hides is no mark at all to whoever has not entered", () => {
  const a = enter(AT(1150, 1100), "spire/chapel", world(), { occupancy: occ([]), handle: "ann" });
  assert.equal(a.error, "no mark 'spire/chapel' to enter");
});

test("inside a dungeon, the only enter is a portal, and exit is not offered", () => {
  const w = world();
  const held = occ(["spire/grounds", "spire/vestibule"]);
  // the hall is a neighbour, so from the vestibule it is hidden: no mark at all
  assert.equal(enter(AT(1000, 1000), "spire/hall", w, { occupancy: held, handle: "ann" }).error, "no mark 'spire/hall' to enter");
  // and a mark he CAN see, inside the room he is in, is still entered by no plain door
  const inHall = occ(["spire/grounds", "spire/hall"]);
  const e = enter(AT(1000, 1010), "spire/candle", w, { occupancy: inHall, handle: "ann" });
  assert.equal(e.refused, "dungeon");
  assert.match(e.error, /the only way to enter anything is a portal\. The portals where you stand: spire\/chapel-arch, spire\/hall-back$/);
  const x = exit("spire/grounds", w, { occupancy: held, handle: "ann" });
  assert.equal(x.refused, "dungeon");
  assert.match(x.error, /a dungeon offers no exit/);
  assert.deepEqual(x.portals.map((p) => p.id), ["spire/doors-inside", "spire/hall-door"]);
  assert.equal(exitPrompt(AT(600, 600), w, { occupancy: held, handle: "ann" }), null);
  assert.equal(enterPrompt(AT(1000, 1000), w, { occupancy: held, handle: "ann" }), null);
  assert.equal(heldDungeon(["spire/grounds", "spire/vestibule"], w.marks), "spire/grounds");
});

test("standing on a room's ground from outside offers nothing and reveals nothing", () => {
  const w = world();
  assert.equal(enterPrompt(AT(1150, 1100), w, { occupancy: occ([]), handle: "ann" }), null,
    "the Grounds have no portal law of their own and the chapel is hidden");
  const seen = scopeWorld(w, { held: [] });
  assert.deepEqual(containmentChain(AT(1150, 1100), seen.marks).map((c) => c.id), ["spire/grounds"]);
  assert.match(investigate("spire/chapel", seen).error, /no mark or terrain feature/);
});

test("OPAQUE FROM OUTSIDE: the dungeon reads as its own mark, nothing inside at any depth", () => {
  const hidden = hiddenFrom(world().marks, []);
  for (const id of ["spire/vestibule", "spire/hall", "spire/chapel", "spire/candle", "spire/doors-inside", "spire/hall-door", "spire/chapel-arch"])
    assert.ok(hidden.has(id), `${id} is hidden`);
  for (const id of ["spire/grounds", "spire/doors-outside", "spire/the-approach", "town/green"])
    assert.ok(!hidden.has(id), `${id} is seen`);
});

test("INSIDE: you read the room you entered and what it holds, not its neighbours", () => {
  const hidden = hiddenFrom(world().marks, ["spire/grounds", "spire/hall"]);
  for (const id of ["spire/candle", "spire/chapel-arch", "spire/hall-back"]) assert.ok(!hidden.has(id), `${id} is in the hall`);
  for (const id of ["spire/vestibule", "spire/chapel", "spire/hall-door"]) assert.ok(hidden.has(id), `${id} is a neighbour`);
});

test("a world without a dungeon is read exactly as before: the same object back", () => {
  const w = { marks: world().marks.filter((m) => m.class !== "dungeon") };
  assert.equal(scopeWorld(w, { held: [] }), w);
  assert.deepEqual(dungeonsOf(w.marks[0], w.marks), []);
});

test("a caller may keep marks a dungeon would hide (a household's own)", () => {
  const seen = scopeWorld(world(), { held: [], keep: (m) => m.by === "spire" });
  assert.ok(seen.marks.some((m) => m.id === "spire/chapel"));
});

// ── the lint ─────────────────────────────────────────────────────────────────

test("the ruled instance is clean", () => {
  assert.deepEqual(portalFindings(world().marks), []);
});

test("the heist reds the lint by name, and a named exception lets exactly it through", () => {
  const found = portalFindings(world({ heist: true }).marks);
  assert.deepEqual(found.map((f) => [f.mark, f.rule]), [["spire/doors-outside", "lands-at-names-a-mark"]]);
  const exc = [{ mark: "spire/doors-outside", rule: "lands-at-names-a-mark", by: "jetto", why: "the heist" },
               { mark: "spire/hall-door", rule: "exit-never-opposed", by: "nobody", why: "stale" }];
  const { findings, stale } = applyPortalExceptions(found, exc);
  assert.deepEqual(findings[0].excepted, { by: "jetto", why: "the heist" });
  assert.deepEqual(stale.map((e) => e.mark), ["spire/hall-door"]);
});

test("a landing more than the reach from its into is red", () => {
  const w = world();
  w.marks.find((m) => m.id === "spire/hall-door").entry.lands_at = { x: 905 + LANDING_REACH_M + 200, y: 1000 };
  assert.deepEqual(portalFindings(w.marks).map((f) => f.rule), ["lands-at-reaches-into"]);
});

test("an exit is never opposed — and with the only exit locked, no room has a way out", () => {
  const w = world();
  w.marks.find((m) => m.id === "spire/doors-inside").entry.word = "opposed";
  const rules = portalFindings(w.marks).map((f) => `${f.rule} ${f.mark}`).sort();
  assert.deepEqual(rules, [
    "exit-never-opposed spire/doors-inside",
    "path-to-an-exit spire/chapel", "path-to-an-exit spire/hall", "path-to-an-exit spire/vestibule",
  ]);
});

test("a room whose only door is locked has no path out, though the rest do", () => {
  const w = world();
  w.marks.find((m) => m.id === "spire/chapel-back").entry.word = "opposed";
  assert.deepEqual(portalFindings(w.marks).map((f) => `${f.rule} ${f.mark}`), ["path-to-an-exit spire/chapel"]);
});

test("G9 · siblings never overlap: two marks with one parent inside a dungeon", () => {
  const w = world();
  w.marks.push({ id: "spire/pantry", kind: "sited", by: "spire", at: { x: 1110, y: 950 }, extent: { w: 30, h: 30 }, body: "A pantry, half in the hall." });
  assert.deepEqual(portalFindings(w.marks).map((f) => `${f.rule} ${f.mark}`), ["rooms-do-not-overlap spire/hall"]);
  assert.match(portalFindings(w.marks)[0].msg, /spire\/hall overlaps spire\/pantry, and both stand directly in spire\/grounds inside spire\/grounds/);
});

test("G9 · a room's contents are its children, never its overlapping siblings", () => {
  // the candle stands inside the hall: same dungeon, different parent
  assert.deepEqual(portalFindings(world().marks), []);
});

test("G9 · two rooms drawn as rings that share a wall do not overlap; pushed into each other, they do", () => {
  const ring = (id, x0) => ({ id, kind: "sited", by: "spire", at: { x: x0 + 10, y: 860 }, extent: { w: 20, h: 20 },
    points: [[x0, 850], [x0 + 20, 850], [x0 + 20, 870], [x0, 870]], body: id });
  const w = world();
  w.marks.push(ring("spire/east-cell", 1200), ring("spire/west-cell", 1220));
  assert.deepEqual(portalFindings(w.marks), [], "a shared wall is not shared ground");
  w.marks[w.marks.length - 1] = ring("spire/west-cell", 1217);
  assert.deepEqual(portalFindings(w.marks).map((f) => f.rule), ["rooms-do-not-overlap"]);
});

test("G9 · two triangles splitting one square share only their diagonal, and that is no overlap", () => {
  // the boxes coincide, so only the ring test can answer, and the metre grid
  // lands squarely on the shared diagonal
  const tri = (id, pts) => ({ id, kind: "sited", by: "spire", at: { x: 1210, y: 860 }, extent: { w: 20, h: 20 }, points: pts, body: id });
  const w = world();
  w.marks.push(tri("spire/north-half", [[1200, 850], [1220, 850], [1200, 870]]),
               tri("spire/south-half", [[1220, 850], [1220, 870], [1200, 870]]));
  assert.deepEqual(portalFindings(w.marks), []);
});

test("standpointSight: the one function, keyed off the enter ledger; no handle has entered nothing", () => {
  const w = world();
  const occupancy = new Map([["ann", ["spire/grounds", "spire/hall"]]]);
  const ann = standpointSight(w, { occupancy, handle: "ann" });
  assert.ok(ann.marks.some((m) => m.id === "spire/candle"));
  assert.ok(!ann.marks.some((m) => m.id === "spire/chapel"));
  const nobody = standpointSight(w, { occupancy, handle: null });
  assert.ok(!nobody.marks.some((m) => m.id === "spire/candle"), "the spectator reads the dungeon alone");
  assert.equal(standpointSight({ marks: [] }, { occupancy }).marks.length, 0);
});

test("G4 · the walk inside a dungeon is fenced to the room entered; outside one there is no fence", () => {
  const w = world();
  assert.equal(walkFence(["spire/grounds", "spire/hall"], w.marks).id, "spire/hall");
  assert.equal(walkFence(["spire/grounds", "spire/vestibule"], w.marks).id, "spire/vestibule");
  assert.equal(walkFence(["spire/grounds"], w.marks).id, "spire/grounds", "in the dungeon but no room: the dungeon itself");
  assert.equal(walkFence(["spire/the-approach"], w.marks), null);
  assert.equal(walkFence([], w.marks), null);
});

test("an into naming no mark is red", () => {
  const w = world();
  w.marks.find((m) => m.id === "spire/hall-back").entry.into = "spire/nowhere";
  assert.ok(portalFindings(w.marks).some((f) => f.rule === "into-names-a-mark" && f.mark === "spire/hall-back"));
});

// ── the gate itself, as the settlement runs it ───────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const LINT = join(HERE, "mark-lint.mjs");
const REAL = join(HERE, "..", "WORLD", "marks", "let-there-be-light");
const SCRATCH = [];
after(() => { for (const d of SCRATCH) rmSync(d, { recursive: true, force: true }); });

function gateTree({ heist }) {
  const dir = mkdtempSync(join(tmpdir(), "portal-lint-")); SCRATCH.push(dir);
  const root = join(dir, "let-there-be-light");
  mkdirSync(root, { recursive: true });
  copyFileSync(join(REAL, "mark.md"), join(root, "mark.md"));
  cpSync(join(REAL, "logos"), join(root, "logos"), { recursive: true });
  // the dungeon class must be in the roster, so the works' chain to it comes too
  for (const rel of ["the-town-centre", "the-town-centre/the-keeping-works", "the-town-centre/the-keeping-works/postmark-node",
                     "the-town-centre/the-keeping-works/postmark-node/mark", "the-town-centre/the-keeping-works/postmark-node/mark/dungeon"]) {
    mkdirSync(join(root, rel), { recursive: true });
    copyFileSync(join(REAL, rel, "mark.md"), join(root, rel, "mark.md"));
  }
  for (const m of world({ heist }).marks) {
    if (m.by !== "spire") continue;
    const d = join(root, m.id.split("/")[1]);
    mkdirSync(d, { recursive: true });
    const lines = ["---", "kind: sited", "by: testerhh", "date: 2026-10-13",
      `at: { x: ${m.at.x}, y: ${m.at.y} }`, `extent: { w: ${m.extent.w}, h: ${m.extent.h} }`];
    if (m.class) lines.push(`class: ${m.class}`);
    // a fixture mark's id is <by>/<dir>, so the ids the laws name move with `by`
    const rid = (s) => s.replace(/^spire\//, "testerhh/");
    if (m.entry) lines.push(`entry: ${JSON.stringify({
      ...m.entry,
      into: Array.isArray(m.entry.into) ? m.entry.into.map(rid) : rid(m.entry.into),
      ...(typeof m.entry.lands_at === "string" ? { lands_at: rid(m.entry.lands_at) } : {}),
    })}`);
    lines.push("---", "", m.body, "");
    writeFileSync(join(d, "mark.md"), lines.join("\n"));
  }
  return dir;
}
function gate(dir, extra = []) {
  try { return { code: 0, out: execFileSync("node", [LINT, "--marks-dir", dir, ...extra], { encoding: "utf8" }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout ?? "") + String(e.stderr ?? "") }; }
}

test("THE GATE: the ruled instance lints clean, the heist refuses, and its named exception lets it through, said aloud", () => {
  const clean = gate(gateTree({ heist: false }));
  assert.equal(clean.code, 0, clean.out);

  const dir = gateTree({ heist: true });
  const red = gate(dir);
  assert.equal(red.code, 1, red.out);
  assert.match(red.out, /\[ERROR\] [^\n]*doors-outside: \[lands-at-names-a-mark\] entry\.lands_at: "testerhh\/the-gilded-doo-YOULL-NEVER-CATCH-ME" names no mark/);

  const exc = join(dir, "exceptions.json");
  writeFileSync(exc, JSON.stringify({ exceptions: [{ mark: "testerhh/doors-outside", rule: "lands-at-names-a-mark", by: "jetto", why: "the heist (WLD-18)" }] }));
  const let_through = gate(dir, ["--portal-exceptions", exc]);
  assert.equal(let_through.code, 0, let_through.out);
  assert.match(let_through.out, /\[WARN\] [^\n]*doors-outside: \[lands-at-names-a-mark\] EXCEPTED by WORLD\/portal-lint-exceptions\.json \(jetto: the heist \(WLD-18\)\)/);
});
