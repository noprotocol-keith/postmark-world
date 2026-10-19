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
//                                    reads that say so, the freshest winning:
//                                    your hands, the ground within reach (read:
//                                    "take"'s `ground`, each row naming its
//                                    `holder` or none), and any resident you
//                                    have looked at closely. A thing inside a
//                                    bag is not moved (no read names it).
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
  // COUNTS CONFER UP (office hotfix w43.1, Darko 2026-10-17 23:29): when something
  // inside holds things, `count` is the room's own number (a bowl of 8 and a bag
  // of 8 reads 17), and `whole` names each whole thing with what it holds. The
  // page never derives a count of its own: the whole things are the office's
  // list, and only a read without one leaves them as what `count` minus the
  // kinds leaves (each counting 1 there).
  const listed = Array.isArray(focus.holds.whole) ? focus.holds.whole.filter((w) => w?.thing) : null;
  const names = new Map((listed ?? []).map((w) => {
    const name = String(w.name ?? w.thing), holds = countOf(w.holds);
    return [String(w.thing), holds ? `${name} holding ${holds}` : name];
  }));
  return {
    count,
    shows: count ? String(focus.holds.shows ?? `${count} ${plural(count, "thing")}`) : null,
    kinds,
    whole: listed ? 0 : Math.max(0, count - counted),
    things: (listed ?? []).map((w) => String(w.thing)),
    names,
    capacity, open,
  };
}

/**
 * A held thing as a read names it: a resident close look's `holds` is a list of
 * mark ROWS, `{ id, name, body }` (office world-investigate-entity.mjs, where
 * the ids are looked up as marks), world_holdings' is `{ thing }`; a bare id
 * is read too.
 */
export const heldIdOf = (h) => String(h?.id ?? h?.thing ?? h);
const heldNameOf = (h) => (h && typeof h === "object" && h.name != null && String(h.name).trim() ? String(h.name) : null);

/**
 * The resident close look's holding: their whole things by id (named as the
 * office named them), and their kinds. Null when the read carried neither; a
 * `holds` the office could not read (`{ unavailable }`) is no list at all.
 */
export function residentHoldLines(investigated) {
  if (!investigated || investigated.error) return null;
  const rows = Array.isArray(investigated.holds) ? investigated.holds : null;
  const byKind = investigated.holds_by_kind ?? null;
  if (rows == null && byKind == null) return null;
  const names = new Map((rows ?? []).filter((h) => heldNameOf(h)).map((h) => [heldIdOf(h), heldNameOf(h)]));
  return { ...handsShape({ things: (rows ?? []).map(heldIdOf), byKind, hands: byKind?.hands ?? null }), names };
}

/**
 * Your own hands, from world_holdings (`holding: [{ thing }]`, `count`, `kinds`).
 * The door pages its whole things (20 a page against a capacity of 24), so the
 * count is the read's `count`, and any it did not list on this page are told
 * as whole things it counted. Null when the read is not one.
 */
export function handsLines(holdings) {
  if (!holdings || holdings.error || !Array.isArray(holdings.holding)) return null;
  const things = holdings.holding.map((h) => String(h?.thing ?? h)).filter(Boolean);
  return handsShape({ things, total: countOf(holdings.count) ?? things.length, byKind: holdings.kinds ?? null,
    hands: holdings.hands ?? holdings.kinds?.hands ?? null });
}

/**
 * HANDS IN THE OFFICE'S OWN WORDS (Darko 2026-10-18 12:17: "7 of 24 slots · 21
 * things in all"; office #623 fix D). The hands read carries `hands: { slots:
 * { used, of }, in_all, shows }` beside `kinds` (and as `kinds.hands`, so a
 * resident's close look carries it in `holds_by_kind`). Its `shows` is the
 * column's "carrying" line, verbatim; the page computes neither number. A read
 * without it keeps the line the page has said until now.
 */
