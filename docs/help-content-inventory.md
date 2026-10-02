# Help content inventory

Date: 2 October 2026 (Asia/Singapore)

This is the frozen source-reviewed inventory for the unified Help Centre and Guide local candidate. It contains 48 articles. Approval here is editorial/source approval against release `b8345be4d2f7a097e81cb03eef64b473abd0cec9`; it is not fresh all-role, device, write-path or production acceptance. All 105 original fact identities remain. One hundred original objects retain their exact hashes; five source-reviewed corrections retain their original hashes and reasons in the migration provenance and `docs/help-content-reviewed-corrections.md`. New procedural sections cite the source inspected during this task.

## Source and scope boundaries

- Every one of the 105 baseline product facts has exactly one article/section home. No original fact message is independently copied or rewritten in article paragraphs.
- The 12 basic topics remain compatibility mappings to their original `help-*` fact. Their authoring text has no second editable home.
- Articles are role organised; audience labels do not grant access. Restricted delivery uses the backend predicates named by the manifest/access adapter.
- HC-40 and HC-43 are resource-manager guidance; HC-42/46/47 are admin guidance; HC-44/45 require organisation access; HC-48 requires Audit Trail access. These restrictions intentionally tighten operational fact retrieval; the controlled five corrections and original fact identities are separate from visibility policy.
- The released Map Studio uses automatic saving/status, Discard and Retry save. The September draft’s normal Save changes button was not carried into HC-12. Publishing or updating a Shared Map remains explicit.
- HC-47 separates read-only Admin Support Coverage from support-report review, which currently requires a non-impersonating Super Admin. Privileged report operations remain in operator guidance rather than public article instructions.
- HC-09 answers the exact question “how can i add places that are not found in carearound SG” from My Maps with Personal place creation, address verification, a genuine no-address exception, private reuse and owner-export/public-sharing boundaries.
- Claims about generally unavailable controls stay qualified in the reviewed facts, including the corrected Region Groups availability statement. No new provider booking, chat, analytics, whole-directory export, account-deletion or ownership-transfer control is promised.

## Article and fact disposition

