// sambung - manual AI handoff.
//
// sambung never talks to any AI service. It packages a request into a brief
// that a person carries to an assistant of their choice (paste, share sheet,
// any surface), then strictly validates the assistant's reply before the
// calling app or person uses it. No accounts, no keys, no network.
//
// Zero dependencies. Works in browsers (module script) and Node 18+.

// ---------------------------------------------------------------------------
// JSON Schema subset validation
// Supported: type, properties, required, additionalProperties (false only),
// items, minItems, maxItems, enum, minimum, maximum, minLength, maxLength.
// A schema without "type" accepts anything.
// ---------------------------------------------------------------------------

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value; // object | string | number | boolean | undefined
}

function typeMatches(value, expected) {
  const actual = typeOf(value);
  if (expected === "number") return actual === "number" || actual === "integer";
  if (expected === "integer") return actual === "integer";
  return actual === expected;
}

function validate(data, schema, path) {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;
  const here = path || "$";

  if (schema.enum) {
    const ok = schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(data));
    if (!ok) {
      errors.push(here + ": must be one of " + schema.enum.map((v) => JSON.stringify(v)).join(", "));
      return errors;
    }
  }

  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((t) => typeMatches(data, t))) {
      errors.push(here + ": must be " + expected.join(" or ") + ", got " + typeOf(data));
      return errors; // deeper checks are noise once the type is wrong
    }
  }

  if (typeOf(data) === "object") {
    const props = schema.properties || {};
    const required = schema.required || [];
    for (const key of required) {
      if (!(key in data)) errors.push(here + ": missing required field " + JSON.stringify(key));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in props)) errors.push(here + ": unknown field " + JSON.stringify(key));
      }
    }
    for (const key of Object.keys(props)) {
      if (key in data) errors.push(...validate(data[key], props[key], here + "." + key));
    }
  }

  if (typeOf(data) === "array") {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(here + ": needs at least " + schema.minItems + " item(s), got " + data.length);
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push(here + ": allows at most " + schema.maxItems + " item(s), got " + data.length);
    }
    if (schema.items) {
      data.forEach((item, i) => errors.push(...validate(item, schema.items, here + "[" + i + "]")));
    }
  }

  if (typeOf(data) === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(here + ": must be at least " + schema.minLength + " characters");
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(here + ": must be at most " + schema.maxLength + " characters");
    }
  }

  if (typeOf(data) === "number" || typeOf(data) === "integer") {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(here + ": must be >= " + schema.minimum + ", got " + data);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(here + ": must be <= " + schema.maximum + ", got " + data);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Brief building
// ---------------------------------------------------------------------------

const BRIEF_HEADER =
  "An app needs your help. The app cannot contact you itself; " +
  "a person is carrying this message by hand.";

function buildBrief({ task, context, replySchema, appName, extraRules } = {}) {
  if (!task || typeof task !== "string" || !task.trim()) {
    throw new Error("buildBrief: task text is required");
  }
  const parts = [BRIEF_HEADER, "", "# Request", task.trim()];
  if (context && String(context).trim()) {
    parts.push("", "# Context", String(context).trim());
  }
  parts.push("", "# How to reply");
  if (replySchema) {
    parts.push(
      "Reply with JSON only. Do not write anything before or after the JSON.",
      "The JSON must match this shape exactly:",
      "```json",
      JSON.stringify(replySchema, null, 2),
      "```",
      "Rules: include every required field, add no other fields, use the exact value types shown."
    );
  } else {
    parts.push("Reply with plain text only.");
  }
  if (extraRules && String(extraRules).trim()) {
    parts.push("", "# Extra rules", String(extraRules).trim());
  }
  if (appName && String(appName).trim()) {
    parts.push("", "(requesting app: " + String(appName).trim() + ")");
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Reply parsing
// ---------------------------------------------------------------------------

// Find the first balanced {...} or [...] block, respecting strings and escapes.
function extractBalanced(text) {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseJson(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// parseReply(text, schema|null)
// With a schema: the reply must contain JSON matching it.
// Without a schema: the reply is taken as plain text, returned trimmed.
// Result: { ok: true, data, source } | { ok: false, errors: [..] }
// source: "whole" | "fenced" | "extracted" | "text" - how the payload was found.
function parseReply(text, schema) {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, errors: ["reply is empty"] };
  }
  if (!schema) {
    return { ok: true, data: text.trim(), source: "text" };
  }

  const trimmed = text.trim();
  const attempts = [{ label: "whole", candidate: trimmed }];

  const fence = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fence) attempts.push({ label: "fenced", candidate: fence[1].trim() });

  const balanced = extractBalanced(trimmed);
  if (balanced && !attempts.some((a) => a.candidate === balanced)) {
    attempts.push({ label: "extracted", candidate: balanced });
  }

  let parseError = "reply contains no JSON";
  let validationErrors = null;
  for (const attempt of attempts) {
    const parsed = tryParseJson(attempt.candidate);
    if (!parsed.ok) {
      parseError = "reply is not valid JSON (" + parsed.error + ")";
      continue;
    }
    const errors = validate(parsed.data, schema);
    if (errors.length === 0) {
      return { ok: true, data: parsed.data, source: attempt.label };
    }
    if (validationErrors === null) validationErrors = errors;
  }
  if (validationErrors !== null) return { ok: false, errors: validationErrors };
  // Clearer message when the reply has no JSON-looking content at all.
  if (!/[{[]/.test(trimmed)) return { ok: false, errors: ["reply contains no JSON"] };
  return { ok: false, errors: [parseError] };
}

// ---------------------------------------------------------------------------
// Reply-shape templates (presets; a caller may always supply its own schema)
// ---------------------------------------------------------------------------

const TEMPLATES = {
  // Free-text answer, no JSON expected.
  note: { label: "plain note (no JSON)", schema: null },
  // A simple list of strings.
  items: {
    label: "list of items",
    schema: {
      type: "object",
      required: ["items"],
      additionalProperties: false,
      properties: {
        items: { type: "array", items: { type: "string" } },
      },
    },
  },
  // A plan of targeted edits, aimed by name, with an optional value.
  editPlan: {
    label: "edit plan (op / target / value)",
    schema: {
      type: "object",
      required: ["edits"],
      additionalProperties: false,
      properties: {
        edits: {
          type: "array",
          items: {
            type: "object",
            required: ["op", "target"],
            additionalProperties: false,
            properties: {
              op: { type: "string" },
              target: { type: "string" },
              value: {},
            },
          },
        },
      },
    },
  },
};

export { buildBrief, parseReply, validate, extractBalanced, TEMPLATES };
