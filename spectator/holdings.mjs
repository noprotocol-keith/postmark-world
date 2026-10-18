// holdings.mjs — LOGOS v2 part 2 on the World page (POS-678): what a holder
// holds, where a carried thing stands, and the say card's numbers.
//
// THE PAGE READS WHAT THE RESIDENT READS. Every function here takes an answer
// the office already gives a resident (at MCP, or through the same doors over
// HTTP) and turns it into what the page says. None of them invents a number,
// and none asks for a wider read than the resident's:
//
//   holderLines(focus)               the close look at a mark, world { mark: id }:
//                                    `holder` { capacity, open } and `holds`
//                                    { count, class, shows, kinds } (office
//                                    world-kinds.mjs § investigateMark).
//   residentHoldLines(investigated)  the close look at a resident, world {
//                                    investigate: handle }: `holds` (the whole
//                                    things) and `holds_by_kind`.
//   handsLines(holdings)             your own hands, world_holdings (GET
//                                    /world/holdings, or read: "take"'s
//                                    `holdings`): `holding` and `kinds`.
//   carriersFrom(reads)              which thing is in whose hands, from the
//                                    reads that say so: your hands, the ground
//                                    within reach (read: "take"'s `ground`, each
//                                    row naming its `holder`), and any resident
//                                    you have looked at closely.
//   carriedAt / carriedWords         a held thing is drawn with its carrier and
//                                    told as in someone's hands, never at the
//                                    place it was last set (QA: "11 m southeast
//                                    of you" for a bag in your own hands).
//   sayCardNote(sources)             the say card's sentence, from the say
//                                    class's dials as the office reads them.
//   isThingKind(cls, lineage)        a kind of thing is a thing, by its class
//                                    chain (a halloween-candy-bowl extends thing).
//
// COUNTS ARE BLUR (LOGOS/classes.md § The transfer edge, ruled 2026-10-16
// 15:46–15:48): "a read gives it at the nearest common class, and investigate
// sharpens it". A card is a close look, so it shows the office's sharpened
// kinds beside the blurred headline, exactly as the office sharpened them; the
// page never re-counts a holding of its own.
//
// Browser-pure, no DOM: the column writes what these return as text.

/** A positive integer, or null: a count the office did not give is never 0. */
const countOf = (n) => (Number.isInteger(Number(n)) && Number(n) >= 0 ? Number(n) : null);
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

/** The sharpened kinds a holding read carries, in the office's own order and words. */
function kindsOf(block) {
  return (Array.isArray(block?.kinds) ? block.kinds : [])
    .filter((k) => k && k.kind != null && countOf(k.count) > 0)
    .map((k) => ({ kind: String(k.kind), count: countOf(k.count), shows: String(k.shows ?? `${k.count} ${k.kind}`) }));
}

/**
 * The close look's holding, or null when the mark is no holder (the office then
 * sends no `holds`). `whole` is the whole things it holds: the office counts
 * each one 1 toward `count` and sharpens only the counted kinds, so the whole
 * things are the count the kinds do not cover. `capacity` and `open` are null
 * when the read did not give them, and the page then says nothing about them.
 */
export function holderLines(focus) {
  if (!focus || focus.error || !focus.holds || typeof focus.holds !== "object") return null;
  const count = countOf(focus.holds.count) ?? 0;
  const kinds = kindsOf(focus.holds);
  const counted = kinds.reduce((s, k) => s + k.count, 0);
  const capacity = Number.isInteger(focus.holder?.capacity) ? focus.holder.capacity : null;
  const open = typeof focus.holder?.open === "boolean" ? focus.holder.open : null;
  return {
    count,
    shows: count ? String(focus.holds.shows ?? `${count} ${plural(count, "thing")}`) : null,
    kinds,
    whole: Math.max(0, count - counted),
    things: [],
    capacity, open,
  };
}