| Article | Category | Visibility | State | Original fact identities | Additional evidence records |
| --- | --- | --- | --- | --- | --- |
| HC-01 — What CareAround helps you do | getting-started | public | approved (source only) | help-overview, resource-types | — |
| HC-02 — Sign in and find your way around | getting-started | public | approved (source only) | help-login, account-recovery-help, public-browsing | article-hc-02-sign-in-steps, article-hc-02-whatsapp-sign-in-steps |
| HC-03 — Find a resource by name, category or location | find-and-save | public | approved (source only) | help-discover, discover-nearby, accessibility-search-boundary | article-hc-03-nearby-search-steps, article-hc-03-resource-search-steps |
| HC-04 — Read resource details and check information with the provider | find-and-save | public | approved (source only) | offering-eligibility, offering-not-visible, provider-contact, provider-wait-time, provider-availability | article-hc-04-provider-details-steps |
| HC-05 — Save and unsave a resource | find-and-save | public | approved (source only) | help-save, help-unsave, saved-identity-privacy, save-place-separately, saved-resource-removal, saved-not-eligible, saved-resource-status | article-hc-05-remove-saved-resource-steps, article-hc-05-remove-unused-saved-resources, article-hc-05-save-resource-steps |
| HC-06 — Understand Saved Resources, My Maps, My Places and managed resources | find-and-save | public | approved (source only) | saved-versus-managed, saved-list-privacy, directory-export-boundary | article-hc-06-manage-listings |
| HC-07 — Create a My Map | my-maps | public | approved (source only) | help-maps | map-create-cancel-save-effects |
| HC-08 — Add or remove resources in an existing map | my-maps | public | approved (source only) | map-membership, my-map-resource-removal | map-resource-update-procedure |
| HC-09 — Add a missing location as a Personal place on your map | my-maps | public | approved (source only) | — | personal-place-map-create |
| HC-10 — Verify a Personal place address or use a genuine point without an address | my-maps | public | approved (source only) | — | personal-place-location-verification |
| HC-11 — Reuse, edit, detach or delete a Personal place | my-maps | public | approved (source only) | my-places, personal-place-address-edit | article-hc-11-delete-personal-place-everywhere-steps, article-hc-11-detach-personal-place-steps, article-hc-11-reuse-or-remove |
| HC-12 — Open Map Studio and keep a saved view on desktop or mobile | map-design-and-exports | public | approved (source only) | map-studio | article-hc-12-studio-view |
| HC-13 — Print or export your own map | map-design-and-exports | public | approved (source only) | my-map-exports | article-hc-13-map-notes-and-workbook-steps, article-hc-13-visual-map-export-steps |
| HC-14 — Publish, update or stop sharing a map | sharing | public | approved (source only) | help-sharing, shared-map-viewer-boundary, personal-place-sharing, saved-to-shared-map, website-embeds | map-studio-share-update |
| HC-15 — Add private map notes and review shared notes | sharing | public | approved (source only) | map-note-privacy, my-map-note-edit | article-hc-15-private-map-note-steps, article-hc-15-shared-map-note-steps |
| HC-16 — Add annotations and review their sharing behaviour | map-design-and-exports | public | approved (source only) | embedded-map-notes | article-hc-16-annotation-boundary, article-hc-16-draw-annotation-steps, article-hc-16-share-annotation-steps |
| HC-17 — Understand missing pins, list-only resources, filters and map framing | map-design-and-exports | public | approved (source only) | help-detailed-map | article-hc-17-restore-hidden-map-pin-steps, article-hc-17-restore-map-resource-categories-steps, map-missing-pin |
| HC-18 — Export Map Assets and understand the workbook | map-design-and-exports | public | approved (source only) | resource-export-context, private-map-export-sharing | article-hc-18-map-assets-workbook-steps |
| HC-19 — View or copy a Shared Map | sharing | public | approved (source only) | shared-map-copy | article-hc-19-copy-shared-map-steps, article-hc-19-view-shared-map-steps |
| HC-20 — Download a town map versus exporting your own My Map | map-design-and-exports | public | approved (source only) | town-maps | article-hc-20-town-map-download-steps |
| HC-21 — Understand which activities appear in Care Calendar | calendar | public | approved (source only) | help-calendar | — |
| HC-22 — Add a session to My Plans and arrange booking with the provider | calendar | public | approved (source only) | plans-not-bookings, provider-plan-privacy, plan-a-session | my-plans-booking |
| HC-23 — Review schedule changes, cancellations and Updates | calendar | public | approved (source only) | provider-plan-lifecycle, plan-schedule-update | article-hc-23-calendar-update-review-steps |
| HC-24 — Manage a dated personal reminder, if supported | calendar | public | approved (source only) | calendar-personal-entry, plan-date-change, remove-plan | article-hc-24-change-dated-map-note-steps, article-hc-24-dated-map-note-steps, article-hc-24-remove-calendar-plan-steps |
| HC-25 — Update profile and location preferences | account-and-display | public | approved (source only) | offering-profile-missing, profile-update, account-deletion-help | article-hc-25-profile-details-steps, article-hc-25-profile-postal-code-steps |
| HC-26 — Choose language, contrast and text size | account-and-display | public | approved (source only) | language-choice | article-hc-26-app-language-steps, article-hc-26-contrast-text-size-steps, article-hc-26-readability-controls |
| HC-27 — Verify or link a phone using the available account controls | account-and-display | public | approved (source only) | — | article-hc-27-phone-verification, article-hc-27-remove-whatsapp-link-steps, article-hc-27-verify-profile-phone-steps |
| HC-28 — Link a Place membership using its approved QR code or link | account-and-display | public | approved (source only) | saved-versus-membership, offering-host-versus-membership, other-place-memberships, place-membership-navigation, place-membership | article-hc-28-place-membership-link-steps |
| HC-29 — Ask the Guide, read its sources and use help when AI is unavailable | guide-and-support | public | approved (source only) | help-privacy, provider-usage-boundary | article-hc-29-ask-guide, article-hc-29-read-help-without-ai |
| HC-30 — Check your own current account access through the Guide | guide-and-support | public | approved (source only) | guide-provider-identity-check, other-account-saved-privacy | article-hc-30-current-account, guide-other-account-access-boundary |
| HC-31 — Review and confirm a supported Guide action | guide-and-support | public | approved (source only) | guide-create-scope, guide-existing-resource-edit-scope | article-hc-31-guide-programme-confirmation-steps, article-hc-31-guide-review-resource-save-steps |
| HC-32 — Report a problem, use Inbox and recover a guest report | guide-and-support | public | approved (source only) | help-support, guide-notification-controls, notification-delivery-channels, saved-schedule-notifications | article-hc-32-recover-guest-report-steps, article-hc-32-saved-resource-notification-steps, article-hc-32-support-inbox-follow-up-steps, article-hc-32-support-report-steps |
| HC-33 — Understand assigned resource permissions and missing controls | resource-management | public | approved (source only) | resource-edit, place-owner-transfer-boundary, place-assignment-scope, place-staff-assignment, volunteer-place-create-boundary, regional-admin-place-edit-boundary | article-hc-33-assign-or-remove-place-access, article-hc-33-organisation-edit-boundary |
| HC-34 — Create or maintain a public Place | resource-management | public | approved (source only) | help-add-resource, place-contact-edit | article-hc-34-create-public-place, article-hc-34-maintain-public-place |
| HC-35 — Create or maintain a Programme/service | resource-management | public | approved (source only) | offering-host-change, offering-multi-host, offering-contact-edit | article-hc-35-create-standard-offering, article-hc-35-maintain-local-place-version, article-hc-35-maintain-standard-offering |
| HC-36 — Maintain Programme schedules and sessions | resource-management | public | approved (source only) | offering-schedule-edit | article-hc-36-cancel-or-unpublish-sessions, article-hc-36-publish-structured-sessions |
| HC-37 — Change resource visibility and distinguish hiding from deleting | resource-management | public | approved (source only) | hidden-saved-resources, listing-publication-boundary, resource-hide-delete | article-hc-37-confirm-filtered-visibility, article-hc-37-hide-or-show-one-listing, article-hc-37-review-before-listing-delete, article-hc-37-schedule-a-listing-hide |
| HC-38 — Use Offering templates and place versions | resource-management | public | approved (source only) | offering-template-delete, offering-template-propagation, offering-template-overview | article-hc-38-create-and-generate-template, article-hc-38-delete-template-or-one-version, article-hc-38-edit-shared-template |
| HC-39 — Create or manage public Resource Groups | resource-management | public | approved (source only) | resource-groups, group-other-provider-members, group-target-regions, group-staff-visibility, group-create, group-edit | article-hc-39-create-public-resource-group, article-hc-39-maintain-public-resource-group, governance-archive-chat-boundary, public-group-people-boundary |
| HC-40 — Review extracted flyer or calendar drafts before saving | resource-management | resource-manager | approved (source only) | — | article-hc-40-review-import-drafts |
| HC-41 — Review translations and preserve approved wording | resource-management | public | approved (source only) | offering-translation-review | article-hc-41-review-managed-translation |
| HC-42 — Use scoped workbook import/export | resource-management | admin | approved (source only) | asset-workbook-import | article-hc-42-export-current-resource-workbook, article-hc-42-import-approved-resource-workbook |
| HC-43 — Use permitted restricted notes and files | resource-management | resource-manager | approved (source only) | — | article-hc-43-restricted-content, article-hc-43-save-restricted-notes-and-viewers, article-hc-43-upload-or-remove-private-resource-file |
| HC-44 — Use Organisation Workspace and governance access | organisation-governance | organization | approved (source only) | organization-workspace | — |
| HC-45 — Understand coordination groups versus public Resource Groups | organisation-governance | organization | approved (source only) | governance-group-membership, governance-group-overview, governance-org-group, governance-region-group | article-hc-45-create-or-update-org-coordination-group, article-hc-45-region-group-current-availability, article-hc-45-review-coordination-group-access |
| HC-46 — Manage permitted user access and region scope | admin-support | admin | approved (source only) | admin-region-scope, region-boundary-layers | article-hc-46-assign-admin-region-scope, article-hc-46-change-permitted-platform-role, article-hc-46-review-and-update-boundary-postcodes |
| HC-47 — Understand Admin Support Coverage and its limits | admin-support | admin | approved (source only) | — | article-hc-47-support-coverage |
| HC-48 — Read Audit Trail and understand its limits | admin-support | audit | approved (source only) | audit-trail | article-hc-48-filter-and-read-permitted-audit |

