# My Map Category Bubble Markers Design

## Goal

Align the My Map and shared-map marker language with the proven print-view bubble behavior while preserving each surface's purpose.

The print view already uses a stable bubble layout for nearby resources. My Map V2 should use the same arrangement behavior, but render category-icon bubbles instead of numbered badges. Shared maps should follow after owner My Map V2 passes UAT.

## Scope

- Owner My Map V2 at `/my-directory/maps/:id`.
- Shared maps after owner My Map V2 validation.
- Print view remains on its existing numeric bubble-marker behavior.
- Classic My Map at `?ui=stable` remains unchanged.

This work does not touch auth/session, schema, permissions, postal validation, Discover ranking/filtering/visibility, Gmail/email, GudAuth, secrets, or production data.

## Marker Model

Introduce a reusable bubble-arrangement layer in `DirectoryMap` that can serve multiple marker presentations:

- `print-badge`: numeric print markers, preserving the current print behavior.
- `category-bubble`: interactive category-icon markers for My Map V2 and later shared maps.

The arrangement layer should keep nearby markers readable by gently pushing bubbles into a touching or near-touching cluster. The visible bubble is the active target: hover, click, keyboard focus, card highlighting, and zoom should use the arranged bubble position instead of an invisible original coordinate.

## Category Bubble Presentation

Each visible category bubble represents one resource or one resource-like mapped item. Resources do not share a single count badge merely because they share a postal code.

Bubble contents:

- Use the resource's category icon when available.
- Fall back to a heart icon when no category icon is available.
- Preserve category color as part of the bubble treatment so different resource types remain scannable.

For resources at the same or very close coordinates, bubbles should sit side by side like connected lobes. All lobes must remain visible and individually targetable.

## Interaction Rules

- Hovering a bubble highlights its corresponding resource card.
- For a joined same-location cluster, the group may show a shared hover emphasis, but individual resource identity must remain clear.
- Clicking a bubble should focus the intended resource, not a neighboring bubble.
- Reset zoom and map movement must not make bubbles dance or reflow during hover.
- Pointer hit areas should match the final visible bubble geometry closely enough to avoid flicker.

## Rollout Plan

1. Refactor the print bubble layout into a reusable internal helper without changing print output.
2. Add the `category-bubble` marker mode for owner My Map V2 only.
3. Validate My Map V2 visually and with focused tests.
4. Enable the same marker mode for shared maps after My Map V2 passes UAT.

## Validation

Minimum checks before release:

- `npm run build:client`
- Focused tests around `DirectoryMap` marker modes and My Map V2/shared-map presentation.
- Manual UAT on `/my-directory/maps/87`.
- Manual check that `?ui=stable` still shows the classic stable map.
- Manual check that print view still uses numeric badges and retains the existing bubble behavior.
- Manual shared-map check after shared maps are enabled.

## Release Notes

This is a visual and interaction refinement for My Directory maps. It should be treated as client-only unless implementation uncovers missing marker metadata, in which case the blast radius must be reassessed before touching data or server code.