function handsShape({ things, total = things.length, byKind, hands = null }) {
  const kinds = kindsOf(byKind);
  const whole = Math.max(0, total - things.length);
  const count = things.length + whole + kinds.reduce((s, k) => s + k.count, 0);
  // the office's own blur when it is the whole holding; with whole things beside
  // the kinds it gave none, and every kind and every holder is a thing
  const shows = count && !things.length && !whole && byKind?.shows ? String(byKind.shows) : null;
  const said = typeof hands?.shows === "string" && hands.shows.trim() ? hands.shows.trim() : null;
  return { count, shows, kinds, whole, things, names: new Map(), capacity: null, open: null, ...(said ? { said } : {}) };
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
  // the office's own sentence for a resident's hands wins whole (handsShape § hands)
  const head = lines.said ?? (!lines.count ? "nothing" : lines.shows ?? `${lines.count} ${plural(lines.count, "thing")}`);
  return {
    head: lines.capacity != null ? `${head} · ${lines.count} of ${lines.capacity}` : head,
    items: lines.count ? [
      ...lines.kinds.map((k) => k.shows),
      ...lines.things.map((id) => lines.names?.get(id) ?? nameOf(id)),
      ...(lines.whole ? [`${lines.whole} whole ${plural(lines.whole, "thing")}`] : []),
    ] : [],
    open: lines.open == null ? null : OPEN_WORDS[lines.open],
  };
}

// ── WHO CARRIES WHAT ─────────────────────────────────────────────────────────
//
// "Where a thing stands is derived, never stored: a held thing rides its
// holder" (office world-apex.mjs § groundWithinReach's reading_law). The page
// derives nothing of its own: it takes what each read says, and for each thing
// the FRESHEST read wins.
//
//   a holder's own list   your hands (world_holdings) or a resident's close look
//                         (investigate: `holds`): "this resident holds these".
//                         A complete list also says they hold nothing else, so a
//                         thing they set down leaves them.
//   a ground row          read: "take"'s `ground.things`: a row with `holder` is
//                         held by that resident; a row without one is NOT held,
//                         and a fresher such row clears an older claim. A
//                         set-down row stands at its `stands_at`.
//
// A THING INSIDE A BAG IS NOT MOVED (a known gap). No office read says a thing
// is inside a holder: the ground read drops a row whose holder is a thing
// (whereThingStands gives it no place), and a close look gives a holder's
// holding as counts, never ids. So a bag in your hands rides you, and a bag
// inside that bag stays drawn where it was. That needs an office read first.

/** A thing's id is `<by>/<slug>`; a resident is a bare handle. */
export const isThingId = (id) => typeof id === "string" && id.includes("/");
const pointOf = (p) => (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) ? { x: Number(p.x), y: Number(p.y) } : null);

/**
 * A resident's close look as a holder's list: their whole things, complete
 * (the look lists every one), saying nothing once it is `maxAgeMs` old (it
 * then `expires`). Null when the look carried no list.
 */
export function residentList(handle, investigated, at = 0, maxAgeMs = Infinity) {
  if (!handle || !investigated || investigated.error || !Array.isArray(investigated.holds)) return null;
  return { at, holder: String(handle), things: investigated.holds.map(heldIdOf), complete: true, expires: at + maxAgeMs };
}

/** Your hands as a holder's list: complete only when the page holds every thing the read counted. */
export function handsList(handle, holdings, at = 0) {
  if (!handle || !holdings || holdings.error || !Array.isArray(holdings.holding)) return null;
  const things = holdings.holding.map((h) => String(h?.thing ?? h)).filter(Boolean);
  const total = countOf(holdings.count) ?? things.length;
  return { at, holder: String(handle), things, complete: holdings.complete !== false && things.length >= total };
}

/**
 * What the page knows of who carries what, from reads taken at `at` (ms):
 *   { at, holder, things, complete }   a holder's own list
 *   { at, ground: [rows] }             the ground within reach
 * Applied oldest first, so the freshest read wins for each thing. A read whose
 * `expires` is at or before `now` says nothing: a held thing it alone placed
 * falls back to where the record has it, as before any read. Returns
 * `holders` (thing → resident) and `placed` (thing → where a set-down row
 * says it stands).
 */