/** The resident close look's holding: their whole things by id, and their kinds. Null when the read carried neither. */
export function residentHoldLines(investigated) {
  if (!investigated || investigated.error) return null;
  const things = Array.isArray(investigated.holds) ? investigated.holds.map(String) : null;
  const byKind = investigated.holds_by_kind ?? null;
  if (things == null && byKind == null) return null;
  return handsShape({ things: things ?? [], byKind });
}

/** Your own hands, from world_holdings (`holding: [{ thing }]`, `kinds`). Null when the read is not one. */
export function handsLines(holdings) {
  if (!holdings || holdings.error || !Array.isArray(holdings.holding)) return null;
  return handsShape({ things: holdings.holding.map((h) => String(h?.thing ?? h)).filter(Boolean), byKind: holdings.kinds ?? null });
}

function handsShape({ things, byKind }) {
  const kinds = kindsOf(byKind);
  const count = things.length + kinds.reduce((s, k) => s + k.count, 0);
  // the office's own blur when it is the whole holding; with whole things beside
  // the kinds it gave none, and every kind and every holder is a thing
  const shows = count && !things.length && byKind?.shows ? String(byKind.shows) : null;
  return { count, shows, kinds, whole: 0, things, capacity: null, open: null };
}

const OPEN_WORDS = {
  true: "open: other households may give into it and take from it",
  false: "closed: only its maker's household may give into it or take from it",
};

/**
 * The holding as plain lines, for the column (which builds its own nodes):
 * `head` (the blurred headline, with the room when the read gave it), `items`
 * (each sharpened kind, each whole thing by name, and any whole things the
 * read counted without naming), and `open` (null when the read said nothing).
 */
export function holdingParts(lines, { nameOf = (id) => id } = {}) {
  if (!lines) return null;
  const head = !lines.count ? "nothing" : lines.shows ?? `${lines.count} ${plural(lines.count, "thing")}`;
  return {
    head: lines.capacity != null ? `${head} · ${lines.count} of ${lines.capacity}` : head,
    items: lines.count ? [
      ...lines.kinds.map((k) => k.shows),
      ...lines.things.map((id) => nameOf(id)),
      ...(lines.whole ? [`${lines.whole} whole ${plural(lines.whole, "thing")}`] : []),
    ] : [],
    open: lines.open == null ? null : OPEN_WORDS[lines.open],
  };
}

// ── WHO CARRIES WHAT ─────────────────────────────────────────────────────────
//
// "Where a thing stands is derived, never stored: a held thing rides its
// holder" (office world-apex.mjs § groundWithinReach's reading_law). The page
// derives nothing of its own: it takes the holder each read names. A holder
// can itself be held (a bag in a bag in your hands), so the chain is followed
// up to whoever, or whatever, finally stands somewhere.

/** A thing's id is `<by>/<slug>`; a resident is a bare handle. */
export const isThingId = (id) => typeof id === "string" && id.includes("/");

/**
 * thing id → its immediate holder, from the reads in hand:
 *   self + hands   your own hands (world_holdings' `holding`)
 *   ground         read: "take"'s `ground.things`, each row with `holder` when held
 *   investigated   [{ handle, holds: [ids] }], residents you looked at closely
 * A later read overrides an earlier one only where it names the same thing.
 */
export function carriersFrom({ self = null, hands = null, ground = null, investigated = [] } = {}) {
  const out = new Map();
  for (const row of Array.isArray(ground?.things) ? ground.things : Array.isArray(ground) ? ground : [])
    if (row?.thing && row.holder) out.set(String(row.thing), String(row.holder));
  for (const inv of investigated ?? [])
    if (inv?.handle) for (const id of Array.isArray(inv.holds) ? inv.holds : []) out.set(String(id), String(inv.handle));
  if (self) for (const h of Array.isArray(hands?.holding) ? hands.holding : []) {
    const id = h?.thing ?? h;
    if (id) out.set(String(id), String(self));
  }
  return out;
}

/** The chain of holders above a thing, innermost first, or [] when nobody holds it. Bounded: a loop names no one. */
export function holderChain(id, carriers) {
  const chain = [];
  const seen = new Set([String(id)]);
  let at = carriers?.get?.(String(id));
  while (at != null && !seen.has(at) && chain.length < 16) {
    chain.push(at);
    seen.add(at);
    at = carriers.get(at);
  }
  return chain;
}

