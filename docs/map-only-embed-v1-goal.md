# Map-only Embed V1 Goal

Status: implementation contract locked for the active `codex/map-only-embed-v1`
goal. This document does not authorize a production deployment.

## Outcome

An owner can explicitly allow a published Shared Map to appear as a compact,
guest-only interactive map on approved external websites. CareAround generates
the iframe code. Visitors can explore published resource locations without
receiving owner, account, editing, print, or private-map controls. Owners may
explicitly include individual read-only map annotations in the frozen embed
snapshot; annotations remain private by default.

The embed uses the existing frozen Shared Map snapshot. Private edits remain
private until the owner updates the Shared Map. Unpublishing invalidates the
share token and therefore disables every existing embed immediately.

## V1 user experience

### Owner setup

1. Publish the My Map through the existing Share flow.
2. Open `Website embed` in the Share dialog.
3. Add one or more exact approved website origins, such as
   `https://www.example.org.sg`.
4. Enable embedding and preview the map-only experience.
5. Copy the generated responsive iframe snippet.
6. Disable embedding, remove an approved website, or unpublish the Shared Map
   to revoke external use.

Production website origins must use HTTPS. Localhost HTTP origins are accepted
only for local development and UAT. Origins contain a scheme and host, plus a
non-default port when needed; paths, query strings, fragments, credentials,
wildcards, and opaque origins are rejected. `www` and non-`www` sites are
separate origins and must be approved separately.

### External visitor

The iframe contains:

- the published map name;
- CareAround category-bubble pins and existing cluster interaction;
- compact search and category filters;
- reset/zoom controls and a full-map link;
- one selected-place/resource preview at a time;
- the resource logo in that preview, with category-icon and letter fallbacks;
- the production Detailed-map fixed surface when available at the current
  location and zoom, with the regular map as its safe fallback;
- only map annotations explicitly marked for sharing before the latest shared
  snapshot update;
- a notice when additional published resources have no map coordinates;
- CareAround and required basemap attribution; and
- a calm unavailable state when embedding is disabled or the map is
  unpublished.

The iframe does not contain:

- the full resource-card directory;
- sign-in, Save, Copy to My Maps, or account navigation;
- Manage Resources, Remove, Edit, Arrange categories, or owner Share controls;
- Print View, PNG/PDF export, annotation editing, Detailed-map controls, or
  geolocation/distance controls;
- personal places, private notes, private files, private postal context, or
  other owner-only content.

Resource and full-map links open CareAround in a new top-level browser tab.
The iframe never runs an authenticated workflow.

### Interaction and accessibility

- Desktop map dragging, keyboard navigation, cluster activation, and pin
  activation reuse the existing `DirectoryMap` behavior. Wheel zoom remains
  disabled so the host page keeps its normal scroll.
- On coarse-pointer/touch devices, the map starts behind a clear `Interact with
  map` guard. Activating it enables map gestures; an explicit Done action and
  Escape release the map back to the host page.
- Controls and resource previews use real buttons/links, visible focus states,
  accessible names, and 44-pixel minimum touch targets.
- The embed is responsive from a supported minimum height of 400 pixels. The
  generated snippet recommends 520 pixels and lazy loading.
- The selected-resource preview stays compact. A place with multiple published
  resources may show several names, but the complete directory remains on the
  full Shared Map.

## List-only resource contract

Map-only must never silently imply that all published resources are pinned.
The embed calculates the count of published resources without valid map
coordinates and shows an `additional resources in the full map` action when
the count is non-zero. The owner preview shows the mapped and additional counts
before the iframe code is copied.

Search and category filters apply to pins and the selected-resource preview.
They do not convert list-only resources into pins. The full Shared Map remains
the authoritative way to browse every published mapped and list-only resource.

## Privacy and sharing invariants

- Only an already-published Shared Map can enable embedding.
- Enabling also requires a matching frozen Shared Map snapshot. A legacy
  published map without one must use `Update shared link` before it can be
  embedded; the ordinary Shared Map keeps its existing compatibility path.
- Embed settings are live owner controls, not part of the frozen snapshot.
  Domain removal and embed disablement therefore do not require republishing.
- Embed directory reads always use the guest visibility boundary, even if the
  browser also has a CareAround session cookie.
- Existing Shared Map live-visibility filtering continues to remove a frozen
  resource that is no longer publicly eligible.
- Personal places, unshared print annotations, private notes, private files,
  saved home data, viewer postal data, and owner controls remain absent.
- Shared annotations are opt-in per item, sanitized into the frozen snapshot,
  and read-only in the embed. The ordinary Shared Map remains annotation-free.
- Disabling embedding does not unpublish the normal Shared Map link.
- Unpublishing disables embedding, deletes the frozen snapshot through the
  existing path, and rotates the token on a future republish. A republished map
  must be explicitly re-enabled for embedding.

## Data and API contract

Additive owner-map fields:

