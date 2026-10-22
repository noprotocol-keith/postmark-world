// outsider-and-fill.test.mjs — two pieces ruled in Sitting B (WLD-26, 2026-10-19
// 17:48): the outsider view and the per-thing fill flag.
//
// THE OUTSIDER VIEW. "View as an outsider" reads the world as if the reading
// household owned nothing. The owner rule ("a household's own marks are always
// its own to see") is the `keep` a caller hands the world tools' one sight
// function, standpointSight; the office's `lens: "outsider"` hands it none, and
// the page asks the office for that read and lays none of the household's own
// rows over it. One switch on one rule, never a second copy of sight.
//
// THE FILL FLAG. A picture-less thing draws a tinted block; `fill: false` (the
// thing class's sovereign property, default true) draws its outline alone, so a
// floor's art beneath it shows through. The lint holds it to true or false.
// Run: node --test tools/outsider-and-fill.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { placeholderExtentSVG, lensQuery, mineForSight, foldForSight, OUTSIDER_LENS } from "../spectator/viewer.mjs";
import { standpointSight } from "./world-verbs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SOURCE = readFileSync(join(ROOT, "spectator", "viewer.mjs"), "utf8");

// ── the fill flag ────────────────────────────────────────────────────────────
const geometry = { kind: "sited", at: { x: 0, y: 0 }, extent: { w: 4, h: 4 } };
const px = (p) => p;
const thing = (extra = {}) => placeholderExtentSVG({ ...geometry, id: "maker/a-crate", class: "thing", ...extra }, px);

test("fill absent: a picture-less thing draws as it always has, the tinted block", () => {
  assert.match(thing(), /class="wv-ph-extent is-thing"/);
  assert.match(thing({ fill: true }), /class="wv-ph-extent is-thing"/, "true is the default, said aloud");
  assert.match(thing({ fill: "true" }), /class="wv-ph-extent is-thing"/, "as the record grammar writes it");
});

test("fill: false draws the thing's outline alone, as ground is drawn", () => {
  // ⚑ THE FLIP: drop `&& propertyValue(mark.fill) !== false` in placeholderExtentSVG → these red
  assert.match(thing({ fill: false }), /class="wv-ph-extent"/);
  assert.doesNotMatch(thing({ fill: false }), /is-thing/);
  assert.doesNotMatch(thing({ fill: "false" }), /is-thing/, "the word false, as a record writes it");
  const place = placeholderExtentSVG({ ...geometry, id: "maker/a-crate" }, px);
  assert.equal(thing({ fill: false }), place, "the very markup a place of the same id gets");
});

// the lint, over a copy of the real tree with one thing of our own laid in it
const SCRATCH = [];
after(() => { for (const d of SCRATCH) rmSync(d, { recursive: true, force: true }); });
function treeWith(fillLine) {
  const repo = mkdtempSync(join(tmpdir(), "fill-")); SCRATCH.push(repo);
  mkdirSync(join(repo, "WORLD"), { recursive: true });
  cpSync(join(ROOT, "LOGOS"), join(repo, "LOGOS"), { recursive: true });
  copyFileSync(join(ROOT, "WRITES.md"), join(repo, "WRITES.md"));
  for (const f of ["skeleton.json", "filing-freeze.json", "households.json"]) copyFileSync(join(ROOT, "WORLD", f), join(repo, "WORLD", f));
  cpSync(join(ROOT, "WORLD", "marks"), join(repo, "WORLD", "marks"), { recursive: true });
  const dir = join(repo, "WORLD", "marks", "fill-probe", "the-crate");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "mark.md"), `---\nkind: thing\nby: fill-probe\ndate: 2026-10-22\nat: { x: 90000, y: 90000 }\nextent: { w: 1, h: 1 }\n${fillLine}---\n\nA crate.\n`);
  return repo;
}
const lint = (repo) => {
  try { return execFileSync("node", [join(HERE, "mark-lint.mjs"), "--repo", repo], { encoding: "utf8" }); }
  catch (e) { return String(e.stdout ?? "") + String(e.stderr ?? ""); }
};
const fillErrors = (out) => out.split("\n").filter((l) => /fill-probe\/the-crate/.test(l) && /fill: is true or false/.test(l));

