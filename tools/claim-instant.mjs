// claim-instant.mjs — when a mark was FIRST laid, the one reading.
//
// Pure, zero imports, like geometry.mjs, so both marks-fold.mjs (the claim order,
// the cap's law date) and consent.mjs (a parcel's reach, seniority at contact)
// read the same instant without importing each other. marks-fold.mjs re-exports
// both names, so `engine.CLAIMED_AT_FIELD` and its readers are unchanged.
//
// ── THE FIRST CLAIM, NOT THE LATEST DATE (POS-364 review, 2026-10-08) ─────────
//
// Every leave and every amendment restamps a record's `date` (the office's door,
// and the store's materialize replaces the record's data on amend). Ordered by
// `date`, moving a held parcel would send it to the back of its household's
// claims: the parcel it was would lose its slot to one claimed after it, and a
// pre-law parcel moved today would count as post-law. A claim's place is when it
// was FIRST claimed. A record may carry that instant as `claimed_at` (the
// office's settlement fold reads it from the mark's origin claim; a tree record
// carries none, and its `date` is the only instant there is), and the claim
// order and the cap's law date both read it first.
//
// AN AMEND DOES NOT MAKE AN ELDER MARK YOUNG (Darko, 2026-10-07, POS-449). The
// same instant is a mark's AGE wherever the law asks who came first: a parcel's
// reach and the senior at contact (consent.mjs) read it, never the amended `date`.
export const CLAIMED_AT_FIELD = "claimed_at";
/** A record's claim instant: when it was first claimed if the record says, else its date. */
export const claimInstant = (mk) => mk?.[CLAIMED_AT_FIELD] ?? mk?.date;
