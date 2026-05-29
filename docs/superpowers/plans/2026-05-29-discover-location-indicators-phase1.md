# Discover Location Indicators Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add display-only Discover location indicators for signed-in home/profile Region, searched postal-code Region, and Audience Zone matches, while deferring exact Locate Me Region support.

**Architecture:** The server exposes a small optional-auth Worker endpoint returning booleans keyed by already-visible resource refs. The client decorates the already-ordered displayed resource list and renders a compact badge component inside existing cards without touching distance pills or filtering/sorting logic.

**Tech Stack:** React, Vite, Hono, Drizzle ORM, Node test runner, Cloudflare Worker route structure.

---

## File Structure

- Create `client/src/features/discover/locationIndicators.js`: pure client helpers for resource refs, decoration, and presentation.
- Create `client/src/components/DiscoveryLocationIndicatorBadges.jsx`: compact icon/pill display component.
- Create `client/test/locationIndicators.test.js`: tests for presentation and no-order-change decoration.
- Modify `client/src/lib/api.js`: add `getDiscoveryLocationIndicators`.
- Modify `client/src/lib/i18n.js`: add public-safe copy keys.
- Modify `client/src/pages/DiscoverPage.jsx`: fetch indicators for displayed resources and pass decorated resources to the list.
- Modify `client/src/components/AssetCard.jsx`: render desktop indicator badges.
- Modify `client/src/features/discover/DiscoveryMobileBrowseCard.jsx`: render mobile indicator badges.
- Create `server/src/utils/discoveryLocationIndicators.js`: normalize refs, compute context, load resource metadata, and build boolean-only output.
- Create `server/src/controllers/discoveryController.js`: validate request and return booleans.
- Create `server/src/routes/discovery.js`: mount the endpoint with optional auth.
- Modify `server/src/app.js`: register `/api/discovery`.
- Create `server/test/discoveryLocationIndicators.test.js`: tests for server boolean logic, searched postal context, resource normalization, and privacy-safe output.

## Tasks

### Task 1: Client Helper Tests And Implementation

- [ ] Write `client/test/locationIndicators.test.js` covering presentation priority and no-order-change decoration.
- [ ] Run `node --test client/test/locationIndicators.test.js` and verify it fails because the helper module does not exist.
- [ ] Add `client/src/features/discover/locationIndicators.js`.
- [ ] Run `node --test client/test/locationIndicators.test.js` and verify it passes.

### Task 2: Server Boolean Logic Tests And Implementation

- [ ] Write `server/test/discoveryLocationIndicators.test.js` covering compact refs, searched-postal context, boolean-only output, and no internal words/IDs in JSON.
- [ ] Run `node --test server/test/discoveryLocationIndicators.test.js` and verify it fails because the server helper module does not exist.
- [ ] Add `server/src/utils/discoveryLocationIndicators.js`.
- [ ] Run `node --test server/test/discoveryLocationIndicators.test.js` and verify it passes.

### Task 3: Worker Endpoint

- [ ] Add `server/src/controllers/discoveryController.js` using existing request validation helpers.
- [ ] Add `server/src/routes/discovery.js` with `POST /location-indicators` and optional auth.
- [ ] Register `/api/discovery` in `server/src/app.js`.
- [ ] Run `node --test server/test/discoveryLocationIndicators.test.js`.

### Task 4: Client Wiring And Badges

- [ ] Add `getDiscoveryLocationIndicators` to `client/src/lib/api.js`.
- [ ] Add public-safe copy keys to `client/src/lib/i18n.js`.
- [ ] Add `client/src/components/DiscoveryLocationIndicatorBadges.jsx`.
- [ ] Render badges in desktop and mobile cards without changing the distance pill.
- [ ] Fetch/decorate indicators in `DiscoverPage.jsx` only for displayed resources and only when signed-in or a searched postal context exists.
- [ ] Run `node --test client/test/locationIndicators.test.js`.

### Task 5: Verification

- [ ] Run `npm run test:server`.
- [ ] Run `npm run build:client`.
- [ ] Run `git diff --check`.
- [ ] Review `git diff` for scope, privacy text, and unintended sorting/filtering/distance-pill changes.
