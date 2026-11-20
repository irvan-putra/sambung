# sambung SDK

`sambung.js` - manual AI handoff helpers. Plain ES module, zero dependencies,
no network. Works in browsers (module script) and Node 18+.

This file is the single source of truth. Apps embed this exact file.

## API

### `buildBrief({ task, context, replySchema, appName, extraRules }) -> string`

Builds the plain-text brief a person carries to an assistant. `task` is
required. When `replySchema` is given, the brief instructs the assistant to
reply with JSON only, matching that shape; without it, the brief asks for
plain text.

### `parseReply(text, schema | null) -> result`

Validates a reply. Returns `{ ok: true, data, source }` or
`{ ok: false, errors: [..] }` with one human-readable entry per problem
(`$.edits[0].op: must be string`, `$: unknown field "x"`, ...).

JSON is found in the whole reply, a fenced ```` ```json ```` block, or the
first balanced `{...}` / `[...]` inside prose (`source` says which). With
`schema: null` the reply passes through as trimmed plain text.

### `validate(data, schema) -> [errors]`

The schema-subset checker on its own. Supported keywords: `type` (string or
list), `properties`, `required`, `additionalProperties: false`, `items`,
`minItems`, `maxItems`, `enum`, `minimum`, `maximum`, `minLength`,
`maxLength`. A schema without `type` accepts anything.

### `TEMPLATES`

Ready reply shapes: `note` (plain text), `items` (list of strings),
`editPlan` (`{edits: [{op, target, value?}]}`).

## Rules the SDK keeps

- Validation is strict: unknown fields fail when the schema says
  `additionalProperties: false`.
- Checking is read-only. Nothing applies the result; preview comes first.
- No network, no storage, no accounts. All of that belongs to the host app.
