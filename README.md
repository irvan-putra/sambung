# sambung

*sambung* is Indonesian for "connect".

sambung is a **manual AI handoff** tool: it packs a request from an app into a
plain-text brief that *you* carry to any assistant you already use (paste it,
or share it through the Android share sheet), then checks the assistant's
reply against the expected shape before you use it.

## What it does

- **Build a brief**: the request, optional context, and the exact reply shape
  (a JSON schema), written so any general assistant can follow it.
- **Carry it yourself**: copy to the clipboard or share to any app. The
  Android app is a share target, so an assistant's app can share its answer
  straight back into sambung's reply box.
- **Check the reply**: strict validation against the expected shape. JSON
  found inside prose or a fenced code block is accepted; missing fields,
  unknown fields and wrong types are reported one by one. Checking never
  changes anything - you review the parsed result, then copy or share it back
  to the app that asked.
- **History**: recent exchanges stay in local storage on the device only.

## What it never does

- No accounts, no API keys, no sign-ins, no billing.
- No network calls at all. The Android app has no INTERNET permission.
- No automatic contact with any AI service. You always carry the text; the
  assistant sees only what you paste.
- No applying checked results on its own. Preview first; using the result is
  your act (or the calling app's, after you hand it over).

Connecting directly to specific assistant products or subscriptions is
separate future work and is not claimed here.

## Repository layout

- `sdk/` - the checking and brief-building library (`sdk/sambung.js`), plain
  ES module, zero dependencies. This is the single source of truth; other
  apps embed this file.
- `web/` - the sambung UI (same library, runs fully offline).
- `android/` - the Android app: an offline WebView shell over `web/` plus
  `sdk/`, with a native clipboard/share bridge and a share-target entry point.
- `tests/` - Node unit tests for the SDK (`node --test tests/test_sambung.mjs`).
- `tools/` - the family launcher-icon tool (badged with the version).

## Using the SDK in another app

```js
import { buildBrief, parseReply } from "./sambung.js";

const brief = buildBrief({
  task: "Suggest three chord names for a rainy mood",
  replySchema: {
    type: "object",
    required: ["items"],
    additionalProperties: false,
    properties: { items: { type: "array", items: { type: "string" } } },
  },
  appName: "myapp",
});
// -> hand `brief` to the person (clipboard, share sheet, ...)

const checked = parseReply(assistantReply, schema);
if (checked.ok) {
  // checked.data is validated against the schema
} else {
  // checked.errors lists every problem, nothing was applied
}
```

## Development

- SDK tests: `node --test tests/test_sambung.mjs` (Node 18+; CI uses Node 20).
- Android build: `gradle -p android :app:assembleDebug` (JDK 17, Gradle 8.7).
  The build syncs `web/` and `sdk/` into the app assets - edit them there,
  never the copies under `android/app/src/main/assets/`.
- Launcher icon after a version change:
  `pip install pillow==12.3.0 && python3 tools/badge_icon.py <version>`,
  then commit the regenerated `android/app/src/main/res/` PNGs. CI fails if
  the committed icon is stale.

## Releases

Tags `v*` (or manual dispatch) run: patuh source gate, signed release build,
patuh candidate byte-check of the actual APK, publish `sambung-<tag>.apk`
plus its `.sha256` sidecar to GitHub Releases, then a post-publish live
verification. The byte check is the preventive boundary: a defect stops the
release before publishing.

## License

AGPL-3.0. See `LICENSE`.
