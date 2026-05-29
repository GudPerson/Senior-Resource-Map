# Discover Location Indicators Design

## Goal

Add subtle visual indicators to existing Discover result cards when a visible resource matches the active location context.

This is a display-only enhancement. It must not change ranking, sorting, filtering, visibility, access rules, saved-map behavior, or the existing distance pill.

## Source State

- Branch starts from GitHub `origin/main` at `b7af05c4`.
- Discover is a locked surface in `docs/regression-ledger.md`.
- Production behavior remains the source of truth for deployed behavior.
- The archived attempt at `/Users/sweetbuns/CareAroundSG-archive-20260529-005238` is reference only.
- Local full Worker UAT is blocked unless `server/.env` or Worker secrets are available locally.
- Phase 1 defers exact Locate Me Region matching because browser geolocation provides latitude/longitude, not a postal code or Region, and reverse geocoding needs a separately approved geolocation/privacy path.

## User-Facing Behavior

For each already-visible Discover card:

- Within an Audience Zone: show only a subtle star-in-circle icon.
- Within signed-in user home/profile Region: show `Recommended for you`.
- Within searched postal code or Locate Me Region: show `Recommended for this location`.
- Within both Audience Zone and Region: show the icon plus the relevant recommendation pill.
- Within neither: show no new indicator.

If both home Region and active location Region match, prefer `Recommended for this location` while an explicit postal/Locate Me context is active.

## Privacy Rules

Public users must not see the words `Audience Zone`, `subregion`, `boundary`, or `service boundary`.

The UI, public API responses, shared maps, and card props must not expose saved profile postal code, searched postal code, Region IDs, Audience Zone IDs, zone names, internal zone labels, or internal Region labels.

The Worker endpoint may return only booleans keyed by resource references that the client already has in the visible Discover list.

## Architecture

### Server

Add a small `/api/discovery/location-indicators` Worker route using optional auth.

Request body:

```json
{
  "resources": [
    { "type": "hard", "id": 1 },
    { "type": "soft", "id": 2 }
  ],
  "contextPostalCode": "681808"
}
```

Response body:

```json
{
  "indicators": {
    "hard:1": {
      "withinAudienceZone": false,
      "withinHomeRegion": true,
      "withinContextRegion": false
    }
  }
}
```

The route must normalize and dedupe resource refs, cap the request size, and ignore invalid refs. It must load only metadata needed to compute booleans:

- user home/profile Region from authenticated user Region scope, falling back to the user's stored postal code when available
- active searched/Locate Me Region from the provided postal code
- active Audience Zone matches from authenticated user postal code and the active searched postal code
- hard-asset Region matches and place-owned Audience Zones
- soft-asset direct/parent Audience Zones, linked place Regions, host place Regions, and explicit Region coverage rows

The route must fail safely. Client-visible failures should result in no indicators rather than broken Discover cards.

### Client

Add pure helpers under `client/src/features/discover/locationIndicators.js`:

- build compact resource refs from displayed Discover resources
- apply returned booleans without changing array order
- decide badge presentation from booleans

Wire `DiscoverPage.jsx` after `displayedResources` is computed:

- fetch indicators only when there are displayed resource refs and either signed-in user context or active location context
- use the active searched postal code for explicit postal/Locate Me context
- decorate only the displayed resource list passed into `DiscoveryResultsList`
- clear indicators on failure or stale responses

Add a small `DiscoveryLocationIndicatorBadges.jsx` component and render it inside existing desktop and mobile cards without touching the distance pill.

### Copy

Add only public-safe text:

- `Recommended for you`
- `Recommended for this location`
- `Relevant to your area`

Do not add public-facing text that names Audience Zones, Regions, subregions, or boundaries.

## Out Of Scope

- recommendation engine
- AI matching
- ranking changes
- sorting changes
- filtering changes
- visibility/access-rule changes
- distance pill changes
- category color/cache-color work unless separately approved
- deploy without Worker endpoint verification

## Verification

Before claiming complete:

- Client helper tests cover presentation priority and no-order-change behavior.
- Server tests cover normalized resource refs, boolean-only output, searched-postal context, and privacy-safe payloads.
- Run `npm run test:server`.
- Run `npm run build:client`.
- Run `git diff --check`.

Manual/browser UAT:

- Pages-only preview can validate static card rendering but cannot fully validate the feature because the new endpoint requires a Worker deployment.
- Full UAT requires a Worker environment with existing secrets and database access.
- No auth, Gmail, email, GudAuth, or production secret values should be changed for this feature.