- `embed_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `embed_allowed_origins JSONB NOT NULL DEFAULT []`

The approval-gated production apply uses the narrow
`bootstrap:map-embed-schema` command, which adds and verifies only these two
columns. The full boundary bootstrap reuses the same helper.

The allowlist is bounded to ten normalized origins. Embed settings are returned
only to the owner through My Map summaries; the embed configuration endpoint
returns only the minimum framing decision needed by the Pages response.

New endpoints:

- `PATCH /api/my-maps/:id/embed` — authenticated owner update for `enabled` and
  `allowedOrigins`; enabling requires a published map and at least one origin.
- `GET /api/shared-maps/:token/embed-config` — minimal public configuration for
  the CareAround Pages Function; returns unavailable when the map is not
  shared, embed-enabled, and backed by its matching frozen snapshot.
- `GET /api/shared-maps/:token/embed` — guest-only frozen directory payload;
  it ignores browser authentication and returns unavailable unless embedding
  is enabled.

Ordinary `GET /api/shared-maps/:token`, its annotation-free response, and
Shared Map copy/save behavior retain their current contracts. Frozen snapshot
generation adds only the sanitized, explicitly shared annotation subset
consumed by the embed endpoint.

## Framing and Pages contract

CareAround's global client headers keep:

- `Content-Security-Policy: ... frame-ancestors 'none'`
- `X-Frame-Options: DENY`

Only `/embed/maps/:token` is served through a narrowly routed Cloudflare Pages
Function. The function:

1. requests the minimal embed configuration from the Worker API;
2. fetches the built SPA `index.html` through the Pages asset binding;
3. clones the response and supplies all required security headers because
   `_headers` rules do not apply to Pages Function responses;
4. removes `X-Frame-Options` for this response only;
5. sets `frame-ancestors 'self'` plus the map's normalized approved origins;
6. disables geolocation, camera, microphone, and payment permissions;
7. sets `Cache-Control: no-store` and `X-Robots-Tag: noindex`; and
8. fails closed to a no-data unavailable response if configuration cannot be
   verified.

Both embed Worker responses are explicitly `no-store`, so live origin removal,
disablement, and unpublishing are not weakened by an intermediate API cache.

The Pages Function invocation route is limited to `/embed/maps/*`. Static
assets and all ordinary application routes remain on the current Pages static
delivery path and retain the existing `_headers` protection.

## Architecture boundaries

New code is isolated to:

- one embed settings helper and its server validation;
- additive My Map columns plus boundary bootstrap;
- focused My Map and Shared Map routes/controllers;
- one Pages Function and one narrow `_routes.json` rule;
- one lazy-loaded `EmbeddedMapPage`, one embed-only Detailed-map loader, and
  small embed presentation helpers;
- the existing Share dialog's new Website embed section; and
- focused client, server, header, privacy, and browser tests.

Do not rewrite `SharedMapPage`, `SharedMapDirectoryList`, or `DirectoryMap`.
Reuse their public directory and map-presentation helpers. Add a narrow map
interaction prop only if the existing component cannot support the touch guard
without changing current callers.

## Failure states

- Invalid or unpublished token: friendly unavailable embed, no directory data.
- Shared but embedding disabled: friendly unavailable embed; normal Shared Map
  link remains available.
- Parent website not approved: browser blocks framing through `frame-ancestors`.
- Configuration API unavailable: Pages response fails closed and exposes no map
  data.
- Directory API temporarily unavailable: in-frame retry state; no automatic
  unbounded retry loop.
- Resource becomes non-public: existing live visibility filtering removes it.
- No mapped resources: show the list-only count and full-map action instead of
  an empty interactive canvas.
- Host frame is shorter than supported: show compact guidance to increase the
  embed height; never hide attribution.

## Verification and release gates

Implementation is not complete until current evidence proves:

1. origin normalization rejects unsafe or ambiguous values;
2. only the owner can change embed settings;
3. embed data is guest-scoped with private/personal data and unshared
   annotations absent, while explicitly shared annotations are sanitized;
4. frozen snapshot, live public-visibility filtering, update, disable,
   unpublish, token rotation, and re-enable behavior all pass;
5. the normal Shared Map route remains guest-readable and unchanged;
6. all non-embed HTML retains global anti-framing headers;
7. the embed HTML has only the map-specific `frame-ancestors` allowlist and no
   `X-Frame-Options: DENY`;
8. an approved external host renders the iframe and an unapproved host is
   blocked;
9. desktop and mobile map/search/filter/preview/list-only flows pass with no
   trapped page scroll or inaccessible controls;
10. the full server suite, full client suite, `verify:map-lockdown`, exact
    six-root production build, `git diff --check`, and secret/privacy review
    pass; and
11. preview, immutable Pages/Worker artifacts, custom-domain artifact parity,
    API health, external-host UAT, and authenticated production smoke pass
    after explicit release approval.

No commit, push, Worker deploy, Pages deploy, schema apply, or production-data
mutation is authorized merely by this goal document. Those actions remain
subject to the CareAround release checklist and explicit user approval.
