# Session Handoff

Last updated: 2026-03-19 (Asia/Singapore)

## Repo State
- Repo: `/Users/sweetbuns/Documents/Senior-Resource-Map`
- Branch: `main`
- Worktree status: heavily dirty and not committed
- Important: resume from the current worktree, not from git history alone

## Canonical Runtime / Deploy Targets
- Client preview used most recently: `https://a5d690a4.senior-resource-map.pages.dev`
- Worker API: `https://senior-resource-map-api.joshuachua79.workers.dev/api`
- Production health endpoint used in prior checks: `https://senior-resource-map-api.joshuachua79.workers.dev/api/health`

## High-Level Progress

### Phase 1
- Saved-assets foundation implemented on top of `/favorites`
- `SavedAssetsProvider`, `useSavedAssets`, and `SaveAssetButton` added
- Saved state is synchronized across:
  - Discover cards
  - map tooltip/popup
  - inspector
  - asset detail

### Phase 2
- Standard-user `My Directory` destination added
- Canonical route: `/my-directory`
- Standard-user saved-assets view now lives there

### Phase 3
- First private `My Maps` workflow added for standard users
- Includes:
  - map list
  - create named map from saved assets
  - map detail
  - rename
  - add/remove assets
  - delete

### Phase 4
- Discovery changed from public-results map to saved-only map
- Mobile defaults to `Browse`, not map
- Saved assets drive map pins across breakpoints
- Mobile browse/search UI compacted
- Dedicated mobile browse cards added

## Most Recent UI Work
Recent work has focused on mobile discovery-card polish.

Latest deployed state on `https://a5d690a4.senior-resource-map.pages.dev` includes:
- mobile address/details block capped to 2 lines
- distance pill moved to the bottom-right inside the location container

Immediately before that, additional mobile card changes were made and deployed in prior previews:
- `https://949b2b7e.senior-resource-map.pages.dev`
  - category moved into top utility row
  - category icon removed
  - logo placed inline beside title
- `https://d4001c93.senior-resource-map.pages.dev`
  - distance removed from top row
  - category given more width
  - save kept top-right
- `https://c35f413d.senior-resource-map.pages.dev`
  - offering cards show `Available in X other places`
- `https://36a1a755.senior-resource-map.pages.dev`
  - mobile `A+` font growth capped
  - `A+` disappears at mobile max

## Current Mobile Discovery Card Behavior
Primary file:
- `client/src/features/discover/DiscoveryMobileBrowseCard.jsx`

Current intended mobile behavior:
- top row:
  - category pill on the left
  - save button on the right
- title row:
  - optional logo inline beside title
- location container:
  - address/details capped to 2 lines
  - distance pill anchored bottom-right
  - when a soft asset has multiple host places, show:
    - `Available in X other place(s)`

Clarified behavior already established:
- for soft assets, mobile cards use the nearest resolved host location when user location is available
- Google Maps directions/search trigger uses that shown host location

## Key Files For Resume

### Discovery / mobile UI
- `client/src/pages/DiscoverPage.jsx`
- `client/src/features/discover/DiscoveryFilterPanel.jsx`
- `client/src/features/discover/DiscoveryResultsList.jsx`
- `client/src/features/discover/DiscoveryMobileBrowseCard.jsx`
- `client/src/features/discover/DiscoveryModeToggle.jsx`
- `client/src/features/discover/DiscoveryMap.jsx`
- `client/src/features/discover/DiscoveryInspector.jsx`
- `client/src/features/discover/discoveryData.js`
- `client/src/features/discover/discoverUtils.js`
- `client/src/features/discover/useDiscoveryLocation.js`

### Saved assets / directory / maps
- `client/src/contexts/SavedAssetsContext.jsx`
- `client/src/hooks/useSavedAssets.js`
- `client/src/components/SaveAssetButton.jsx`
- `client/src/pages/MyDirectoryPage.jsx`
- `client/src/pages/MyMapDetailPage.jsx`
- `client/src/components/CreateMapModal.jsx`
- `client/src/components/RenameMapModal.jsx`

### Backend files added during earlier phases
- `server/src/controllers/favoritesController.js`
- `server/src/controllers/myMapsController.js`
- `server/src/routes/myMaps.js`
- `server/src/utils/savedAssets.js`
- `server/src/db/schema.js`
- `server/src/utils/boundarySchema.js`

## Known Constraints / Guidance
- Keep changes low-risk and incremental
- Standard-user UX has been the main focus; partner/admin flows should remain untouched unless required
- Discovery mobile layout has been iterated repeatedly; verify live behavior before assuming a deployed change is visible
- Deploys require:
  - `VITE_API_URL="https://senior-resource-map-api.joshuachua79.workers.dev/api"`
  - `npm run deploy:client -- --commit-dirty=true`

## Suggested Resume Point
When resuming, start with:
1. compare local mobile-card state vs the latest deployed preview
2. verify whether the current deployed card layout matches expectations on real mobile width
3. continue mobile discovery-card polish only after confirming live behavior

## Suggested Prompt To Resume
Use this when returning:

`Continue from docs/session-handoff.md and the current worktree. Start by summarizing the latest deployed mobile discovery-card state and any local changes not yet deployed.`
