// creature-kind.test.mjs — the kind file's reader and what it allows (WLD-56).
//
// The kind below is a TEST FIXTURE, not a creature: its words are placeholders.
// The three Mists kinds' words wait for Darko's D4 and land in WORLD/kinds/ then.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RING_VERBS, parseKind, parseCondition, evaluate, startState, scopeOf, allowedReactions, applyEffects, voiceLine,
} from "./creature-kind.mjs";

const FIXTURE = `# a test fixture, not a creature
kind: test-beast
name: a test beast
voice: a shape in the fog
about: it answers what is done near it
what: >
  A fixture for the reader's tests.
  Two lines of it.
ring_m: 50
span_h: 12
moods:
  fear: 0..3 = 1 | calm | uneasy | frightened | terrified
  curiosity: 0..3 = 2
flags: startled

reaction watch "it watches": when true says It watches {actor}.
reaction start "it starts at a voice": when act.verb == "say" and act.distance_m < 20 does set startled ; self.fear +1 says It starts at {actor}'s voice.
reaction nearer "it edges nearer": when self.curiosity >= 2 and not act.approaching does self.curiosity +5 says It edges nearer to {actor}.
reaction flee "it is gone": when self.fear >= 3 or (self.startled and act.verb == "leave-mark") does flee ; clear startled says It is gone into the Mists.
`;

test("a kind file reads whole: its fields, moods with their levels, flags and reactions", () => {
  const k = parseKind(FIXTURE);
  assert.equal(k.kind, "test-beast");
  assert.equal(k.ring_m, 50);
  assert.equal(k.span_h, 12);
  assert.equal(k.what, "A fixture for the reader's tests. Two lines of it.");
  assert.deepEqual(k.moods.fear, { lo: 0, hi: 3, start: 1, levels: ["calm", "uneasy", "frightened", "terrified"] });
  assert.deepEqual(k.moods.curiosity, { lo: 0, hi: 3, start: 2 });
  assert.deepEqual(k.flags, ["startled"]);
  assert.deepEqual(k.reactions.map((r) => r.name), ["watch", "start", "nearer", "flee"]);
  assert.deepEqual(k.reactions[1].effects, [{ do: "set", flag: "startled" }, { do: "add", mood: "fear", by: 1 }]);
  assert.deepEqual(k.reactions[0].effects, [{ do: "nothing" }], "no does: means nothing changes");
});

test("the menu: only the reactions whose `when` holds, in the file's order", () => {
  const k = parseKind(FIXTURE), s = startState(k);
  assert.deepEqual(s, { moods: { fear: 1, curiosity: 2 }, flags: [] });
  const near = (verb, d, approaching = false) => allowedReactions(k, scopeOf(s, { verb, distance_m: d, approaching })).map((r) => r.name);
  assert.deepEqual(near("walk", 40), ["watch", "nearer"]);
  assert.deepEqual(near("walk", 40, true), ["watch"], "an approach closes the curious edge");
  assert.deepEqual(near("say", 10), ["watch", "start", "nearer"]);
  assert.deepEqual(near("say", 30), ["watch", "nearer"]);
  const frightened = { moods: { fear: 3, curiosity: 0 }, flags: [] };
  assert.deepEqual(allowedReactions(k, scopeOf(frightened, { verb: "walk", distance_m: 5 })).map((r) => r.name), ["watch", "flee"]);
  const startled = { moods: { fear: 1, curiosity: 0 }, flags: ["startled"] };
  assert.deepEqual(allowedReactions(k, scopeOf(startled, { verb: "leave-mark", distance_m: 5 })).map((r) => r.name), ["watch", "flee"], "a flag reads true when set");
});

test("effects change only the creature, clamped, and `flee` sends it back into the Mists", () => {
  const k = parseKind(FIXTURE), s = startState(k);
  const nearer = applyEffects(k, s, k.reactions[2].effects);
  assert.equal(nearer.state.moods.curiosity, 3, "clamped to the mood's top");
  assert.equal(nearer.fled, false);
  assert.deepEqual(s.moods.curiosity, 2, "the original state is untouched");
  const started = applyEffects(k, s, k.reactions[1].effects);
  assert.deepEqual(started.state, { moods: { fear: 2, curiosity: 2 }, flags: ["startled"] });
  const fled = applyEffects(k, started.state, k.reactions[3].effects);
  assert.equal(fled.fled, true);
  assert.deepEqual(fled.state.flags, []);
  assert.equal(voiceLine(k.reactions[1], { actor: "kogane" }), "It starts at kogane's voice.");
});

