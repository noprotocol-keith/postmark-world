// mark-kind.mjs — WHAT A RECORD IS, AND HOW IT STANDS, IN EITHER FORM (LOGOS v2 part 2, W2).
//
// LOGOS/classes.md § The LOGOS ladder (ruled 2026-10-16 16:02): "`kind` is a
// flat field naming the node's own class … The `class:` field folds into
// `kind`: a class node's name is its own slug, so `kind: candy` names
// `the-town/candy`." A thing that wrote `kind: sited` + `class: thing` writes
// `kind: thing` now.
//
// Both forms are read, always: the old form is every store folded before the
// migration, every record a door wrote before its own readers moved, and every
// fixture. One home for the two questions every reader asks, so no reader
// spells either form out for itself:
//
//   instanceClassOf(m)  the class an instance names — its `class:` in the old
//                       form, its `kind:` in the new; undefined for a plain
//                       sited mark, a parcel, a predicate or a naming written
//                       with their standing word, and for class and property
//                       nodes (they ARE class space; their name is `class:`).
//   isSited(m)          it stands on the ground as a sited mark: it carries a
//                       place, and it is none of the kinds that never do. The
//                       lint holds every non-ground kind to no `at` (a
//                       predicate takes its parent's locus, a class or a
//                       property has no where, a post stands nowhere), so the
//                       place is the answer and no class tree is needed to ask.
//   isGround(m)         sited, or a parcel with its place: what can contain.
//
// Browser-pure: the viewer and the store readers ask through it too.

/** The standing words `kind:` wrote before it named the class, and the node kinds. */
export const STANDING_WORDS = Object.freeze(new Set(["sited", "predicated", "predicate", "naming", "parcel", "class", "property", "post"]));

const NEVER_GROUND = new Set(["predicated", "predicate", "naming", "class", "property", "parcel"]);

export function instanceClassOf(m) {
  if (!m || m.kind === "class" || m.kind === "property") return undefined;
  if (m.class !== undefined) return String(m.class);
  return m.kind != null && !STANDING_WORDS.has(String(m.kind)) ? String(m.kind) : undefined;
}

export const isSited = (m) => !!m && !!m.at && !NEVER_GROUND.has(String(m.kind));

export const isGround = (m) => !!m && !!m.at && (m.kind === "parcel" || isSited(m));

/** A claim standing under a mark, in either spelling: `kind: predicate` names the
 *  class (G10, settled 2026-10-17); `kind: predicated` is the standing word it
 *  replaced, which every store folded before it, and every door that writes it
 *  until its readers move, still carries. A naming is a predicate too, as the
 *  class tree says (naming extends predicate) and the site's helper reads it.
 *  It is asked of the record's kind, so a class or property node (kind: class,
 *  kind: property), the predicate class's own declaration included, never is. */
const PREDICATE_KINDS = new Set(["predicated", "predicate", "naming"]);
export const isPredicate = (m) => PREDICATE_KINDS.has(m?.kind);