/**
 * Where a held thing is drawn: its outermost holder's body when that is a
 * resident the page can place (`bodyAt(handle)`), else that holder's own place
 * (`markAt(id)`) for a thing inside a holder set down. Null when nobody holds
 * it, or when its holder cannot be placed — then the page draws it nowhere
 * rather than at the place it used to be.
 */
export function carriedAt(id, carriers, { bodyAt = () => null, markAt = () => null } = {}) {
  const chain = holderChain(id, carriers);
  if (!chain.length) return null;
  const top = chain[chain.length - 1];
  const at = isThingId(top) ? markAt(top) : bodyAt(top);
  return at && Number.isFinite(Number(at.x)) && Number.isFinite(Number(at.y))
    ? { x: Number(at.x), y: Number(at.y), holder: chain[0], carrier: top, chain }
    : { x: null, y: null, holder: chain[0], carrier: top, chain, unplaced: true };
}

/** "in your hands", "in sb-ash's hands", "inside A Cloth Bag, in your hands"; null when nobody holds it. */
export function carriedWords(id, carriers, { self = null, nameOf = (x) => x } = {}) {
  const chain = holderChain(id, carriers);
  if (!chain.length) return null;
  const hands = (h) => (self != null && h === self ? "in your hands" : `in ${h}'s hands`);
  return chain.map((h) => (isThingId(h) ? `inside ${nameOf(h)}` : hands(h))).join(", ");
}

// ── THE SAY CARD ─────────────────────────────────────────────────────────────
//
// The page said "fades from hearing in five minutes": a constant from before
// POS-226, wrong twice. The say class's `fade_min` is 15 on the record and is
// the DISPLAY fade only ("Minutes a voice stays drawn on the map. Only what a
// page shows fades here; an ear hears every voice until the next settlement",
// WORLD … /say/fade-min). So the numbers come from the office: the say card's
// own dials when the palette carries them, else the conversations read the
// page already makes (`earshot_m`, `fade_minutes`, and `hearable_since`, which
// is where an ear's window opens: the settlement). With neither, the card says
// no number at all.

const dialValue = (d) => {
  const v = d != null && typeof d === "object" ? (d.value ?? d.default) : d;
  return Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : null;
};

/** The say card's sentence, from what the office said. */
export function sayCardNote({ dials = null, conversations = null } = {}) {
  const earshot = dialValue(dials?.earshot_m) ?? dialValue(conversations?.earshot_m);
  const fade = dialValue(dials?.fade_min) ?? dialValue(conversations?.fade_minutes);
  const untilSettlement = !!conversations && Object.prototype.hasOwnProperty.call(conversations, "hearable_since");
  const carries = earshot != null ? `a voice carries ${earshot} metres` : "a voice carries as far as earshot";
  const drawn = fade != null ? ` and stays drawn on the map for ${fade} ${plural(fade, "minute")}` : "";
  const hears = untilSettlement
    ? "everyone in earshot can hear it until the next settlement, nobody else does"
    : "everyone in earshot hears it, nobody else does";
  return `${carries}${drawn}. ${hears}, and the town keeps its conversations browsable.`;
}

// ── A KIND OF THING IS A THING ───────────────────────────────────────────────

/**
 * Whether a mark's class is thing or a kind of thing. `lineage` is either the
 * class chain's names (the fold's class marks, `classChain`) or the office's
 * `class_pointer` ("kind: halloween-candy-bowl · a thing · a sited — explain: …",
 * office class-read.mjs § classPointer), whichever the page holds.
 */
export function isThingKind(cls, { chain = null, pointer = null } = {}) {
  if (cls === "thing") return true;
  if (Array.isArray(chain) && chain.map(String).includes("thing")) return true;
  if (typeof pointer === "string") {
    const head = pointer.split(" — ")[0];
    return head.split(" · ").slice(1).some((part) => /^an? thing$/.test(part.trim()));
  }
  return false;
}
