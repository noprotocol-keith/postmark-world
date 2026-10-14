#!/usr/bin/env node
// registry-reconcile.mjs — the publication registry's rows follow the marks
// they name, in the SAFE DIRECTION ONLY (postmark#3757).
//
// `WORLD/settlement-publications.json` is the sweep's record of what it
// published: per mark, the household, the path it filed and the class it
// judged. Only the sweep writes a row, when it publishes or unpublishes. Any
// other act that moves a published file leaves the row behind: the hand
// filings of 10-03/10-04 (8260eaaf, 49e9a92f, world #140) re-filed four
// predicates and naming marks under their declared parents, and kinofire's
// fireplace and firepit went on reading `class: commons` at a root path that
// no longer existed. Their households were warned of a sweep that the sweep's
// own rule (unpublish-verdict.mjs) could never carry out. A mark's standing
// can also change under a row that did not move (a parcel arrives, a ground
// welcomes it), so a row's stored class can lag the mark's derived one.
//
// This verb rewrites each row to the mark's CURRENT filing and its CURRENT
// derived class (world-state.json's `tier`, the fold's markStanding, in the
// registry's spelling), with one bound: a row is repaired only when the repair
// makes the sweep take NOTHING it would not take today. Under today's rule the
// sweep takes a row at zero escrow when its class is commons and its path is on
// main; so a repair whose new class is commons, from a row that was not already
// a commons row at a path on main, would make a mark newly sweepable. That is
// the founder's call (WLD-51), and such a row is HELD: listed by name, never
// written. Everything else is safe to write: a home or constitution row is
// never swept, whatever its path.
//
// A row whose mark no longer stands and has no filing is removed. A row whose
// mark stands but whose filing cannot be found (or is found twice) is left as
// it is and listed as unresolved.
//
//   node tools/registry-reconcile.mjs            # dry run: what would change
//   node tools/registry-reconcile.mjs --write    # write the safe repairs
//
// Run it after any act that moves a published mark's file, and whenever
// tools/registry-paths.test.mjs reds.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarks } from "./marks-fold.mjs";
import { rowClassOf } from "./unpublish-verdict.mjs";

export const REGISTRY_REL = "WORLD/settlement-publications.json";

/**
 * The plan, pure.
 * @param published  the registry's `published` map.
 * @param filingOf   `(id) => "WORLD/marks/…/mark.md" | null` — where the mark is filed now (null: none, or ambiguous).
 * @param tierOf     `(id) => tier | undefined` — the mark's derived standing on main; undefined when it does not stand.
 * @returns `{ repairs, removed, held, unresolved }`, each a list of `{ id, from, to?, why }` in registry order.
 */
export function reconcilePlan(published, { filingOf, tierOf }) {
  const repairs = [], removed = [], held = [], unresolved = [];
  for (const [id, row] of Object.entries(published ?? {})) {
    const from = { path: row.path, class: row.class };
    const tier = tierOf(id);
    const filed = filingOf(id);
    if (tier === undefined) {
      if (filed) unresolved.push({ id, from, why: "filed but not standing in world-state.json: a fold error or a stale state; left as it is" });
      else removed.push({ id, from, why: "the mark no longer stands and has no filing" });
      continue;
    }
    if (!filed) { unresolved.push({ id, from, why: "the mark stands but no single filing answers to its id; left as it is" }); continue; }
    const to = { path: filed, class: rowClassOf(tier) };
    if (to.path === from.path && to.class === from.class) continue;
    const sweptToday = from.class === "commons" && from.path === filed; // the stored path IS the mark's file, so it is on main
    if (to.class === "commons" && !sweptToday) {
      held.push({ id, from, to, why: "WLD-51: this repair would make a zero-escrow commons mark sweepable; the founder rules first" });
      continue;
    }
    repairs.push({ id, from, to, why: to.class === from.class ? "path" : to.path === from.path ? "class" : "path and class" });
  }
  return { repairs, removed, held, unresolved };
}

/** Apply a plan to the registry document; returns a new document. Held and unresolved rows are untouched. */
export function applyPlan(doc, plan) {
  const published = { ...doc.published };
  for (const r of plan.repairs) published[r.id] = { ...published[r.id], path: r.to.path, class: r.to.class };
  for (const r of plan.removed) delete published[r.id];
  return { ...doc, published };
}

/** The repo's own inputs: the tree's filings by id, and world-state.json's derived tiers. */
export function reconcileRepo(repo) {
  const marksDir = join(repo, "WORLD", "marks");
  const filings = new Map();
  for (const rec of loadMarks(marksDir)) {
    if (rec._error || !rec.id || !rec._dir) continue;
    const path = `WORLD/marks/${relative(marksDir, rec._dir).split("\\").join("/")}/mark.md`;
    filings.set(rec.id, filings.has(rec.id) ? null : path);   // two filings for one id: ambiguous
  }
  const state = JSON.parse(readFileSync(join(repo, "WORLD", "world-state.json"), "utf8"));
  const tiers = new Map((state.marks ?? []).map((m) => [m.id, m.tier]));
  const doc = JSON.parse(readFileSync(join(repo, REGISTRY_REL), "utf8"));
  const plan = reconcilePlan(doc.published, { filingOf: (id) => filings.get(id) ?? null, tierOf: (id) => tiers.get(id) });
  return { doc, plan };
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const opt = (name, def = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
  const repo = resolve(opt("--repo", join(dirname(fileURLToPath(import.meta.url)), "..")));
  const write = args.includes("--write");
  const { doc, plan } = reconcileRepo(repo);
  const line = (r) => `  ${r.id}  ${r.from.class} ${r.from.path}${r.to ? `  ->  ${r.to.class} ${r.to.path}` : ""}  (${r.why})`;
  console.log(`${write ? "" : "DRY RUN · "}${Object.keys(doc.published).length} registry rows`);
  console.log(`repaired: ${plan.repairs.length}`); plan.repairs.forEach((r) => console.log(line(r)));
  console.log(`removed: ${plan.removed.length}`); plan.removed.forEach((r) => console.log(line(r)));
  console.log(`HELD for WLD-51: ${plan.held.length}`); plan.held.forEach((r) => console.log(line(r)));
  console.log(`unresolved: ${plan.unresolved.length}`); plan.unresolved.forEach((r) => console.log(line(r)));
  if (write && (plan.repairs.length || plan.removed.length))
    writeFileSync(join(repo, REGISTRY_REL), `${JSON.stringify(applyPlan(doc, plan), null, 2)}\n`);
}
