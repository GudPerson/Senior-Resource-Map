# AI Cost-Control Stack

Date: 2026-07-13

This note records the CareAround SG AI cost-control direction after Vertex AI billing proved too expensive for casual testing and admin import work.

## Recommended Stack

Use this stack as the default CareAround SG AI posture:

1. **Rule/template-first product intelligence** for public Discovery, relevance, recommendations, and explanations.
2. **Structured data APIs first** for places and enrichment: Google Places, OneMap, official directories, website metadata, and existing CareAround metadata.
3. **Google Cloud Translation NMT** for predictable resource translation, using dedicated `GOOGLE_TRANSLATE_*` credentials instead of Vertex-named credentials.
4. **Direct Gemini API with `gemini-2.5-flash-lite`** for bounded staff collateral extraction only, with staff review before anything is published.
5. **Grounded AI web/place search off by default**, enabled only for explicit paid batches with daily quota and cache protection.
6. **Cloudflare Worker KV-backed cache and counters** through the existing `MAP_CACHE` binding, with local memory fallback for tests and development.
7. **Provider-side billing budgets and alerts** as the final safety rail, because application limits reduce usage but cannot cap cloud billing globally.

## Architecture Decision

CareAround SG should not use a generative model as the default intelligence layer.

Default model:

- public discovery, relevance, and recommendation cues stay rule-based and template-explained
- Google Places, OneMap, official directories, and website metadata run before any grounded AI call
- AI import remains a staff-reviewed draft tool, never an autonomous publishing or social-prescribing layer
- Google Cloud Translation stays the predictable resource-translation provider, with dedicated `GOOGLE_TRANSLATE_*` secrets preferred before any legacy Vertex-named fallback
- grounded AI web search is disabled unless explicitly enabled by environment flag and quota

## Runtime Controls

Server-side controls now protect paid AI paths:

| Control | Default | Purpose |
| --- | --- | --- |
| `GROUNDED_AI_ENABLED` | off | Blocks Vertex grounded search/enrichment unless explicitly enabled. |
| `GROUNDED_AI_DAILY_LIMIT` | `10` | Caps grounded AI calls per Worker instance/day when enabled. |
| `GOOGLE_TRANSLATE_PROJECT_ID` / `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON` | preferred when configured | Keeps translation credentials independent from Vertex grounding credentials. |
| `AI_IMPORT_PROVIDER` | auto, Gemini first | Uses direct Gemini API before Vertex when both are configured. Set `vertex` only for an explicit Vertex run. |
| `GEMINI_API_MODEL` | `gemini-2.5-flash-lite` | Keeps collateral extraction on a lower-cost Gemini model by default. |
| `AI_IMPORT_DAILY_LIMIT` | `20` | Caps AI collateral extraction calls per Worker instance/day. |
| `AI_CACHE_TTL_HOURS` | `24` | Caches repeated AI results in Worker KV when available, with local memory fallback. |
| `AI_CACHE_DISABLED` | off | Allows cache bypass only when debugging accuracy. |

These limits are application guardrails, not a replacement for cloud billing budgets. The app uses the existing Worker KV binding for cache and daily counters when available, with local memory fallback for development and tests. Provider-side budget alerts remain required because cloud billing is the final safety rail.

## Pricing Rationale

Pricing checked on 2026-07-13:

- Google lists `gemini-2.5-flash-lite` as its smallest cost-effective Gemini 2.5 model for scale use, with standard text/image/video input at USD 0.10 per 1M tokens and output at USD 0.40 per 1M tokens; batch/flex are lower but less suitable for interactive admin import. Source: `https://ai.google.dev/gemini-api/docs/pricing`
- Grounding is the risky cost surface: Gemini API pricing lists grounded Google Search/Maps charges after included daily/request allowances, so CareAround SG should not use grounded AI for routine public browsing or repeated enrichment. Source: `https://ai.google.dev/gemini-api/docs/pricing`
- Cloud Translation charges by processed content and default NMT is simpler and more predictable than asking a generative model to translate operational content. Source: `https://cloud.google.com/translate/pricing`
- Cloudflare Workers KV is low-cost enough for cache/counter guardrails; the paid plan includes monthly reads/writes before overage and then metered per million operations. Source: `https://developers.cloudflare.com/kv/platform/pricing/`

## Human Intervention Required Before Release

The repo cannot safely create or inspect cloud billing controls or secrets without the account owner. Before deploying this cost-control stack, complete these steps:

1. Open Google Cloud Billing for the project that owns the current Vertex AI and Translation credentials.
2. Create a budget alert with a low monthly threshold for testing, then add email alerts at 50%, 75%, 90%, and 100%.
3. In Google Cloud IAM/API settings, confirm which service account is used only for Vertex grounding and which is used for Translation.
4. If Translation currently relies on `VERTEX_AI_SERVICE_ACCOUNT_JSON`, create separate `GOOGLE_TRANSLATE_PROJECT_ID` and `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON` secrets before removing Vertex credentials.
5. In Cloudflare Worker secrets, add `GEMINI_API_KEY` for collateral import if direct Gemini should replace Vertex.
6. Set `AI_IMPORT_PROVIDER=gemini` only after `GEMINI_API_KEY` exists in the Worker environment.
7. Leave `GROUNDED_AI_ENABLED` unset or `false` by default.
8. If a one-off grounded enrichment batch is approved, set `GROUNDED_AI_ENABLED=true` and a small `GROUNDED_AI_DAILY_LIMIT`, run the batch, then turn `GROUNDED_AI_ENABLED` back off.
9. Keep Vertex credentials available only if there is an approved fallback need; otherwise remove or disable them after translation and Gemini direct import are confirmed.

## Current Cloudflare Secret Check

On 2026-07-13, `wrangler secret list` confirmed the Worker has these cost-control-relevant secret names present, without exposing values:

- `GEMINI_API_KEY`
- `GOOGLE_TRANSLATE_PROJECT_ID`
- `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON`
- `VERTEX_AI_LOCATION`
- `VERTEX_AI_MODEL`
- `VERTEX_AI_PROJECT_ID`
- `VERTEX_AI_SERVICE_ACCOUNT_JSON`

The Worker source also has the existing `MAP_CACHE` KV binding required for durable AI cache and daily counter keys. The Google Cloud billing budget/alert setup still must be confirmed in the billing console by an account owner.

Local budget listing was attempted on 2026-07-13, but the Billing Budgets API/quota-project path was not available from the local CLI context. The account owner confirmed the Google Cloud billing budget on 2026-07-13.

## Cloudflare Runtime Defaults

Do not set `AI_IMPORT_PROVIDER=vertex` unless intentionally running a Vertex test. With both Gemini and Vertex credentials present, the server now chooses direct Gemini first for collateral import and keeps Vertex as a compatibility fallback.

Keep `GROUNDED_AI_ENABLED` unset or `false` in production by default. If a paid grounded batch is approved, use temporary Worker variables instead of permanent source-code defaults, then remove or reset them after the batch.

## Release Checks

Before release:

- run focused AI/import tests
- run `npm run test:server`
- run `npm run build:client`
- verify manual place enrichment still gives useful feedback when grounded AI is disabled
- verify collateral import uses Gemini when `AI_IMPORT_PROVIDER=gemini`
- do not print, copy, or commit secret values during any check
