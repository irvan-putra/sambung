// Unit tests for the sambung SDK. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBrief, parseReply, validate, extractBalanced, TEMPLATES } from "../sdk/sambung.js";

const itemsSchema = TEMPLATES.items.schema;
const editPlanSchema = TEMPLATES.editPlan.schema;

// --- buildBrief ---

test("brief carries the request, schema and reply rules", () => {
  const brief = buildBrief({ task: "Suggest three names", replySchema: itemsSchema, appName: "demo" });
  assert.match(brief, /# Request\nSuggest three names/);
  assert.match(brief, /# How to reply\nReply with JSON only/);
  assert.match(brief, /"items"/);
  assert.match(brief, /add no other fields/);
  assert.match(brief, /\(requesting app: demo\)/);
  assert.match(brief, /carrying this message by hand/);
});

test("brief includes context only when given", () => {
  const withCtx = buildBrief({ task: "t", context: "current list: a, b" });
  assert.match(withCtx, /# Context\ncurrent list: a, b/);
  const without = buildBrief({ task: "t" });
  assert.doesNotMatch(without, /# Context/);
});

test("schema-less brief asks for plain text", () => {
  const brief = buildBrief({ task: "Say hi" });
  assert.match(brief, /Reply with plain text only\./);
  assert.doesNotMatch(brief, /```json/);
});

test("brief requires task text", () => {
  assert.throws(() => buildBrief({}), /task text is required/);
  assert.throws(() => buildBrief({ task: "   " }), /task text is required/);
});

// --- parseReply: happy paths ---

test("accepts a clean JSON reply", () => {
  const r = parseReply('{"items": ["a", "b"]}', itemsSchema);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { items: ["a", "b"] });
  assert.equal(r.source, "whole");
});

test("accepts JSON inside a fenced code block", () => {
  const reply = 'Sure, here you go:\n```json\n{"items": ["x"]}\n```\nHope that helps!';
  const r = parseReply(reply, itemsSchema);
  assert.equal(r.ok, true);
  assert.equal(r.source, "fenced");
  assert.deepEqual(r.data, { items: ["x"] });
});

test("accepts JSON embedded in prose", () => {
  const reply = 'The answer is {"items": ["one", "two"]} as requested.';
  const r = parseReply(reply, itemsSchema);
  assert.equal(r.ok, true);
  assert.equal(r.source, "extracted");
  assert.deepEqual(r.data, { items: ["one", "two"] });
});

test("schema-less reply passes through as trimmed text", () => {
  const r = parseReply("  hello there  ", null);
  assert.equal(r.ok, true);
  assert.equal(r.data, "hello there");
  assert.equal(r.source, "text");
});

// --- parseReply: rejections ---

test("rejects an empty reply", () => {
  assert.equal(parseReply("   ", itemsSchema).ok, false);
  assert.match(parseReply("", itemsSchema).errors[0], /empty/);
});

test("rejects a reply with no JSON at all", () => {
  const r = parseReply("I cannot help with that.", itemsSchema);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /no JSON/);
});

test("rejects broken JSON with a parse reason", () => {
  const r = parseReply('{"items": ["a", }', itemsSchema);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /not valid JSON/);
});

test("rejects unknown fields", () => {
  const r = parseReply('{"items": [], "extra": 1}', itemsSchema);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /unknown field "extra"/.test(e)));
});

test("rejects missing required fields", () => {
  const r = parseReply("{}", itemsSchema);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /missing required field "items"/.test(e)));
});

test("rejects wrong value types", () => {
  const r = parseReply('{"items": [1, 2]}', itemsSchema);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /\$\.items\[0\]: must be string/.test(e)));
});

test("edit-plan template validates nested operations", () => {
  const good = '{"edits": [{"op": "transpose", "target": "melody", "value": 2}]}';
  assert.equal(parseReply(good, editPlanSchema).ok, true);
  const missingTarget = '{"edits": [{"op": "transpose"}]}';
  const r = parseReply(missingTarget, editPlanSchema);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /missing required field "target"/.test(e)));
  const badField = '{"edits": [{"op": "x", "target": "y", "bogus": true}]}';
  assert.ok(parseReply(badField, editPlanSchema).errors.some((e) => /unknown field "bogus"/.test(e)));
});

test("edit-plan value may be any type", () => {
  const reply = '{"edits": [{"op": "set", "target": "tempo", "value": {"bpm": 90}}]}';
  assert.equal(parseReply(reply, editPlanSchema).ok, true);
});

// --- validate: details ---

test("enum, min/max and item counts", () => {
  assert.equal(validate("a", { enum: ["a", "b"] }).length, 0);
  assert.ok(validate("z", { enum: ["a", "b"] })[0].match(/must be one of/));
  assert.equal(validate(5, { type: "integer", minimum: 1, maximum: 9 }).length, 0);
  assert.ok(validate(10, { type: "integer", maximum: 9 })[0].match(/must be <= 9/));
  assert.ok(validate([], { type: "array", minItems: 1 })[0].match(/at least 1/));
  assert.ok(validate([1, 2, 3], { type: "array", maxItems: 2 })[0].match(/at most 2/));
});

test("integer accepts integers, number accepts both, string rejects numbers", () => {
  assert.equal(validate(3, { type: "integer" }).length, 0);
  assert.ok(validate(3.5, { type: "integer" })[0].match(/must be integer/));
  assert.equal(validate(3.5, { type: "number" }).length, 0);
  assert.equal(validate(3, { type: "number" }).length, 0);
  assert.ok(validate(3, { type: "string" })[0].match(/must be string/));
});

test("type may be a list of allowed types", () => {
  assert.equal(validate(null, { type: ["string", "null"] }).length, 0);
  assert.ok(validate(5, { type: ["string", "null"] })[0].match(/must be string or null/));
});

test("string length bounds", () => {
  assert.ok(validate("", { type: "string", minLength: 2 })[0].match(/at least 2 characters/));
  assert.ok(validate("abcdef", { type: "string", maxLength: 3 })[0].match(/at most 3 characters/));
});

test("schema without type accepts anything", () => {
  assert.equal(validate({ a: 1 }, {}).length, 0);
  assert.equal(validate("x", {}).length, 0);
});

// --- extractBalanced ---

test("extractBalanced respects strings and escapes", () => {
  const s = 'pre {"a": "has } and \\" inside"} post';
  assert.equal(extractBalanced(s), '{"a": "has } and \\" inside"}');
  assert.equal(extractBalanced("no json here"), null);
  assert.equal(extractBalanced("[1, 2, [3]] tail"), "[1, 2, [3]]");
});

// --- Bug A: Prose bracket before real JSON ---

test("Bug A: extractBalanced skips leading non-JSON brackets in parseReply", () => {
  // The leading "[1]" is a balanced block, but not valid JSON for the schema.
  // The real JSON follows.
  const reply = 'Sure! [1] {"items": ["a", "b"]}';
  const r = parseReply(reply, itemsSchema);
  assert.equal(r.ok, true, "Should find the valid JSON after the prose bracket");
  assert.equal(r.source, "extracted");
  assert.deepEqual(r.data, { items: ["a", "b"] });
});

test("Bug A: multiple balanced blocks, first invalid, second valid", () => {
  // First block is valid JSON but fails schema (wrong type). Second block passes.
  const reply = '{"wrong": true} {"items": ["ok"]}';
  const r = parseReply(reply, itemsSchema);
  assert.equal(r.ok, true, "Should find the valid JSON in the second block");
  assert.equal(r.source, "extracted");
  assert.deepEqual(r.data, { items: ["ok"] });
});

// --- Bug B: Error reporting distinguishes candidates ---

test("Bug B: error message distinguishes 'no JSON' from 'shape mismatch'", () => {
  // No JSON at all
  const noJson = parseReply("Just text.", itemsSchema);
  assert.equal(noJson.ok, false);
  assert.match(noJson.errors[0], /no JSON/);

  // JSON found, but shape mismatch (valid JSON, wrong schema)
  const badShape = parseReply('{"wrong": 1}', itemsSchema);
  assert.equal(badShape.ok, false);
  // Should NOT say "no JSON". Should mention missing required field.
  assert.doesNotMatch(badShape.errors[0], /no JSON/);
  assert.ok(badShape.errors.some((e) => /missing required field/.test(e)));
});

test("Bug B: parse error reported when JSON is broken", () => {
  const broken = parseReply('{"items": [1,}', itemsSchema);
  assert.equal(broken.ok, false);
  assert.match(broken.errors[0], /not valid JSON/);
});
