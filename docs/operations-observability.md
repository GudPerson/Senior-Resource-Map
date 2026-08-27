# CareAround SG Operational Observability

## What the repository now provides

Every API response carries a privacy-safe correlation id in `X-Request-ID` and application processing time in `Server-Timing`. Browser clients are allowed to read those headers through CORS. A support report can therefore include a request id without including a session token, request body or personal information.

API request events are structured as JSON with only:

- event name;
- request id;
- HTTP method;
- route pattern with ids and long tokens redacted;
- status;
- application duration;
- outcome (`error`, `slow` or `sampled`);
- public-cache status when applicable.

The middleware never logs query strings, headers, cookies, IP addresses, request or response bodies, user ids, resource content, share tokens or credentials.

## Runtime controls

- `SLOW_REQUEST_MS` controls the always-logged slow threshold. The safe default is 2,000 ms; accepted values are 100–120,000 ms.
- `REQUEST_LOG_SAMPLE_RATE` controls ordinary successful-request sampling from 0 to 1. The default is 0, so errors and slow requests are recorded without creating high-volume success logs. Set a production sample only after checking the logging provider's privacy, retention and cost controls.
- Errors with a 5xx response and requests above the slow threshold are always logged.

These settings change only logging volume. They do not change request behavior.

## Public cache signals

The public map and discovery cache routes expose:

- `X-CareAround-Cache`: `hit`, `miss`, `legacy` or `refreshed`;
- `X-CareAround-Cache-Age`: age in seconds when the payload has a valid generation time;
- `X-CareAround-Cache-Stale`: `true`, `false` or `unknown`.

`MAP_CACHE_STALE_AFTER_SECONDS` controls the observation threshold only. It defaults to 24 hours and accepts 60 seconds to 30 days. A stale header does not hide data or trigger a rebuild by itself.

Cache rebuild events contain Region id, row count, duration, success/error outcome and whether an aggregate rebuild was requested. They do not contain cache rows, titles, addresses or descriptions.

## Suggested alert rules

Provider configuration remains outside the repository and needs separate approval. When a logging/alerting owner is assigned, start with:

1. Any sustained 5xx increase by route pattern.
2. Authentication or saved-resource routes above the slow threshold.
3. `map_cache_rebuild` errors or a missing successful aggregate rebuild.
4. Public-cache `miss`, `legacy` or `stale=true` events above a small sustained rate.
5. A sharp rise in 429 responses, which may indicate misuse or legitimate demand exceeding the current limits.

Alert on trends rather than a single transient request. Do not add user identifiers or request bodies to make an alert more convenient.

## Incident handoff

Record the request id, approximate time, route or user journey, status, environment, and whether the cache headers indicated a miss/stale payload. Correlate that evidence with Cloudflare logs using the request id. If provider logs are unavailable or retention has expired, state that limitation rather than inferring a cause.

External error aggregation, alert delivery, on-call ownership, Cloudflare log retention and cost budgets are not established by this code change and remain operational decisions.
