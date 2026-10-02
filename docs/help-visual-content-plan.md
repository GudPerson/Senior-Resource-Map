# Visual instructions for the CareAround Help Centre

Status: investigation and proposed pilot, 2 October 2026. No Help Centre image renderer or approved publication assets have been implemented. The current local candidate is content version `2026-10-02.help-centre.3`; production publication remains a separate gate. Later workflow captures are QA evidence only, as described below.

## Recommendation

Add real CareAround screenshots at the steps where a reader needs to recognise a control, choose a location, or distinguish a save from publication. Start with **HC-09 and HC-10: adding and verifying a Personal place**, using six captures shared between the two articles. Keep the full numbered text usable without images. Then extend the approach to Map Studio and sharing after the pilot has been reviewed.

This directly supports the reported confusion between a private Personal place and a public Place. Images improve recognition and task completion. They do not train the model, prove an account's permissions or replace the Guide's reviewed knowledge. The existing canonical steps, exceptions, privacy boundaries and article citations remain the basis of answers.

Use screenshots of the actual local app. Do not use AI-generated UI, stock photos, a diagram presented as a screenshot, or the user's real account screenshots as public help assets. Photographs are useful later when a physical feature matters; they add little to locating a button or completing these forms.

## Small first pilot: six captures, two articles

Use a fictional map named “Example community map”, an owner account and neutral demonstration data. Capture the same sequence used by the text; avoid a screenshot for every keystroke.

| Capture | Placement and useful scope | Caption and suggested alt text |
| --- | --- | --- |
| Personal place entry, desktop | HC-09, after step 2. Crop the owner map toolbar, retaining the map heading and **+ Personal place**. Exclude account navigation and unrelated cards. | Caption: “Open your own map and select + Personal place.” Alt: “Owner map toolbar with the Personal place button.” |
| New location versus reuse | HC-09, after step 3's first action. Capture the chooser title, short explanation, **Choose map location**, and the reuse area. Do not crop to the button alone. | Caption: “Choose map location starts a new place; the list below reuses an existing place from My Places.” Alt: “Add personal place chooser with Choose map location and the My Places reuse list.” |
| Choose a point on the map | HC-09, after step 3. Capture the actual selection state and enough map context to show where to click or tap. Keep visible map attribution. | Caption: “Click or tap the intended spot on the map to open the place editor.” Alt: “Map in Personal place selection mode, ready for a location to be selected.” |
| Address lookup and successful verification | HC-09, steps 4–6; reuse in HC-10, steps 1–2. Frame the editor's title, name/category, location lookup, **Find location**, verification status and **Save**, where they fit legibly. Split the crop only if the complete dialog cannot be read; do not shrink a tall dialog into a tiny image. | Caption: “Use Find location, check the returned address and location, then review the details before Save.” Alt: “Personal place editor showing Find location, a verified location result, name/category fields and Save.” |
| Genuine point without a postal address | HC-10, after step 4; link or reuse at HC-09's no-address note. Show **This point has no postal address** checked, the resulting fields and the editor heading. | Caption: “Use this option only for a genuine point without an address. An addressed building still needs verification.” Alt: “Personal place editor with This point has no postal address selected.” |
| Personal place entry, phone | HC-09's phone note. Capture the open map menu at 390 px, retaining the menu heading and **Personal place** control. | Caption: “On a phone, open your map's menu and choose Personal place.” Alt: “Phone map menu with the Personal place control.” |

The verified-state image must show an actual rendered result from the local workflow. A deterministic fixture lookup may illustrate the UI, but it is not evidence that a real address or live geocoding was verified. A screenshot of Save being available is not proof that a place was saved. Keep the existing failure/retry and private/export notes in text.

## Next priorities after the pilot

