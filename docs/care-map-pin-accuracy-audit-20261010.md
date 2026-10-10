# Care Map pin accuracy audit — 10 October 2026

The user prioritizes geographic accuracy over decorative separation and approved removing automatic pin containment. The isolated candidate starts at accepted public `83754580`. Stored coordinates, resources, annotations, privacy and sharing permissions are unchanged.

| Behaviour | Evidence | Decision |
| --- | --- | --- |
| Push numbered/category artwork inside the viewport | One isolated numbered pin changes its margin by up to 58.9px as its anchor crosses the edge. The camera itself holds this pan. Disabling only the edge constraint makes the same replay pass. | Disable automatic displacement in live DirectoryMap instances. |
| Separate overlapping artwork | The collision solver allows 44px of movement and previously schedules repeated passes and observes marker mutations. The old overlapping-pin replay fails the geographic-margin assertion. | Disable in live maps; keep explicit static print-layout opt-in. |
| Spread coincident pins | The display adapter alters latitude/longitude by 0.00018 degrees in interactive mode. | Disable in live maps, even during temporarily suspended interaction. |
| Group different coordinates | Postal grouping averages coordinates; numbered grouping also uses 0.0003-degree tolerance and four-decimal keys. | V2 Care Map, shared/embed and owner numbered pins group only identical numeric coordinates. Hide pin rebuilds retain the same contract. Resource cards and true coincident member identities remain. Discover and legacy postal grouping remain unchanged. |
| Repeat selected-resource fullscreen focus | Selecting a resource before fullscreen makes a 250px drag move less than one pixel; the focused camera is reapplied repeatedly. | Owner fullscreen acknowledges the focus once per selection and retains the tray. Explicit selection renews focus; reopening preserves the browsed camera. Shared Map focus callbacks remain unchanged. |

Nearby pins may overlap. A composite badge for genuinely identical coordinates remains centered on that shared anchor. Existing camera fits on first load, intentional selection/recenter and layout changes remain; ordinary panning is not a fit request. Minimum-zoom and Detailed-surface camera controls are separate policies, not pin-coordinate edits; mobile V2 does not enable desktop Detailed resize containment. No changes were made to these policies.

Local evidence uses actual map components/owner page with fictional APIs and native emulated touch. Eight retained reports cover pin edges, overlap, selected/unselected panning, zoom/cancel, viewport resize, return/reopen and deliberate selection; see the sanitized local evidence JSON. Original failures and targeted corrections remain private in `/private/tmp/care-map-pin-containment-20261010`. A physical installed Android PWA assessment remains necessary. Saved geographic data itself has not been re-geocoded or externally verified.