## Additional generated evidence

The current `2026-10-02.help-centre.4` library contains 196 evidence records: 105 original fact identities (100 exact original objects and five documented corrections), seven explicit procedure records, 81 derived reading sections and three public boundary explanations. The 48 articles include 42 with numbered instructions (80 procedure sections / 416 steps) and six conceptual articles. Reader-only sections automatically become same-policy Guide evidence, so their paragraphs/steps/notes have one editable home. The table above accounts for every record; derived records are listed below for source and delivery review.

| Derived evidence | Article/section | Delivery |
| --- | --- | --- |
| article-hc-02-sign-in-steps | HC-02 / sign-in-steps | public |
| article-hc-02-whatsapp-sign-in-steps | HC-02 / whatsapp-sign-in-steps | public |
| article-hc-03-nearby-search-steps | HC-03 / nearby-search-steps | public |
| article-hc-03-resource-search-steps | HC-03 / resource-search-steps | public |
| article-hc-04-provider-details-steps | HC-04 / provider-details-steps | public |
| article-hc-05-remove-saved-resource-steps | HC-05 / remove-saved-resource-steps | public |
| article-hc-05-remove-unused-saved-resources | HC-05 / remove-unused-saved-resources | public |
| article-hc-05-save-resource-steps | HC-05 / save-resource-steps | public |
| article-hc-06-manage-listings | HC-06 / manage-listings | public |
| article-hc-11-delete-personal-place-everywhere-steps | HC-11 / delete-personal-place-everywhere-steps | public |
| article-hc-11-detach-personal-place-steps | HC-11 / detach-personal-place-steps | public |
| article-hc-11-reuse-or-remove | HC-11 / reuse-or-remove | public |
| article-hc-12-studio-view | HC-12 / studio-view | public |
| article-hc-13-map-notes-and-workbook-steps | HC-13 / map-notes-and-workbook-steps | public |
| article-hc-13-visual-map-export-steps | HC-13 / visual-map-export-steps | public |
| article-hc-15-private-map-note-steps | HC-15 / private-map-note-steps | public |
| article-hc-15-shared-map-note-steps | HC-15 / shared-map-note-steps | public |
| article-hc-16-annotation-boundary | HC-16 / annotation-boundary | public |
| article-hc-16-draw-annotation-steps | HC-16 / draw-annotation-steps | public |
| article-hc-16-share-annotation-steps | HC-16 / share-annotation-steps | public |
| article-hc-17-restore-hidden-map-pin-steps | HC-17 / restore-hidden-map-pin-steps | public |
| article-hc-17-restore-map-resource-categories-steps | HC-17 / restore-map-resource-categories-steps | public |
| article-hc-18-map-assets-workbook-steps | HC-18 / map-assets-workbook-steps | public |
| article-hc-19-copy-shared-map-steps | HC-19 / copy-shared-map-steps | public |
| article-hc-19-view-shared-map-steps | HC-19 / view-shared-map-steps | public |
| article-hc-20-town-map-download-steps | HC-20 / town-map-download-steps | public |
| article-hc-23-calendar-update-review-steps | HC-23 / calendar-update-review-steps | public |
| article-hc-24-change-dated-map-note-steps | HC-24 / change-dated-map-note-steps | public |
| article-hc-24-dated-map-note-steps | HC-24 / dated-map-note-steps | public |
| article-hc-24-remove-calendar-plan-steps | HC-24 / remove-calendar-plan-steps | public |
| article-hc-25-profile-details-steps | HC-25 / profile-details-steps | public |
| article-hc-25-profile-postal-code-steps | HC-25 / profile-postal-code-steps | public |
| article-hc-26-app-language-steps | HC-26 / app-language-steps | public |
| article-hc-26-contrast-text-size-steps | HC-26 / contrast-text-size-steps | public |
| article-hc-26-readability-controls | HC-26 / readability-controls | public |
| article-hc-27-phone-verification | HC-27 / phone-verification | public |
| article-hc-27-remove-whatsapp-link-steps | HC-27 / remove-whatsapp-link-steps | public |
| article-hc-27-verify-profile-phone-steps | HC-27 / verify-profile-phone-steps | public |
| article-hc-28-place-membership-link-steps | HC-28 / place-membership-link-steps | public |
| article-hc-29-ask-guide | HC-29 / ask-guide | public |
| article-hc-29-read-help-without-ai | HC-29 / read-help-without-ai | public |
| article-hc-30-current-account | HC-30 / current-account | public |
| article-hc-31-guide-programme-confirmation-steps | HC-31 / guide-programme-confirmation-steps | public |
| article-hc-31-guide-review-resource-save-steps | HC-31 / guide-review-resource-save-steps | public |
| article-hc-32-recover-guest-report-steps | HC-32 / recover-guest-report-steps | public |
| article-hc-32-saved-resource-notification-steps | HC-32 / saved-resource-notification-steps | public |
| article-hc-32-support-inbox-follow-up-steps | HC-32 / support-inbox-follow-up-steps | public |
| article-hc-32-support-report-steps | HC-32 / support-report-steps | public |
| article-hc-33-assign-or-remove-place-access | HC-33 / assign-or-remove-place-access | public |
| article-hc-33-organisation-edit-boundary | HC-33 / organisation-edit-boundary | public |
| article-hc-34-create-public-place | HC-34 / create-public-place | public |
| article-hc-34-maintain-public-place | HC-34 / maintain-public-place | public |
| article-hc-35-create-standard-offering | HC-35 / create-standard-offering | public |
| article-hc-35-maintain-local-place-version | HC-35 / maintain-local-place-version | public |
| article-hc-35-maintain-standard-offering | HC-35 / maintain-standard-offering | public |
| article-hc-36-cancel-or-unpublish-sessions | HC-36 / cancel-or-unpublish-sessions | public |
| article-hc-36-publish-structured-sessions | HC-36 / publish-structured-sessions | public |
| article-hc-37-confirm-filtered-visibility | HC-37 / confirm-filtered-visibility | public |
| article-hc-37-hide-or-show-one-listing | HC-37 / hide-or-show-one-listing | public |
| article-hc-37-review-before-listing-delete | HC-37 / review-before-listing-delete | public |
| article-hc-37-schedule-a-listing-hide | HC-37 / schedule-a-listing-hide | public |
| article-hc-38-create-and-generate-template | HC-38 / create-and-generate-template | public |
| article-hc-38-delete-template-or-one-version | HC-38 / delete-template-or-one-version | public |
| article-hc-38-edit-shared-template | HC-38 / edit-shared-template | public |
| article-hc-39-create-public-resource-group | HC-39 / create-public-resource-group | public |
| article-hc-39-maintain-public-resource-group | HC-39 / maintain-public-resource-group | public |
| article-hc-40-review-import-drafts | HC-40 / review-import-drafts | resource-manager |
| article-hc-41-review-managed-translation | HC-41 / review-managed-translation | public |
| article-hc-42-export-current-resource-workbook | HC-42 / export-current-resource-workbook | admin |
| article-hc-42-import-approved-resource-workbook | HC-42 / import-approved-resource-workbook | admin |
| article-hc-43-restricted-content | HC-43 / restricted-content | resource-manager |
| article-hc-43-save-restricted-notes-and-viewers | HC-43 / save-restricted-notes-and-viewers | resource-manager |
| article-hc-43-upload-or-remove-private-resource-file | HC-43 / upload-or-remove-private-resource-file | resource-manager |
| article-hc-45-create-or-update-org-coordination-group | HC-45 / create-or-update-org-coordination-group | organization |
| article-hc-45-region-group-current-availability | HC-45 / region-group-current-availability | organization |
| article-hc-45-review-coordination-group-access | HC-45 / review-coordination-group-access | organization |
| article-hc-46-assign-admin-region-scope | HC-46 / assign-admin-region-scope | admin |
| article-hc-46-change-permitted-platform-role | HC-46 / change-permitted-platform-role | admin |
| article-hc-46-review-and-update-boundary-postcodes | HC-46 / review-and-update-boundary-postcodes | admin |
| article-hc-47-support-coverage | HC-47 / support-coverage | admin |
| article-hc-48-filter-and-read-permitted-audit | HC-48 / filter-and-read-permitted-audit | audit |