test("the Mists' law is held at parse: no harm, no holds, no spring, no verbs of its own", () => {
  const withLine = (line) => FIXTURE.replace(/reaction watch .*\n/, `${line}\n`);
  const refused = [
    [`reaction bite "it bites": when true does actor.nerve -2 says It bites {actor}.`, /no nerve, no harm/],
    [`reaction grab "it grabs": when true does take says It grabs it.`, /takes nothing/],
    [`reaction crouch "it crouches": when true does telegraph spring says It crouches.`, /telegraphs no spring/],
    [`reaction struck "it is struck": when act.verb == "strike" says Ow.`, /act\.verb is never "strike".*no creature verbs/],
    [`reaction offered "it is fed": when "offer" == act.verb says Yum.`, /act\.verb is never "offer"/],
    [`reaction peek "it peeks": when actor.nerve > 2 says It peeks.`, /reads "actor\.nerve", which a creature cannot know/],
    [`reaction calm "it calms": when self.temper < 1 says It calms.`, /reads "self\.temper"/],
    [`reaction tame "it is tamed": when true does set tamed says It is yours.`, /a flag the kind does not declare/],
    [`reaction sneer "it sneers": when true says It sneers at {item}.`, /\{actor\} and nothing else/],
    [`reaction lunge "it lunges": when true does self.vigor -1 says It lunges.`, /a mood the kind does not have/],
    [`law fallen "no more blows": act.verb != "strike"`, /no laws/],
    [`rule froth "it froths": self.fear > 2 then set startled`, /no rules/],
  ];
  for (const [line, why] of refused) assert.throws(() => parseKind(withLine(line)), why, line);
});

test("a kind with a missing or malformed field is refused, naming it", () => {
  assert.throws(() => parseKind(FIXTURE.replace("kind: test-beast\n", "")), /kind: must be a lowercase slug/);
  assert.throws(() => parseKind(FIXTURE.replace("ring_m: 50", "ring_m: wide")), /ring_m: must be a number above 0/);
  assert.throws(() => parseKind(FIXTURE.replace("  curiosity: 0..3 = 2\n", "  curiosity: 0..3 = 5\n")), /start inside them/);
  assert.throws(() => parseKind(FIXTURE.replace("| calm | uneasy | frightened | terrified", "| calm | uneasy")), /one label per level/);
  assert.throws(() => parseKind(FIXTURE.replace("flags: startled\n", "flags: startled\nwings: two\n")), /line 15: cannot read "wings: two"/);
  assert.throws(() => parseKind(FIXTURE.replace(/reaction [\s\S]*$/, "")), /at least one reaction/);
});

test("the condition language: precedence, parentheses, literals, and nothing evaluated as code", () => {
  const scope = { self: { fear: 2 }, act: { verb: "say", distance_m: 12, approaching: true } };
  const ev = (src) => evaluate(parseCondition(src), scope);
  assert.equal(ev(`self.fear >= 2 and act.verb == "say"`), true);
  assert.equal(ev(`not act.approaching or self.fear == 0`), false);
  assert.equal(ev(`act.distance_m < 10 or (act.verb == "say" and act.approaching)`), true);
  assert.equal(ev(`true`), true);
  assert.throws(() => parseCondition(`process.exit(1)`), /leftover|unexpected/);
  assert.throws(() => parseCondition(`self.fear >=`), /expected a term/);
  assert.throws(() => parseCondition(``), /empty condition/);
});

test("the ring's verbs are the resident's ordinary public acts (the G5 list)", () => {
  assert.deepEqual([...RING_VERBS], ["walk", "enter", "exit", "say", "take", "give", "drop", "leave-mark"]);
  assert.ok(Object.isFrozen(RING_VERBS));
});