test("the lint: fill is true or false; anything else is refused by name", () => {
  // ⚑ THE FLIP: drop the 5d rule in mark-lint.mjs → the refusal is gone and this reds
  const bad = lint(treeWith("fill: no\n"));
  assert.equal(fillErrors(bad).length, 1, "one refusal, for the crate");
  assert.match(fillErrors(bad)[0], /^\[ERROR\]/, "an error, not an advisory");
  assert.match(fillErrors(bad)[0], /got "no"/);
  assert.equal(fillErrors(lint(treeWith("fill: false\n"))).length, 0, "false is lawful");
  assert.equal(fillErrors(lint(treeWith(""))).length, 0, "absent is lawful: the default");
});

test("the thing class declares fill: sovereign, default true", () => {
  const node = readFileSync(join(ROOT, "WORLD/marks/let-there-be-light/the-town-centre/the-keeping-works/postmark-node/mark/thing/thing-fill/mark.md"), "utf8");
  assert.match(node, /^kind: property$/m);
  assert.match(node, /^tier: sovereign$/m);
  assert.match(node, /^name: fill$/m);
  assert.match(node, /^default: true$/m, "today's draw is the default (the ruling)");
});

// ── the outsider view ────────────────────────────────────────────────────────
// a closed place (a dungeon) made by the household `mason`, with a room inside
const TOWER = "mason/the-tower";
const WORLD = { marks: [
  { id: "mason/yard", kind: "sited", by: "mason", at: { x: 1000, y: 1000 }, extent: { w: 500, h: 400 } },
  { id: TOWER, kind: "sited", by: "mason", class: "dungeon", at: { x: 1000, y: 1000 }, extent: { w: 300, h: 300 } },
  { id: "mason/hall", kind: "sited", by: "mason", at: { x: 1030, y: 1000 }, extent: { w: 200, h: 200 } },
] };
const ids = (w) => w.marks.map((m) => m.id).sort();

test("the one switch: the owner rule is the keep the sight function is handed, and the lens hands none", () => {
  const own = standpointSight(WORLD, { handle: "mason", keep: (m) => m.by === "mason" });
  assert.ok(ids(own).includes("mason/hall"), "without the lens, a household reads inside its own closed place");
  const outsider = standpointSight(WORLD, { handle: "mason", keep: null });
  const stranger = standpointSight(WORLD, { handle: "ann" });
  assert.deepEqual(ids(outsider), ids(stranger), "with it, exactly what a stranger reads");
  assert.ok(!ids(outsider).includes("mason/hall"));
});

test("the page's lens: the read asks for it, lays none of your own rows over it, and draws the town's fold", () => {
  assert.equal(lensQuery(false), "", "off: the read you always asked for, byte for byte");
  assert.equal(lensQuery(true), `&lens=${OUTSIDER_LENS}`);
  const mine = new Map([["mason/draft", { id: "mason/draft" }]]);
  assert.equal(mineForSight(false, mine), mine);
  assert.equal(mineForSight(true, mine).size, 0, "no draft and no mark of yours the read did not tell");
  assert.equal(foldForSight({ trueWorld: "town", myWorld: "yours" }, false), "yours");
  assert.equal(foldForSight({ trueWorld: "town", myWorld: "yours" }, true), "town");
  assert.equal(foldForSight({ trueWorld: "town", myWorld: null }, false), "town");
});

test("[pin] the toggle: off at every load, offered only to someone with a household, and every resident read carries the lens", () => {
  // ⚑ THE FLIP: drop `${lensQuery(state.outsider)}` from loadResidentRead's url → the first line reds
  assert.match(SOURCE, /\+ `&crossing=\$\{state\.crossing\}&telling=true\$\{lensQuery\(state\.outsider\)\}`\);/, "the resident read");
  assert.match(SOURCE, /&handle=\$\{encodeURIComponent\(who\)\}\$\{lensQuery\(state\.outsider\)\}/, "the close look");
  assert.match(SOURCE, /outsider: false,\s+\/\/ the outsider lens \(WLD-26\): off at every load/);
  assert.match(SOURCE, /<button type="button" class="ctl wv-outsider-toggle" aria-pressed="false" hidden aria-label="view as an outsider"/);
  assert.match(SOURCE, /const offered = canAct\(\) && !!state\.handle;/);
  assert.match(SOURCE, /data\.worldState = foldForSight\(data, state\.outsider\);/);
  assert.doesNotMatch(SOURCE, /residentById\(\w+( \?\? \{\})?, mineSet\.marks\)/, "every resident index asks mineForSight");
});