The three public boundary facts are `guide-other-account-access-boundary` (HC-30), `public-group-people-boundary` (HC-39) and `governance-archive-chat-boundary` (HC-39). They retain useful public refusal/distinction answers without revealing restricted operational guidance. They do not grant permission or rewrite a baseline fact.

The final supplemental HC-29 paragraph is grounded in the candidate's tested static Help Centre, beyond the unchanged release baseline. Its source evidence explicitly identifies that candidate verification.

## Required verification before release

- Content builder: exact baseline hashes, unique fact/section/article IDs, complete metadata, approved state, safe role filtering, stable links and deterministic outputs.
- Offline semantic cases: all critical domain, privacy, access and confirmation assertions pass; all required HC-09 steps/qualifications pass; at least 95% factual/step assertions and 90% complete task outcomes across the fixed cases.
- Human checks: the article task, applicable roles, actual controls, mobile navigation and errors; source review does not replace fresh browser or action acceptance.
- Live-model checks require a separately authorised bounded allowance and preserve model/content/call/spend evidence. No model call was used to create this inventory.
- A released workflow change must update or retire affected approved instructions; review privacy/sharing/permission/action articles monthly and the whole catalogue quarterly.

## Remaining proof gaps

Local fixture role/mobile/keyboard/navigation/revocation checks and a disposable confirmed Programme write now pass; see `docs/help-guide-implementation-status.md`. Human article/whole-output signoff, credentialed partner/physical-device acceptance where applicable, downloaded-file inspection if that workflow changes, authorised real-model quality evaluation, and production release/parity remain separate proof gaps. The catalogue supplies reviewed procedures and preserves existing qualifications; it does not certify every provider record or privately inspect an account.