| Article | Images worth adding | Device and wording constraints |
| --- | --- | --- |
| HC-12, Map Studio | The selected **View** and **All changes saved** status; one phone menu/Studio entry. A separate error/**Retry save** example is useful if save failures generate support questions. | Desktop panel and phone entry differ. Caption explicitly says that a saved view does not refresh the public snapshot. |
| HC-14, sharing | The Share dialog's snapshot explanation and **Publish share link** or **Update shared link**; **Unpublish**; a guest preview after explicit publication. Reuse the saved-view image from HC-12. | Show the actual first-publish and already-shared states separately. Do not imply that **Copy existing link** updates content. Use only disposable links. A screenshot cannot prove every privacy boundary; retain Personal place/export distinctions in text. |
| HC-31, Guide confirmation | A draft with **Review programme/service**, followed by the actual review card and **Create programme/service**. | Clearly distinguish draft, review, confirmation and success. No write occurs during drafting. Capturing a success state requires an explicit local fixture test write, never production. Current HC-31 is explanatory rather than a complete numbered procedure; review the procedure text before illustrating it. |
| HC-33, permissions | **Manage My Resources** and an exact assigned listing's **Edit**; a separate ordinary-account example without an Edit control if useful. | Explain that the screenshots illustrate different account states. Missing Edit is not a diagnosis by itself, and organisation membership does not grant resource editing. Avoid screenshots of account/access records or other people's assignments. |
| HC-34, public Place | **New Place** entry and the public-contact **Location** fields. | Label the workflow “Public Place”; do not reuse the Personal place editor. Show an authorised synthetic manager and qualify unavailable controls. |
| HC-35, Programme/service | **New Offering**, **Host & coverage → Host Locations**, then **Profile → Public contact and action details**. | The standard standalone editor differs from the Guide's one-Place Create action and template workflows. Captions must preserve those distinctions. |

Do not screenshot all 48 articles. Policy explanations often need clear text or a small comparison table; images are most useful at hidden controls, form transitions and confirmation boundaries. Prefer two or three purposeful images over a long gallery. Add mobile variants only when navigation or layout materially changes the action.

## Narrow integration design for a later implementation

The current article component renders paragraphs, ordered **string** steps and notes (`client/src/features/help/HelpArticle.jsx:5–44`). The builder explicitly projects those fields (`scripts/build-help-content.mjs:52–70`); adding an arbitrary image field to JSON would currently have no visible effect. Keep the string-step format and Guide answer assembly unchanged.

Proposed addition:

- An optional section `figures` list referring to approved asset IDs, with a position such as `afterStep: 2`. Validate that the referenced step exists. Bind a stored step-text digest to the placement so a later reorder or rewrite requires image review.
- One image manifest under `content/help/`, rather than copied image metadata in multiple articles. Give each capture a stable ID, desktop/mobile variant, locale, intrinsic width/height, caption, meaningful alt text, approved derivative path and byte hash.
- Internal review metadata records capture date, source commit or base commit plus candidate patch hash, content version, fixture scenario, viewport, source evidence, review state and named reviewer. Only reading metadata reaches public delivery.
- The builder validates assets and placement, checks hashes/freshness, and preserves the existing public/restricted policy separation. Draft, unreviewed, stale or missing images are not published.
- A small `HelpFigure` renderer displays a responsive image and HTML caption alongside the associated step. Reserve intrinsic dimensions, use lazy loading below the fold, and provide an accessible **Open larger image** link if details need enlargement. Avoid a new gallery, carousel or lightbox dependency for the pilot.

This is a proposal, not an implemented schema. The later patch should be confined to content metadata, the builder and help rendering. It should not modify map interaction, address validation, resource permissions, Guide confirmation, shared-map persistence or deployed configuration.

Store reviewed public derivatives under a proposed `client/public/help/<article-id>/<capture-id>-<hash>-<locale>-<device>.webp` convention, with a PNG alternative where fine UI text needs it. Reuse an asset ID across HC-09/10 instead of duplicating files. Keep raw captures and capture receipts in `output/help-visuals/`, outside the public delivery list. Existing Playwright outputs are QA evidence, not automatically approved documentation assets.

**Restricted images require a separate delivery decision.** A publicly served static file remains accessible even when its article is permission-gated. Do not place restricted screenshots, filenames, thumbnails or metadata in the public bundle. The first pilot uses public, fully sanitised instructional screenshots. Before any restricted pilot, either author a reviewed public-safe illustration of the generic controls or implement byte-level authenticated delivery with the existing article access policy and no public cache. Article gating alone is insufficient.

## Capture, readability and privacy rules

Use `http://127.0.0.1:5181` with the disposable local API on `http://127.0.0.1:8793`; confirm those endpoints and fixture mode before capture. The Help Centre article was inspected in that app during this review. The initial investigation created no publication image collection. A later goal-validation check captured four raw editor states under `output/help-centre/personal-place-workflow/`; these are QA evidence, not approved public help figures. The fixture’s existing map Personal place POST supports both creation and attachment. Standalone library creation/update is not fully mounted. The browser location lookup goes directly to OneMap; the workflow check replays a fictional result in both browser and server validation with external network disabled. `scripts/help-personal-place-uat.mjs` verifies desktop/phone addressed and map-only saves, My Places reuse and selected-map membership. It does not verify live geocoding or production save behaviour.

Capture desktop at 1440 px and phone at 390 px. Verify that labels remain legible when displayed in the Help article at phone width. Use tight crops with a recognisable dialog or page heading; avoid full-page browser screenshots and unrelated tabs. Preserve map attribution whenever map pixels are included. Use one focus outline or numbered callout only when necessary, with its meaning repeated in HTML text; never rely on colour alone or alter the depicted control/state.

Use fictional people, organisations, map names, programme names and notes. If an address is needed, use a reviewed public demonstration location without implying the example is a real CareAround listing. Exclude real personal locations, home/postal context, phone/email/profile details, access lists, IDs, login codes, credentials, browser history, private links, tokens, audit records and private notes. Do not capture Cloudflare/Neon dashboards. Prefer preventing sensitive data from appearing over blurring it afterward. Strip unnecessary image metadata and inspect every derivative before approval.

English screenshots are the initial canonical set; label the English UI example clearly where the user's selected language differs. Keep translated instructions as text until corresponding screenshots and labels are reviewed. Do not claim translated screenshot coverage from English captures.

## Review and maintenance

Proposed content owner remains Joshua, subject to confirmation under the existing project plan. The implementer captures fixtures and maintains evidence; a named content reviewer checks each instruction/image pairing; QA verifies desktop, phone and access boundaries. Record actual reviewers, rather than treating a proposed owner as approval.

Review the images whenever a referenced control, layout, permission, save state, translation or workflow changes. The manifest should make those source dependencies searchable. Include screenshot review in the release checklist for affected paths and in the existing quarterly catalogue review. If an image is stale or contradictory, remove it from delivery and keep the verified text visible until it is recaptured. Never retain a misleading image merely because its file still exists.

Pilot acceptance:

1. A reviewer follows the six Personal place steps on desktop and phone with only the article, and can distinguish new versus reused places and addressed versus genuine no-address points.
2. All figures appear at the intended step, captions/alt text agree with the canonical text, enlarged images are keyboard-accessible, and the article remains complete with images blocked. Check phone width and 200% zoom for overflow and legibility.
3. File existence/hash/placement checks pass; reviewed public data contains no restricted assets or review internals; no layout jumps or unrelated API requests appear. An initial target of roughly 150 KB per derivative is a performance budget, not a reason to make labels illegible.
4. Guide outputs, article/section citations, source visibility and explicit action confirmations remain unchanged. Run affected builder/help browser checks, `npm run build:client`, and the existing answer cases; a server/access change also requires the server suite.
5. Record whether images helped a reader complete the task without assistance, and any missed step. A few observed reader trials are useful directional evidence, not a statistical usability score or production acceptance.

## Source grounding

- Canonical tasks: `content/help/articles/hc-09-add-a-personal-place-to-your-map.json`, `hc-10-verify-a-personal-place-address-or-use-a-genuine-point-without-an-address.json`, `hc-12-open-map-studio-and-save-a-view.json`, `hc-14-publish-update-or-stop-sharing-a-map.json`, and HC-31/33/34/35 in the same folder.
- New versus reusable location chooser: `client/src/components/personalPlaces/AddPersonalPlaceChooserModal.jsx:10–159`.
- Verification, no-address selection and Save: `client/src/components/personalPlaces/PersonalPlaceEditorModal.jsx:235–432`; map selection and phone menu: `client/src/pages/MyMapDetailPage.jsx:676–730,3010–3045`.
- Studio view/save feedback: `client/src/components/MapStudioViewsPanel.jsx:479–633`; publish/update/unpublish: `client/src/components/ShareMapModal.jsx:256–297,456–514`.
- Existing capture environment: `server/test/fixtures/supportBrowserServer.mjs:232–268`; existing local role/action/browser proof: `scripts/help-guide-system-uat.mjs`.
- Maintenance and proof separation: `docs/help-content-authoring.md`, `docs/regression-ledger.md` and `docs/session-handoff.md`. Source/UI inspection grounds this recommendation; it does not claim publication-ready screenshots, reader acceptance or production verification.