export function carriersFrom(reads = [], { now = -Infinity } = {}) {
  const holders = new Map(), placed = new Map();
  for (const r of [...(reads ?? [])].filter((r) => r && !(Number(r.expires) <= now)).sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0))) {
    if (Array.isArray(r.ground)) for (const row of r.ground) {
      if (!row?.thing) continue;
      const id = String(row.thing);
      // a resident's hands; a thing as holder is a row the office never sends, and it moves nothing
      const holder = row.holder != null && !isThingId(String(row.holder)) ? String(row.holder) : null;
      if (holder) { holders.set(id, holder); placed.delete(id); continue; }
      holders.delete(id);
      const at = row.place_from === "set-down" ? pointOf(row.stands_at) : null;
      if (at) placed.set(id, at); else placed.delete(id);
    }
    if (r.holder != null) {
      const holder = String(r.holder);
      const things = new Set((r.things ?? []).map(heldIdOf));
      if (r.complete !== false) for (const [id, who] of holders) if (who === holder && !things.has(id)) holders.delete(id);
      for (const id of things) { holders.set(id, holder); placed.delete(id); }
    }
  }
  return { holders, placed };
}

/**
 * Where the page draws a thing the reads have spoken of: a held thing at its
 * carrier's body (`bodyAt(handle)`), or nowhere (`unplaced`) when the carrier
 * cannot be placed, never at the place it used to be; a set-down thing where
 * the ground read says it stands. Null when no read has spoken of it.
 */
export function carriedAt(id, known, { bodyAt = () => null } = {}) {
  const key = String(id);
  const holder = known?.holders?.get?.(key);
  if (holder != null) {
    const at = pointOf(bodyAt(holder));
    return at ? { ...at, holder } : { x: null, y: null, holder, unplaced: true };
  }
  const set = known?.placed?.get?.(key);
  return set ? { ...set, holder: null, setDown: true } : null;
}

/** "in your hands", "in sb-ash's hands"; null when no read says anyone holds it. */
export function carriedWords(id, known, { self = null } = {}) {
  const holder = known?.holders?.get?.(String(id));
  if (holder == null) return null;
  return self != null && holder === self ? "in your hands" : `in ${holder}'s hands`;
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

/**
 * WHAT THE PAGE HAS LEARNED A KIND IS, from the office's reads. Only a YES is
 * kept from a close look: its class pointer is two ancestors deep, and an
 * old-form record (kind: sited, class: <kind>) can come back pointed at
 * "sited", so a pointer that names no thing never stands in for the class
 * chain's own answer (explain: "<kind>"), which is asked once per kind and
 * decides. A look with a `holder` is a thing's: holder is a property of thing
 * (and of resident, who is no mark), LOGOS § The transfer edge.
 */
export function thingKindLedger() {
  const known = new Map();   // kind -> true | false (false only from the chain itself)
  const asked = new Set();
  return {
    /** the kinds known to be things */
    things: () => [...known].filter(([, v]) => v === true).map(([k]) => k),
    get size() { return known.size; },
    /** a close look's word: a holder, or a pointer naming thing; anything else is not an answer */
    fromLook(kind, focus) {
      if (!kind || known.get(kind) === true || !focus) return;
      if (focus.holder || isThingKind(kind, { pointer: focus.class_pointer ?? null })) known.set(kind, true);
    },
    /** whether the class chain should be asked for this kind, now */
    shouldAsk(kind) { return !!kind && kind !== "thing" && known.get(kind) !== true && !asked.has(kind); },
    asking(kind) { asked.add(kind); },
    /** the chain's answer: the whole extends list, as explain gives it */
    fromChain(kind, chain) { if (kind && known.get(kind) !== true) known.set(kind, isThingKind(kind, { chain })); },
  };
}
