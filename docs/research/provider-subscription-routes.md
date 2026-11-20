# Research: what consumer AI subscriptions allow outside their own apps

Date of research: 2026-11-20. Method: public web sources only; no accounts
were accessed and no plan-holder information is used. Claims about fast-moving
vendor terms can go stale; re-fetch before relying on them later.

Provenance labels:

- **FETCHED**: the full primary page or document was retrieved and read on
  2026-11-20.
- **SNIPPET**: seen only through search-result excerpts; never opened in full.
  No conclusion here rests on a snippet alone.
- **UNVERIFIED**: not determinable from public sources at all.

## Question

Can a consumer AI chat subscription (Gemini, Claude, Grok) legitimately power
model calls inside your own app or tool?

## Findings per provider

### Google / Gemini

- **FETCHED, VERIFIED** (developers.google.com notice, updated 2026-10-09):
  starting 2026-06-18, "Login with Google" for Gemini CLI and IDE extensions
  stopped serving consumer accounts (Gemini Code Assist for individuals,
  Google AI Pro, Google AI Ultra). The migration target is the Antigravity
  family.
- **FETCHED, VERIFIED as documented** (antigravity.google/docs/plans and
  /docs/cli/credits): Antigravity gives personal Google accounts a free
  baseline quota that refreshes weekly; Google AI Pro and Ultra get higher
  quotas; the CLI is an included product feature. Overage billing is opt-in
  through an AI-credit setting with an explicit "Never" option, so it can be
  configured to never bill.
- **CONTRADICTED**: geminicli.com's quota page still describes a free
  personal-account Gemini CLI tier (1,000 requests/day). That domain is not
  operated by Google and conflicts with Google's own notice, so it is treated
  as stale and non-authoritative.
- **SNIPPET** (one.google.com plans page): Google AI plans appear not to
  include Gemini API access; the API has its own keys and billing. Needs a
  direct fetch before any claim rests on it.
- **UNVERIFIED**: how specific Google One/AI plan tiers map to Antigravity
  quotas, and whether wrapping first-party CLIs in your own tooling is
  permitted by the applicable terms (no per-provider terms review done).

### Anthropic / Claude

- **FETCHED, VERIFIED** (Anthropic Consumer Terms PDF, effective 2025-10-08,
  assets.claude.com): accessing the consumer Services "through automated or
  non-human means" is prohibited except via an Anthropic API key or where
  explicitly permitted.
- **SNIPPET** (code.claude.com authentication docs): Claude Code accepts
  claude.ai Pro/Max logins, making Anthropic's own Claude Code harness the
  subscription's sanctioned automation surface. Needs a direct fetch before
  further reliance.
- Consequence: using a consumer Claude subscription token inside third-party
  tools is prohibited by the Consumer Terms.
- **UNVERIFIED**: whether wrapping Claude Code itself inside your own tooling
  is permitted.

### Grok (xAI, now SpaceX Super Intelligence)

- Context: xAI became a SpaceX subsidiary in February 2026 ("SpaceXAI") and
  was renamed SpaceX Super Intelligence ("SpaceXSI") in October 2026;
  corroborated by multiple news outlets at **SNIPPET** level. Pages on x.ai
  may show either branding.
- **FETCHED, VERIFIED as documented** (x.ai/pricing,
  docs.x.ai/x-subscription/pricing): the new X Subscription (Plus, from
  $8/month) lists Grok API access inside a shared weekly usage pool.
- **UNVERIFIED**: whether legacy plans (SuperGrok, older X Premium) include
  any API access. Public sources do not say; only the plan holder's own
  account page can answer.
- **OPEN CONTRADICTION**: "the new plan includes API access" and a blanket
  "no chat subscription allows embedding" cannot both be true. Both stay open
  pending per-plan, per-account facts.

### Instinct

- No public Instinct developer API or integration surface is documented
  (searched 2026-11-20). Absence of documentation is not proof of absence;
  the only claim made here is that no public API is documented. Instinct's
  role in this project is a conversational, manual partner only.

## Reconciled conclusion

- No consumer chat subscription was found to explicitly license embedding
  model calls in your own applications. This is deliberately narrower than
  "subscriptions are for chatting only": each vendor does offer a sanctioned
  automation surface, but it is the vendor's own first-party harness
  (Antigravity CLI, Claude Code, Grok API on the new X Subscription).
- Whether wrapping those first-party surfaces in your own tooling is allowed
  is **unsettled for every provider** and needs a per-provider terms review
  before any adapter is built.
- Therefore sambung's shipped scope is manual handoff only: a person carries
  the brief to the assistant and carries the reply back. The app embeds no
  provider integration, makes no entitlement claims, and stores no
  credentials.

## What would change this document

- Plan-holder confirmation of account-level entitlements (not sought here).
- A per-provider terms review of first-party CLI wrapping.
- Any vendor publishing an official consumer-subscription embedding route.

## Sources

Fetched and read in full on 2026-11-20 unless marked SNIPPET:

- https://developers.google.com/gemini-code-assist/resources/privacy-notice-gemini-code-assist-individuals
- https://antigravity.google/docs/plans/
- https://antigravity.google/docs/cli/credits/
- https://assets.claude.com/43c13f51a6d9755341433f79cf63c966ed9200ea.pdf
  (Anthropic Consumer Terms, effective 2025-10-08)
- https://code.claude.com/docs/en/authentication (SNIPPET)
- https://x.ai/pricing
- https://docs.x.ai/x-subscription/pricing
- https://one.google.com/about/google-ai-plans/ (SNIPPET)
- https://en.wikipedia.org/wiki/SpaceXAI (SNIPPET)
- https://geminicli.com/docs/resources/quota-and-pricing/ (fetched;
  non-authoritative, retained only for provenance)
