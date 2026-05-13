# CareAround SG Project Dossier

Generated from the current repository working tree on May 10, 2026.

This dossier is intended for funding preparation, pilot planning, stakeholder review, roadmap planning, AI feature planning, and conflict-of-interest review. It uses only what can be inferred from the current repository and labels uncertain points as `Assumption` or `Needs input`.

Confidentiality guardrail: this document describes code, schema, product behavior, and planning implications. It does not include senior case details, national identification details, private lists of personal contacts, real personal contact details, confidential partner information, environment credential values, or any claim that AIC officially endorses CareAround SG.

## 1. Executive Summary

CareAround SG is a web application for helping people in Singapore discover senior-related community resources, save useful options, and turn those options into practical directories and maps for planning, sharing, printing, or follow-up.

It serves guests, seniors, caregivers, family members, partner staff, administrators, and potential funders or sponsors. The public-facing experience focuses on discovery, saving, and planning. The operational experience focuses on resource management, partner/admin access, import/export, translation review, visibility rules, and partner-only content.

The problem it solves is service navigation friction: people may know support exists, but still struggle to find nearby, relevant, understandable, current, and shareable information. CareAround SG brings together places, programmes, services, events, promotions, profile context, eligibility hints, maps, shared directories, and partner-admin maintenance workflows.

Current maturity level: the codebase shows an advanced working prototype or pre-pilot product rather than a slide-only concept. Core user journeys such as Discover, resource details, saved resources, My Directory, My Maps, shared maps, dashboard resource management, workbook import/export, multilingual foundations, AI-assisted import/data-improvement tools, partner-only notes/files, and phone-login foundations are present. The regression ledger marks several surfaces as recovered and locked. The repository also contains current uncommitted work for partner organisation/staff handover. `Needs input`: live pilot status, production user count, partner commitments, formal data governance approval, support model, and deployment readiness should be confirmed outside the codebase.

Why it matters:

- Seniors and caregivers get a simpler way to compare nearby resources and keep a practical shortlist.
- AACs and community partners get a maintainable channel for resource visibility, member-related access, private operational notes, and staff-managed data quality.
- Administrators get structured controls for users, service areas, audience zones, categories, workbooks, imports, translations, and visibility.
- Funders and sponsors can see a concrete product foundation that can support a pilot, impact measurement, and future AI-assisted navigation with human review.

CareAround SG should be positioned as a community-care navigation and planning tool. It should not be positioned as emergency support, medical advice, diagnosis, clinical triage, financial advice, legal advice, government-service advice, or an officially endorsed AIC system unless formal written endorsement exists.

## 2. Product Vision

One-sentence vision: CareAround SG helps seniors, caregivers, and community partners find, organise, and maintain trusted local support information in a practical Singapore community-care context.

Three-year vision: CareAround SG becomes a human-reviewed community-care navigation layer that combines public discovery, partner-maintained resource data, safe sharing, multilingual access, privacy-aware analytics, and carefully governed AI assistance for support matching and service planning.

What CareAround SG should become:

- A practical discovery and planning tool for senior-related community resources.
- A partner-maintained resource directory with strong data quality workflows.
- A map-led way for caregivers, families, and staff to discuss options.
- A safe pilot platform for rule-based matching first, followed by human-reviewed AI assistance.
- A governance-conscious product that can support advisor, funder, partner, and conflict-of-interest review.
- A multilingual and accessibility-aware public experience.

What CareAround SG should not become:

- A clinical diagnosis, medical advice, or emergency triage tool.
- A black-box AI referral engine that makes unsupported recommendations.
- A source of official agency endorsement unless formally approved.
- A marketplace that prioritises paid placement over user need and partner trust.
- A store of unnecessary senior case details, private lists of personal contacts, or confidential partner records.
- A replacement for provider verification, caseworker judgment, or proper consent.

## 3. User Groups

| User group | Current repository evidence | Primary needs | Notes |
| --- | --- | --- | --- |
| Seniors | Public guide, Discover, resource details, profile, saved resources | Find understandable nearby support; save and revisit options | `Assumption`: seniors may use the app directly, but caregiver-mediated use may be common. |
| Caregivers | Public guide, My Directory, My Maps, shared maps, profile context | Compare resources, prepare family discussions, share view-only maps | Sharing needs clear privacy warnings because maps can reflect a care situation. |
| AAC staff | Partner/admin dashboard, resources, memberships, private content, translations | Maintain resources, support member access, review content, handle operational notes | `Needs input`: specific AAC workflows, staff roles, and pilot boundaries. |
| Community service partners | Partner resources, boundaries, audience zones, partner-only content | Keep listings current; manage visibility; support restricted offerings | Partner trust depends on permission clarity and data handling rules. |
| Administrators | Admin page, users, service areas, audience zones, workbooks, imports, tests | Operate the system safely, manage access, maintain data quality | Roles include super admin, regional admin, partner, standard, and guest. |
| Potential funders or sponsors | Product maturity, roadmap, impact metrics, funding logic | Understand problem, readiness, impact, governance, and sustainability | Funding narrative should keep seniors/caregivers free and avoid early monetisation of sensitive access. |

## 4. Current Features Found in the Codebase

| Feature name | What it does | User type served | Files/components/routes involved | Current status | Notes or limitations |
| --- | --- | --- | --- | --- | --- |
| Discover search and browse | Lets users browse, search, filter, view lists, and use map-based discovery for places and offerings. | Guests, seniors, caregivers, standard users | `client/src/pages/DiscoverPage.jsx`, `client/src/features/discover/*`, `server/src/routes/hardAssets.js`, `server/src/routes/softAssets.js`, `server/src/controllers/hardAssetsController.js`, `server/src/controllers/softAssetsController.js` | Working | Depends heavily on clean resource data, usable coordinates, visibility rules, and understandable category/tag naming. |
| Resource detail pages | Shows detail pages for places and offerings, including descriptive fields, map context, linked places/offerings, save actions, and access messaging. | Guests, standard users, caregivers, partners | `client/src/pages/ResourcePage.jsx`, `client/src/components/ResourceDetailContent.jsx`, `server/src/routes/hardAssets.js`, `server/src/routes/softAssets.js` | Working | Users still need to verify time, fees, eligibility, and provider details before relying on a resource. |
| Saved resources and My Directory | Lets signed-in users save resources, search saved items, remove saved items, and use saved resources as the starting point for maps. | Standard users, caregivers | `client/src/pages/MyDirectoryPage.jsx`, `client/src/contexts/SavedAssetsContext.jsx`, `client/src/hooks/useSavedAssets.js`, `server/src/routes/favorites.js`, `server/src/controllers/favoritesController.js`, `server/src/db/schema.js` (`user_favorites`) | Working | Guests cannot save. Saved snapshots help preserve context, but stale resource handling should remain visible and understandable. |
| My Maps | Lets users create curated maps/directories from saved resources, add descriptions, set distance context, print, export as image, and manage included resources. | Standard users, caregivers, staff using a user view | `client/src/pages/MyMapDetailPage.jsx`, `client/src/components/CreateMapModal.jsx`, `client/src/components/DirectoryMap.jsx`, `client/src/components/DirectoryPrintView.jsx`, `client/src/components/MapImageExportButton.jsx`, `server/src/routes/myMaps.js`, `server/src/controllers/myMapsController.js`, `server/src/db/schema.js` (`my_maps`, `my_map_assets`) | Working | My Maps are planning aids, not care plans or formal referrals. Sharing and printing should include privacy caution. |
| Shared maps | Creates read-only public map links that others can view, print, save from, or copy into their own account when allowed. | Caregivers, family members, guests, standard users | `client/src/pages/SharedMapPage.jsx`, `client/src/components/SharedMapDirectoryList.jsx`, `server/src/routes/sharedMaps.js`, `server/src/controllers/sharedMapsController.js`, `server/src/utils/shareTokens.js` | Working | Anyone with the link can view the shared map. Users need clear reminders before sharing sensitive planning context. |
| Authentication and sessions | Supports email/password login/register, Google sign-in, session cookies/header tokens, logout, and admin impersonation/user view. | Standard users, partners, admins | `client/src/pages/AuthPage.jsx`, `client/src/contexts/AuthContext.jsx`, `client/src/lib/sessionAuth.js`, `server/src/routes/auth.js`, `server/src/controllers/authController.js`, `server/src/utils/sessionAuth.js`, `server/src/middleware/auth.js` | Working | Production session signing requires configured signing material. User-view/impersonation should remain tightly permissioned and auditable. |
| WhatsApp/GudAuth phone login and signup | Starts a phone verification login, resumes attempts after return, signs in existing verified identities, and guides unknown verified phones into standard-user signup. | Standard users, seniors, caregivers | `client/src/components/PhoneLoginPanel.jsx`, `client/src/components/PhoneVerificationPanel.jsx`, `client/src/lib/phoneVerificationState.js`, `server/src/routes/auth.js`, `server/src/controllers/phoneLoginController.js`, `server/src/utils/phoneLogin.js`, `server/src/utils/gudAuthClient.js`, `server/src/db/schema.js` (`phone_login_attempts`, `user_phone_identities`) | Working or recently added in current branch history | Provider availability and production configuration need operational confirmation. Raw profile phone fields should not be trusted for login. |
| Phone identity verification and linking | Maintains separate active verified phone identities and supports current-user linking/unlinking attempts. | Standard users, admins reviewing identity model | `server/src/routes/phoneIdentities.js`, `server/src/controllers/phoneIdentitiesController.js`, `server/src/utils/phoneIdentity.js`, `server/src/utils/phoneIdentityLinking.js`, `server/src/utils/phoneIdentityAudit.js`, `server/test/phoneIdentitySchema.test.js` | Working | Good foundation for identity uniqueness. `Needs input`: legacy backfill and user-support process for disputed phone ownership. |
| Profile and eligibility fields | Captures optional profile fields such as postal code, birth date, CHAS card status, caregiver status, gender, property type, and volunteer interest. | Standard users, caregivers, partners/admins using access rules | `client/src/pages/dashboard/ProfilePage.jsx`, `client/src/lib/profileAttributes.js`, `server/src/controllers/userController.js`, `server/src/utils/profileAttributes.js`, `server/src/utils/eligibility.js`, `server/src/db/schema.js` (`users`) | Working | Sensitive optional data needs clear purpose, consent, retention, and minimisation rules before pilot scale. |
| Postal-code and service-area logic | Uses postal codes to assign service areas, partner boundaries, subregions, audience zones, and distance/search context. | Users, partners, regional admins, super admins | `server/src/utils/postalBoundaries.js`, `server/src/utils/subregionRouting.js`, `server/src/utils/partnerBoundaries.js`, `server/src/utils/audienceZones.js`, `server/src/routes/subregions.js`, `server/src/routes/partners.js`, `server/src/routes/audienceZones.js` | Working or partial depending on schema setup | Operational terms are complex. Public copy should say service area or target area rather than boundary/subregion where possible. |
| Membership links | Lets users link their account to a place via a QR/link flow, enabling member-related access recognition. | Standard users, AACs, partners | `client/src/pages/MembershipLinkPage.jsx`, `server/src/routes/memberships.js`, `server/src/controllers/membershipsController.js`, `server/src/utils/membershipTokens.js`, `server/src/utils/memberships.js`, `server/src/db/schema.js` (`user_asset_memberships`) | Working | Linking a membership is not the same as programme registration. Partner/member policy needs confirmation. |
| Partner/admin dashboard | Provides dashboard navigation and pages for overview, resources, profile, admin functions, resource management, and operational tools. | Partners, regional admins, super admins | `client/src/pages/dashboard/*`, `client/src/components/dashboard/DashboardNavigation.jsx`, `client/src/lib/roles.js`, `server/src/routes/users.js`, `server/src/routes/admin.js` | Working | Several admin files are large and should be refactored only in small verified slices. |
| Resource management | Lets authorised users create/edit/delete places, standalone offerings, template offerings, child offerings, images, tags, categories, locations, availability, visibility, and linked places. | Partners, regional admins, super admins | `client/src/pages/dashboard/ResourcesPage.jsx`, `client/src/components/AssetForm.jsx`, `client/src/components/SoftAssetTemplateForm.jsx`, `client/src/components/SoftAssetChildForm.jsx`, `server/src/routes/hardAssets.js`, `server/src/routes/softAssets.js`, `server/src/routes/softAssetParents.js` | Working | Complex content model. Human review is needed before public publishing, especially for imported or AI-assisted content. |
| Partner organisations and staff handover | Adds an organisation/staff bridge so real staff accounts can manage partner organisation resources without password sharing, including owner/editor roles and handover. | Partners, regional admins, super admins | `client/src/components/PartnerStaffPanel.jsx`, `server/src/routes/partnerOrganizations.js`, `server/src/controllers/partnerOrganizationsController.js`, `server/src/utils/partnerOrganizations.js`, `server/src/utils/partnerStaff.js`, `server/src/db/schema.js` (`partner_organizations`, `partner_staff_memberships`, `partner_staff_events`) | Partial or in active working tree | Current branch includes uncommitted files and tests. Some paths return setup-required messaging if bridge tables are not ready. |
| Audience zones and restricted offerings | Supports targeted postal-code zones and links them to offerings or templates for visibility/access rules. | Partners, regional admins, super admins, eligible users | `server/src/routes/audienceZones.js`, `server/src/controllers/audienceZonesController.js`, `server/src/utils/audienceZones.js`, `server/src/db/schema.js` (`audience_zones`, `soft_asset_audience_zones`, `soft_asset_parent_audience_zones`) | Working | Needs careful explanation so users understand why some resources appear or remain restricted. |
| Partner boundaries and subregions | Defines which partner/admin users can manage or view resources and users within allowed areas. | Partners, regional admins, super admins | `server/src/routes/partners.js`, `server/src/controllers/partnerBoundariesController.js`, `server/src/routes/subregions.js`, `server/src/controllers/subregionsController.js`, `server/src/utils/boundarySchema.js`, `server/src/db/schema.js` (`subregions`, `subregion_postal_codes`, `partner_postal_codes`) | Working or partial depending on schema setup | `Needs input`: final operational model for partner catchments and regional ownership. |
| Workbook import/export | Downloads templates, exports data, imports resources, validates rows, and produces import reports for operational maintenance. | Admins, partners, regional admins | `server/src/routes/admin.js`, `server/src/controllers/workbookController.js`, `server/src/utils/inputValidation.js`, `server/src/db/schema.js`, `client/src/pages/dashboard/AdminPage.jsx` | Working | Workbook handling has important validation limits. Exported files require careful data handling. |
| Google place import and AI data improvement | Searches Google place candidates by postal context, previews candidate details, imports places, and can augment drafts with additional grounded descriptions or logo suggestions. | Partners, admins | `client/src/components/HardAssetImportWizard.jsx`, `server/src/routes/hardAssets.js`, `server/src/utils/googlePlaceImport.js`, `server/src/utils/vertexGroundedPlaceSearch.js`, `server/src/utils/websiteMetadata.js` | Working/partial AI-assisted admin tool | This is AI-assisted import/data improvement, not AI social prescribing. Suggestions require staff review before saving. |
| AI collateral import for offerings | Uses uploaded programme material to propose structured offering drafts, matches, descriptions, tags, buckets, and possible updates for staff review. | Partners, admins | `client/src/components/SoftAssetCollateralImportWizard.jsx`, `server/src/controllers/softAssetCollateralImportController.js`, `server/src/utils/vertexCollateralImport.js`, `server/src/routes/softAssets.js` | Partial or working admin-assist feature | Must remain review-first. Source material may contain sensitive or outdated content, so upload rules and review workflow matter. |
| Translation and multilingual foundation | Provides locale switching, UI strings, resource translation persistence, translation review status, regenerate hooks, fallback behavior, and admin review panels. | Public users, partners, admins | `client/src/contexts/LocaleContext.jsx`, `client/src/lib/i18n.js`, `client/src/components/TranslationReviewPanel.jsx`, `server/src/routes/resourceTranslations.js`, `server/src/controllers/resourceTranslationsController.js`, `server/src/utils/resourceTranslations.js`, `server/src/db/schema.js` (`resource_translations`) | Working foundation | English remains canonical. Mandarin, Malay, and Tamil resource content requires review. Legal/admin content may remain English until reviewed. |
| Partner-only notes and files | Lets authorised staff add private notes, access grants, and files to resource detail content outside public snapshots. | Partners, admins | `client/src/components/PrivateResourceContentEditor.jsx`, `client/src/components/PartnerPrivatePanel.jsx`, `client/src/components/PrivateFileViewer.jsx`, `server/src/routes/privateResourceContent.js`, `server/src/controllers/privateResourceContentController.js`, `server/src/utils/privateResourceContent.js`, `server/src/db/schema.js` (`private_resource_contents`, `private_resource_content_access`, `private_resource_content_files`) | Working | Should not store unnecessary personal data, confidential case notes, or unapproved partner-confidential material. |
| Public guide and guide foundation | Provides a public/standard-user guide draft and a broader guide foundation for future partner/admin/training content. | Public users, caregivers, partners, admins | `docs/user-guide.md`, `docs/user-guide-foundation.md`, `docs/layman-language-review.md`, `docs/images/user-guide/*` | Partial documentation | Public guide exists first. Partner/admin guide and screenshot checklist are intentionally later work. Some local image rendering may depend on absolute path support in the viewer. |
| Security and privacy hardening | Adds security headers, CORS constraints, JSON/body guards, rate limits, validation, privacy/terms pages, and access-control tests. | All users, operators, partners | `server/src/app.js`, `server/src/middleware/security.js`, `server/src/utils/inputValidation.js`, `client/src/pages/LegalPage.jsx`, `server/test/accessControlPrivacy.test.js`, `docs/regression-ledger.md` | Working foundation | Not a formal security certification. Dependency advisories and audit-log depth remain technical/governance follow-ups. |
| Client route recovery | Adds route-level error handling for failed lazy chunks and stale app tabs. | All browser users | `client/src/App.jsx`, `docs/regression-ledger.md` | Working | Helps avoid blank screens during app updates, but does not replace release smoke testing. |
| Public map cache | Provides a public map-cache API family backed by Worker/KV binding where configured. | Public users, performance-sensitive map views | `server/src/routes/public.js`, `server/src/utils/cacheBuilder.js`, `server/wrangler.toml` | Partial or deployment-dependent | `Needs input`: cache refresh process, cache contents, and production operating rules. |

## 5. Planned Features

### AI social prescribing / AI-assisted community support matching

Purpose: help seniors, caregivers, or staff identify relevant community support options based on location, profile context, stated needs, eligibility, availability, and partner rules.

Expected users: seniors, caregivers, AAC staff, partner staff, and possibly administrators reviewing match quality.

Required data:

- Resource listings with clean categories, tags, descriptions, service areas, eligibility rules, schedules, and availability.
- User consent and explicit user-provided needs.
- Optional profile fields, with clear minimisation and purpose limits.
- Partner and audience-zone access rules.
- Human review records for AI-suggested matches.

Potential risks:

- Overstating suitability or implying clinical advice.
- Recommending unavailable, outdated, paid, or restricted services without context.
- Bias toward partners with better data rather than better fit.
- Conflict-of-interest concerns if sponsored or partner-funded resources are surfaced unfairly.
- Privacy risk if sensitive profile details are overused.

Human review needed:

- Staff review before using AI output in partner-assisted workflows.
- Clear user-facing explanation that suggestions are planning aids, not medical or official recommendations.
- Review and override path for unsuitable matches.

Suggested MVP version:

- Start rule-based: postal code, distance, saved preferences, service type, tags, eligibility fields, member-only status, and visibility rules.
- Show transparent "why this appears" explanations.
- Let staff review suggested shortlists before sharing them with users.

Suggested future version:

- Add AI-assisted explanations and ranking after rule-based matching is reliable.
- Use AI to summarise differences between options, flag missing data, and draft staff-reviewed shortlist notes.
- Keep audit logs and human approval for partner-facing recommendations.

Current code support: partial. The repository contains AI-assisted import/data-improvement and translation foundations, but not a full AI social prescribing engine.

### AI analytics

Purpose: help partners and funders understand resource coverage, data quality, service navigation patterns, and pilot impact without exposing unnecessary personal data.

Expected users: administrators, partner leadership, funders, pilot evaluators.

Required data:

- Aggregated usage events, resource engagement events, save/share/map activity, search patterns, content freshness, import/review status, and partner coverage.
- Explicit consent and privacy rules for any analytics involving user behavior.
- Clear separation between operational data and individual case data.

Potential risks:

- Re-identification in small geographic or partner cohorts.
- Misreading app engagement as service impact.
- Partner trust concerns if reports compare organisations without agreed context.
- Over-collection before a pilot question is defined.

Human review needed:

- Review metric definitions before sharing with partners or funders.
- Review small-count suppression and cohort thresholds.
- Review sponsor/funder reporting language.

Suggested MVP version:

- Non-AI aggregate dashboards or exports first: listing freshness, coverage, resource counts, saved-resource counts, shared-map counts, translation review status, and import queue quality.
- Use manual analysis for pilot reporting.

Suggested future version:

- AI-assisted summaries of trends, data gaps, and operational follow-up suggestions.
- Human-approved partner/funder narrative summaries.

Current code support: unclear/partial. The dashboard has operational counts and exports, but the repository does not show a dedicated analytics event schema or AI analytics dashboard.

### User alerts and notifications

Purpose: notify users or staff about relevant changes, reminders, saved-resource updates, map share status, membership-link actions, or review tasks.

Expected users: standard users, caregivers, partner staff, admins.

Required data:

- Notification preferences, channels, consent, quiet hours, language preference, and opt-out records.
- Resource change events and saved-resource relationships.
- Review-task state for translations/imports/private content.
- Clear distinction between informational reminders and clinical/medical reminders.

Potential risks:

- Sending sensitive information through insecure channels.
- Creating a false sense of clinical follow-up or urgent care monitoring.
- Notification fatigue.
- Triggering messages from stale or unreviewed data.

Human review needed:

- Review notification categories before launch.
- Review all templates for privacy, accessibility, and clinical-safety wording.
- Review high-risk alerts manually before sending.

Suggested MVP version:

- In-app alerts only: resource changed, saved resource hidden, translation needs review, import needs review, partner staff setup issue.
- Email/SMS/WhatsApp left out until consent, provider, and audit requirements are defined.

Suggested future version:

- Opt-in channel notifications for non-sensitive reminders.
- Partner-facing task queues and digest emails.
- AI-assisted alert prioritisation only after rules and opt-outs are stable.

Current code support: limited. The repository contains browser `alert()` calls and status messages, but no dedicated notification table, job runner, or external notification service.

## 6. User Journey

### Senior/caregiver finding support

1. Opens Discover as a guest or signed-in user.
2. Searches by resource name, service/programme type, tag, address, or postal code.
3. Uses location, service area, saved-only, or type filters to narrow the list.
4. Opens a resource detail page to check description, address, schedule, contact, eligibility, and linked places.
5. Signs in or registers to save useful resources.
6. Uses My Directory to review saved resources.
7. Creates a My Map for a household, family discussion, or care-planning scenario.
8. Prints, exports, or shares a read-only map link if appropriate.
9. Checks details with the provider before visiting, registering, or relying on the resource.

### AAC/community partner using the platform

1. Signs in through partner/admin access.
2. Opens the dashboard and navigates to resources, profile, or admin areas depending on role.
3. Creates or edits places and offerings.
4. Uses images, tags, categories, schedules, eligibility rules, availability, and visibility settings.
5. Reviews restricted/member-only settings and partner-only notes/files.
6. Uses import tools for Google place candidates, workbooks, or programme material where appropriate.
7. Reviews translations and AI/import suggestions before making content public.
8. Manages staff access or handover where the partner organisation bridge is enabled.

### Admin maintaining service listings

1. Signs in as regional admin or super admin.
2. Manages users, roles, managers, subregions, partner boundaries, audience zones, and categories.
3. Imports or exports workbook data for places and offerings.
4. Reviews import reports and validation errors.
5. Checks visibility/access rules and translation review state.
6. Uses the regression ledger and release checklist before changing locked behavior or deploying.

### Partner viewing analytics

1. `Planned`: partner opens an analytics or reporting view.
2. Reviews aggregate resource coverage, data freshness, translation readiness, saved-resource engagement, and map/share activity.
3. Uses small-count suppression and privacy thresholds.
4. Receives human-reviewed summaries for pilot or funder reporting.

Current status: no dedicated analytics data model or dashboard is evident. Operational counts and exports can support manual reporting, but analytics should be built as a separate governed feature.

### User receiving alerts or reminders

1. `Planned`: user opts in to notification categories and channels.
2. Saves resources or maps.
3. Receives in-app alerts when saved resources change, maps are shared/unshared, or profile/location details may improve relevance.
4. Receives external notifications only after consent, channel security, and audit requirements are defined.

Current status: no dedicated notification entity or notification service is evident in the repository.

## 7. Data Model and Information Architecture

Main entities/tables/collections inferred from `server/src/db/schema.js`:

| Area | Entities | What they represent |
| --- | --- | --- |
| Users and roles | `users`, role enum | Accounts, roles, profile fields, managers, optional eligibility/profile context. |
| Service areas | `subregions`, `subregion_postal_codes`, `user_subregions`, `partner_postal_codes` | Service area definitions, postal-code routing, user/partner area assignments. |
| Partner organisations | `partner_organizations`, `partner_staff_memberships`, `partner_staff_events` | Organisation bridge, staff roles, owner handover, and staff events. |
| Places | `hard_assets` | Physical locations with address, coordinates, media, source identifiers, visibility, and partner ownership fields. |
| Offerings | `soft_assets`, `soft_asset_parents`, `soft_asset_locations` | Standalone offerings, reusable templates, child/local offerings, linked places, availability, eligibility, and visibility. |
| Tags/categories | `tags`, `sub_categories`, `hard_asset_tags`, `soft_asset_tags` | Resource classification and filtering. |
| Target areas | `audience_zones`, `audience_zone_postal_codes`, `soft_asset_audience_zones`, `soft_asset_parent_audience_zones` | Postal-code audience targeting and restricted offering visibility/access. |
| Saved planning | `user_favorites`, `my_maps`, `my_map_assets` | Saved resources, personal maps, shared map tokens, and map assets with snapshots. |
| Memberships | `user_asset_memberships` | User links to places, including join method and status. |
| Phone identity | `user_phone_identities`, `phone_verification_attempts`, `phone_login_attempts` | Verified phone identities, link attempts, and login/signup attempts. |
| Private partner content | `private_resource_contents`, `private_resource_content_access`, `private_resource_content_files` | Partner-only notes, access grants, and attached files. |
| Translations | `resource_translations` | Per-resource locale fields, metadata, review status, and updater. |

User data captured:

- Account fields: username, email, password hash, display name, role, manager relationship.
- Optional profile fields: phone, postal code, birth date, CHAS card flag/status, caregiver status, gender, property type, volunteer interest.
- Saved-resource and My Map activity through saved items and map assets.
- Membership links to places.
- Phone identity verification state and login attempt state.

Service/resource listing data captured:

- Places: names, categories, address, country, postal code, coordinates, phone/contact-style fields, hours, website, descriptions, media, source identifiers, hidden/deleted status, partner/creator/subregion fields.
- Offerings: names, buckets, categories, descriptions, schedules, linked places, contact fields, action links, availability, eligibility rules, audience mode, member-only flag, override fields, media, hidden/deleted status, partner/creator/subregion fields.
- Translation rows for resource-specific multilingual content.
- Partner-only notes and files separate from public resource snapshots.

Referral or recommendation data:

- No dedicated referral, recommendation, match, shortlist recommendation, or outcome table is evident.
- Saved resources and My Maps can approximate user interest or planning intent, but they should not be treated as formal referrals.
- `Needs input`: define whether CareAround SG will support referrals, warm handoffs, partner follow-up, or only discovery/planning.

Alert/notification data:

- No dedicated alerts, notification preferences, notification logs, delivery attempts, or message-template tables are evident.
- Existing UI status messages and browser alerts are not a notification system.

Analytics data:

- No dedicated analytics event table is evident.
- Operational data exists for manual analysis: resources, saves, maps, shares, workbooks, translations, memberships, and staff events.
- `Needs input`: analytics purpose, consent model, reporting granularity, retention, de-identification, and small-count suppression.

Missing fields needed for a serious pilot:

- Consent records and consent versioning.
- Notification preferences and opt-out records.
- Audit logs for exports, sensitive views, partner-only file access, impersonation/user view, recommendations, and alerts.
- Resource freshness fields such as reviewed date, source type, last verified by, and verification confidence.
- Provider contact verification status without exposing private lists of personal contacts.
- Referral or recommendation state if the pilot includes matching or handoff.
- Outcome fields for pilot evaluation that avoid collecting unnecessary case details.
- Data-sharing agreement references for partner organisations.
- Analytics aggregation thresholds and reporting scopes.
- AI recommendation review records, reviewer identity, reviewer decision, and explanation shown to user.
- Data retention and deletion metadata for uploaded files and private content.

## 8. Technical Architecture

Frontend framework:

- React with Vite and TypeScript build support.
- Tailwind CSS, Radix UI primitives, React Router, Leaflet/react-leaflet, clustering, QR code generation, html-to-image export, and related UI libraries.
- Main routes are defined in `client/src/App.jsx`, with lazy loading for dashboard, resource, directory, map, shared map, membership, and legal pages.

Backend framework:

- Hono application served as a Cloudflare Worker and also runnable locally through a Node server.
- API routes are mounted under `/api/*` in `server/src/app.js`.
- Security middleware adds headers, CORS handling, body guards, and route-specific rate limits.

Database/storage:

- Drizzle ORM with Postgres-style schema in `server/src/db/schema.js`.
- Server package uses Neon serverless Postgres client.
- File attachments for partner-only content appear stored in database text fields in the current schema.
- Cloudflare KV is referenced for public map cache where configured.

Authentication:

- Email/password login/register.
- Google sign-in support.
- Session token carried by HTTP-only cookie and optional session header.
- Role-based authorization for partner, regional admin, and super admin functions.
- User-view/impersonation route for authorised admin workflows.
- Phone login/signup and phone identity linking using GudAuth/WhatsApp verification flows.

API route families:

- `/api/auth`
- `/api/hard-assets`
- `/api/soft-assets`
- `/api/soft-asset-parents`
- `/api/tags`
- `/api/sub-categories`
- `/api/upload`
- `/api/users`
- `/api/favorites`
- `/api/my-maps`
- `/api/shared-maps`
- `/api/admin`
- `/api/public`
- `/api/subregions`
- `/api/partners`
- `/api/partner-organizations`
- `/api/audience-zones`
- `/api/memberships`
- `/api/private-resource-content`
- `/api/resource-translations`
- `/api/phone-identities`
- `/api/health`

AI-related code:

- Google place import and AI-assisted place data improvement: `server/src/utils/googlePlaceImport.js`, `server/src/utils/vertexGroundedPlaceSearch.js`, `client/src/components/HardAssetImportWizard.jsx`, `client/src/components/AssetForm.jsx`.
- AI-assisted offering/collateral import: `server/src/utils/vertexCollateralImport.js`, `server/src/controllers/softAssetCollateralImportController.js`, `client/src/components/SoftAssetCollateralImportWizard.jsx`.
- Translation hooks and review workflow: `server/src/utils/resourceTranslations.js`, `server/src/controllers/resourceTranslationsController.js`, `client/src/components/TranslationReviewPanel.jsx`.
- No code-proven AI social prescribing, AI analytics, or AI alerting engine is evident.

Notification-related code:

- No dedicated notification service, notification queue, notification preferences, or notification log is evident.
- Existing browser alerts/status messages are UI feedback, not a notification architecture.

Analytics-related code:

- No dedicated analytics event schema or analytics dashboard is evident.
- Admin dashboard, workbook exports, translation states, membership links, saved resources, maps, and staff events can provide starting data for manual pilot reporting.

Deployment assumptions from repo files:

- Frontend is configured for Cloudflare Pages.
- Backend is configured for Cloudflare Workers.
- API custom domain and allowed origins are configured in Worker configuration.
- Vite local development proxies `/api` to a local Worker/server.
- `Needs input`: production deployment owner, environment separation, monitoring, backups, incident process, and final launch checklist status.

Major technical gaps:

- Dedicated audit-log coverage for sensitive operational actions.
- Dedicated notification and preference model.
- Dedicated analytics event and reporting model.
- Referral/recommendation model if social prescribing moves beyond discovery.
- Full partner organisation schema migration/setup assurance.
- Formal AI review/audit records for recommendations, not just import data-improvement tools.
- File storage strategy and retention rules for partner-only files.
- Dedicated governance configuration for sponsors/funders, conflict-of-interest controls, and paid placement restrictions.
- Resolution of known dependency/security follow-ups as a dedicated technical project.

## 9. AI Readiness Assessment

| AI capability | Readiness | What data is available | What is missing | Guardrails needed | Rule-based first recommendation |
| --- | --- | --- | --- | --- | --- |
| AI service matching | Partial/planned | Resource data, categories, tags, postal codes, service areas, profile fields, eligibility rules, saved resources, maps | Consent, recommendation records, user-stated needs model, outcome model, human-review state, conflict rules | No medical advice, no diagnosis, explain why shown, human review for staff-assisted matches, sponsor/COI controls | Start with deterministic filters and explainable ranking by location, category, eligibility, member status, and visibility. |
| AI explanation generation | Partial | Resource descriptions, linked places, categories, tags, translation infrastructure | Review records, approved explanation templates, stale-data warnings | Label AI assistance, preserve canonical English, require staff review before publishing sensitive explanations | Use templated "why this appears" text first. |
| AI analytics | Planned/unclear | Operational tables for resources, saves, maps, shares, translations, memberships, staff events | Analytics event schema, consent, aggregation rules, suppression thresholds, reporting purpose | De-identification, small-count suppression, partner reporting agreements, human-approved summaries | Start with manual aggregate reports and non-AI dashboards. |
| AI alerts | Planned | Resource change data, saved-resource relationships, review-task state | Notification preferences, channels, alert logs, templates, opt-out, delivery provider | Consent, opt-out, no urgent/clinical alerting, safe channel rules, template review | Start with in-app rule-based alerts for low-risk operational events. |
| Human-in-the-loop review | Partial/strong foundation | Admin dashboards, import preview/commit, translation review, partner-only edit surfaces | Dedicated review logs for recommendations and alerts | Reviewer identity, timestamp, decision, rationale, versioned output | Require human approval for AI-generated public or user-facing support suggestions. |

Overall assessment: CareAround SG is ready to use AI as an admin-assist layer for data preparation and draft improvement, with review. It is not yet ready for autonomous AI social prescribing, AI analytics narratives, or AI-triggered external alerts. Rule-based matching, transparent explanations, consent capture, audit logs, and human review should come first.

## 10. Safety, Privacy, and Governance Notes

Consent:

- Ask only for data that has a clear use.
- Explain why profile and eligibility fields are optional and how they affect restricted offerings or relevance.
- Add consent records before analytics, alerts, external messaging, or AI matching pilots.

Data minimisation:

- Do not collect senior case notes, national identification details, private lists of personal contacts, or unnecessary medical details.
- Keep partner-only notes/files focused on authorised operational content.
- Use aggregated pilot metrics where possible.

Avoiding medical advice:

- Position recommendations as planning support, not clinical advice.
- Avoid diagnosis, triage, risk scoring, or treatment advice.
- Include provider-verification reminders on resource and shared-map workflows.

Avoiding diagnosis or clinical decision-making:

- Do not infer conditions or care needs from profile fields.
- Use user-stated needs and transparent filters rather than hidden clinical inference.
- Escalate high-risk situations outside the app workflow to proper human channels.

Human review:

- Keep AI import/data-improvement tools as review-first.
- Require human review before AI-generated recommendations or partner/funder-facing AI summaries are shared.
- Record who approved AI-assisted content when pilot scope requires it.

Audit logs:

- Current schema includes partner staff events, but broader audit coverage is needed.
- Add logs for exports, private file access, user-view/impersonation, membership link actions, recommendation review, and alert delivery.

Conflict-of-interest sensitivity:

- Do not rank resources by sponsor payment in user-facing flows unless explicitly disclosed and governed.
- Separate sponsor/funder reporting from individual navigation.
- Maintain fair visibility rules for partner and non-partner resources.

Partner trust:

- Make ownership, staff access, access grants, and handover behavior clear.
- Keep partner-confidential content outside public snapshots.
- Provide clear review and correction workflows for imported or AI-assisted resource data.

Redaction of sensitive information:

- Do not include real phone numbers, personal addresses, senior case details, private partner contact rosters, credential material, or raw environment values in pitch or pilot docs.
- Screenshot and deck materials should use public/demo-safe data or carefully redacted screens.

## 11. Pilot Proposal Draft

Pilot name: CareAround SG Community Resource Navigation Pilot.

Target area: `Needs input`. A practical MVP would use one defined service area or one partner cluster first.

Target partners: `Needs input`. Candidate categories may include AACs, community service partners, social service teams, and trusted resource maintainers, but specific partners must be confirmed by the product owner.

Target users: `Assumption`: seniors, caregivers, family members, and partner staff supporting navigation or resource maintenance.

Pilot duration: `Assumption`: 8 to 12 weeks is a practical initial window for a focused community-resource navigation pilot.

MVP scope:

- Public/standard-user discovery and resource details.
- Save resources and use My Directory.
- Create, print, export, and share My Maps.
- Partner/admin maintenance of places and offerings.
- Workbook import/export for controlled data updates.
- Translation review for selected public-facing resources.
- Partner-only notes/files only if participating partners agree on rules.
- AI-assisted import/data-improvement only as staff-reviewed internal tooling.
- Rule-based matching shortlist only if governance and consent are ready.

Success metrics:

- Users can find relevant resources with fewer manual steps.
- Users save resources and create maps for planning.
- Partner/admin staff can update resource listings without engineering support.
- Resource data freshness improves during the pilot.
- Translation review coverage improves for selected resources.
- Staff report lower friction in preparing or sharing resource options.
- No sensitive-data leakage through public snapshots, shared maps, or exports.

What data will be collected:

- Account/profile data needed for login and optional relevance.
- Saved resources and My Maps created by users.
- Resource listing edits and translation review status.
- Aggregated pilot activity metrics if consent and privacy rules are defined.
- Partner staff access events where applicable.

What data will not be collected:

- National identification details.
- Senior case files.
- Clinical diagnosis details.
- Private contact lists.
- Unnecessary personal addresses.
- Confidential partner information outside agreed operational content.
- Emergency or medical triage records.

Risks and mitigations:

| Risk | Mitigation |
| --- | --- |
| Users treat resource suggestions as official advice | Use clear disclaimers, provider-check prompts, and no endorsement claims. |
| Resource data is stale | Add review dates, owner assignments, and staff review workflow. |
| Sensitive context leaks through shared maps | Add share warnings and avoid private fields in public snapshots. |
| Partner staff access is misconfigured | Use role-based access, owner handover controls, tests, and audit logs. |
| AI suggestions are inaccurate | Keep AI as draft support only, require human review, and preserve source metadata where available. |
| Conflict-of-interest concerns | Define sponsor/partner visibility policy and disclose funding relationships where required. |
| Pilot metrics over-collect personal data | Use aggregate metrics, consent, retention limits, and small-count suppression. |

Partner responsibilities:

- Confirm resources, descriptions, locations, schedules, and eligibility details.
- Assign authorised staff and maintain access hygiene.
- Review translations and AI/import suggestions before publishing.
- Follow data-handling rules for exports, private notes, and uploaded files.
- Provide feedback on pilot workflows and resource-data quality.

CareAround SG responsibilities:

- Provide the platform, documentation, onboarding, and support workflow.
- Maintain role-based access, security controls, and release gates.
- Keep seniors/caregivers free to use the public planning features.
- Produce aggregate pilot learnings without exposing personal data.
- Escalate governance, privacy, or AI concerns before expanding scope.

## 12. Impact Metrics

Senior/caregiver outcomes:

- Number of users who save at least one resource.
- Number of maps created, printed, exported, or shared.
- Self-reported ease of finding relevant support.
- Time saved preparing a shortlist.
- Percentage of saved/shared resources with clear address, schedule, and eligibility details.

AAC/partner outcomes:

- Number of partner staff onboarded.
- Number of listings reviewed or updated by partners.
- Data freshness improvement for pilot resources.
- Translation review completion for selected resources.
- Staff satisfaction with resource maintenance and sharing workflows.

Service navigation outcomes:

- Search-to-detail conversion.
- Detail-to-save conversion.
- Saved-resource-to-map conversion.
- Shared-map views or copies.
- Number of resources with usable coordinates and clear service-area rules.

Data/analytics outcomes:

- Resource coverage by service area and category.
- Missing field rate for critical listing fields.
- Translation missing/needs-review rate.
- Import validation error rate.
- Private/public content separation checks.

Sustainability outcomes:

- Partner willingness to maintain listings.
- Funder willingness to support free senior/caregiver access.
- Estimated operational support load.
- Cost of data quality, hosting, AI usage, and onboarding.
- Repeatable pilot-to-expansion process.

## 13. Funding and Sustainability Notes

Why seniors/caregivers should remain free users:

- Charging public users would reduce access for the people the product is meant to help.
- Public benefit and trust are stronger when resource discovery, saving, and map creation stay free.
- Free user access is more consistent with community-care navigation and grant-funded impact.

What partners/funders may pay for:

- Partner dashboard access and staff onboarding.
- Resource-maintenance workflows.
- Translation review support.
- Aggregate reporting and pilot evaluation.
- Sponsored community-care navigation pilots.
- Data-quality improvement projects.
- Human-reviewed AI assistant features for staff, once governance is ready.

What could be grant-funded:

- Pilot operations and evaluation.
- Accessibility and multilingual improvements.
- Data quality and resource verification.
- Partner onboarding and training.
- Consent, audit, privacy, and governance foundations.
- Rule-based matching MVP and human-review workflows.

What could be sponsored:

- Free public access for seniors and caregivers.
- Community-resource campaigns or service-area coverage projects.
- Translation and accessibility work.
- Training materials and printed guides.

What should not be monetised too early:

- User access to essential discovery and planning features.
- Ranking placement for sensitive community-care resources.
- Individual user data or care-planning context.
- AI recommendations before governance, consent, and conflict rules are mature.
- Partner-private content or exported user lists.

## 14. Pitch Narrative

### 30-second pitch

CareAround SG helps seniors, caregivers, and community partners find and organise senior-related support in Singapore. It is already more than an idea: the current product includes discovery, resource detail pages, saved resources, personal maps, shared maps, partner/admin resource management, imports, translations, and privacy-aware access controls. The next step is a focused pilot that proves CareAround SG can reduce service-navigation friction while keeping users, partners, and data safe.

### 2-minute pitch

Finding senior-related support is often not a single search. Families need to compare nearby places, check programme details, understand eligibility, save useful options, and share those options with someone else. Partners and AAC staff also need a practical way to keep listings current without turning every update into a manual spreadsheet exercise.

CareAround SG addresses this by combining a public discovery experience with a partner/admin maintenance layer. Users can browse places and programmes, save resources, build My Maps, print or export them, and share view-only map links. Partners and administrators can manage resources, service areas, audience zones, memberships, imports, translations, and partner-only notes/files.

The codebase shows a working pre-pilot product with stable core surfaces and a roadmap toward safer AI-assisted support matching. AI should not be introduced as a black-box referral engine. The safer path is rule-based matching first, human review, clear explanations, audit logs, consent, and only then AI assistance for summaries, data quality, and support-matching explanations.

CareAround SG is well suited for a Singapore community-care pilot because it is practical, map-led, multilingual in foundation, and designed around seniors, caregivers, AACs, partners, and administrators.

### Partner-facing pitch

CareAround SG gives partner teams a structured way to maintain and share community-resource information. Partners can manage places and offerings, review imported drafts, organise member-only or restricted access, add partner-only notes/files, and prepare resource maps that are useful for caregivers and families. The platform is designed to protect public/private boundaries, keep AI suggestions review-first, and support staff access without password sharing.

### Funder-facing pitch

CareAround SG is a concrete product foundation for improving senior and caregiver access to community support. A funder can support a pilot that keeps seniors and caregivers free while improving resource navigation, data quality, multilingual accessibility, partner workflows, and impact measurement. The funding case is strongest when it supports public access, partner onboarding, evaluation, and privacy/governance foundations rather than early monetisation of users or sensitive data.

### Careful AIC disclosure-friendly description

CareAround SG is an independently developed community-care navigation and planning tool for Singapore senior-related resources. It is intended to complement community and partner workflows by helping users discover, save, organise, and share resource information. `Needs input`: any relationship with AIC, if any, must be disclosed accurately. Do not state or imply that AIC endorses, sponsors, approves, or operates CareAround SG unless formal written approval exists.

## 15. Roadmap

### 30-day roadmap

- Review this dossier with the product owner and advisor.
- Confirm pilot scope, partner assumptions, and conflict-of-interest disclosures.
- Lock documentation set: public guide, partner/admin guide outline, screenshot checklist, pitch inputs, pilot plan, AI feature spec, risk register, and roadmap.
- Verify current branch work for partner organisation/staff handover and schema setup.
- Add or confirm sensitive-action audit-log requirements.
- Identify demo-safe data and screenshot-ready screens.
- Resolve user-guide image rendering issue in the document viewer or adjust guide references.

### 90-day roadmap

- Run a small controlled pilot with one service area or partner cluster.
- Add resource freshness and review-date fields if not already handled operationally.
- Add consent and notification-preference foundations if alerts are in scope.
- Create pilot reporting exports or dashboards using aggregate metrics.
- Harden partner staff access, owner handover, and private content governance.
- Improve user-facing wording for resource, service area, and restricted offering concepts.
- Prepare rule-based matching MVP design, with human review and transparent explanations.

### 6-month roadmap

- Expand partner onboarding and resource coverage.
- Add dedicated analytics event model with privacy thresholds.
- Add in-app alerts for low-risk saved-resource and staff-review events.
- Implement human-reviewed recommendation/shortlist workflow if pilot approves.
- Add stronger audit logs for exports, private files, user view, and recommendation review.
- Add data retention and file-storage policy implementation.
- Improve translation review coverage and multilingual public flows.

### 12-month roadmap

- Move from pilot to repeatable deployment model across multiple partner/service areas.
- Add AI-assisted support-matching explanations after rule-based matching is proven.
- Add AI-assisted aggregate insight summaries for partners/funders with human approval.
- Mature governance: COI policy, sponsor policy, data-sharing templates, audit reports, incident response.
- Evaluate sustainability model that keeps public users free.
- Build a partner/funder reporting package from validated pilot metrics.

## 16. Open Questions

Before creating a pitch deck:

- What is the strongest single user story: senior self-navigation, caregiver planning, or AAC staff support?
- Which screenshots are safe and compelling enough for the first deck?
- What should be the clearest product category: resource navigation, community-care planning, partner directory, or AI-assisted support matching?

Before creating a grant proposal:

- Which grant/funder category is being targeted?
- What budget is needed for pilot operations, engineering, AI usage, hosting, data quality, and evaluation?
- What outcomes will be measured without collecting unnecessary personal data?

Before creating a pilot plan:

- Which service area or partner cluster is first?
- Which staff roles participate?
- What data can be used, who reviews it, and who owns updates?
- What is explicitly out of scope for the pilot?

Before creating an AI roadmap:

- What matching use cases are safe enough for rule-based MVP?
- What decisions must always stay human-reviewed?
- What data can AI access, and what must remain excluded?
- What explanation must users see for each suggestion?

Before creating conflict-of-interest disclosure:

- What current or future relationships with AIC, AACs, partners, vendors, funders, or sponsors exist?
- Are any resources partner-funded or sponsor-funded?
- Will any partner receive preferential visibility?
- Who approves disclosure language?

Before creating a sustainability model:

- Which features should remain free forever?
- Which partner/funder features create legitimate value without harming trust?
- What operating costs must be covered?
- What should be deferred until after governance and pilot validation?

## 17. Appendix

### File map of important code files

Frontend:

- `client/src/App.jsx` - route structure, protected routes, route recovery.
- `client/src/pages/DiscoverPage.jsx` - public discovery page.
- `client/src/features/discover/*` - discovery map, filter panel, result list, mobile cards, location behavior.
- `client/src/pages/ResourcePage.jsx` and `client/src/components/ResourceDetailContent.jsx` - resource detail experience.
- `client/src/pages/MyDirectoryPage.jsx` - saved resources and My Maps hub.
- `client/src/pages/MyMapDetailPage.jsx` - private map/detail workspace.
- `client/src/pages/SharedMapPage.jsx` - public shared map view.
- `client/src/pages/AuthPage.jsx` - email/password, Google, phone-login UI.
- `client/src/pages/MembershipLinkPage.jsx` - membership link redemption flow.
- `client/src/pages/dashboard/*` - dashboard overview, resources, profile, admin.
- `client/src/components/AssetForm.jsx` - place/offering editing and AI data-improvement entry point.
- `client/src/components/HardAssetImportWizard.jsx` - Google place import and AI review.
- `client/src/components/SoftAssetCollateralImportWizard.jsx` - offering/collateral import review.
- `client/src/components/TranslationReviewPanel.jsx` - translation review workflow.
- `client/src/components/PrivateResourceContentEditor.jsx` - partner-only notes/files editor.
- `client/src/components/PartnerStaffPanel.jsx` - partner organisation staff access and handover.
- `client/src/contexts/AuthContext.jsx`, `LocaleContext.jsx`, `SavedAssetsContext.jsx`, `A11yContext.jsx` - app state foundations.
- `client/src/lib/api.js` - frontend API client.
- `client/src/lib/roles.js` - frontend role/access helpers.
- `client/src/lib/i18n.js` - multilingual UI string foundation.

Backend:

- `server/src/app.js` - Hono app, middleware, route mounting, rate limits.
- `server/src/db/schema.js` - database schema and relations.
- `server/src/routes/*.js` - API route families.
- `server/src/controllers/*Controller.js` - feature controllers.
- `server/src/middleware/auth.js` - authentication and authorization.
- `server/src/middleware/security.js` - security headers, body guard, and rate limits.
- `server/src/utils/sessionAuth.js` - session token and cookie behavior.
- `server/src/utils/phoneLogin.js`, `phoneIdentity.js`, `phoneIdentityLinking.js`, `gudAuthClient.js` - phone identity/login foundations.
- `server/src/utils/googlePlaceImport.js`, `vertexGroundedPlaceSearch.js`, `vertexCollateralImport.js`, `websiteMetadata.js` - AI/import data-improvement support.
- `server/src/utils/resourceTranslations.js` - translation generation/review support.
- `server/src/utils/audienceZones.js`, `partnerBoundaries.js`, `postalBoundaries.js`, `subregionRouting.js`, `boundarySchema.js` - area and visibility logic.
- `server/src/utils/membershipTokens.js`, `memberships.js` - membership-link support.
- `server/src/utils/privateResourceContent.js` - partner-only content support.
- `server/src/utils/partnerOrganizations.js`, `partnerStaff.js` - partner staff access support.
- `server/test/*` - server regression and focused feature tests.

Docs and planning:

- `README.md` - product map, useful but potentially stale versus current code.
- `docs/user-guide.md` - public/standard-user guide draft.
- `docs/user-guide-foundation.md` - broader user guide/training foundation.
- `docs/layman-language-review.md` - wording and terminology review.
- `docs/regression-ledger.md` - locked stabilization surfaces and known-good behavior.
- `docs/release-checklist.md` - pre-ship verification checklist.

Package and deployment evidence:

- `package.json` - workspace scripts and release/test commands.
- `client/package.json` - frontend dependencies.
- `server/package.json` - backend dependencies.
- `client/wrangler.toml` - Cloudflare Pages configuration.
- `server/wrangler.toml` - Cloudflare Worker configuration and KV binding reference.

### Key assumptions

- `Assumption`: the current working tree reflects the intended near-current product direction, including uncommitted partner organisation/staff and phone-login work.
- `Assumption`: CareAround SG is intended to remain free for seniors, caregivers, guests, and standard users.
- `Assumption`: initial pilot scope should be narrow, likely one service area or partner cluster.
- `Assumption`: AI should be introduced as review-first assistance, not autonomous matching.
- `Assumption`: public guide/docs are being developed alongside product stabilization and may lag behind current code.

### Known limitations

- README may be partially stale relative to current working tree.
- Partner organisation/staff handover appears active in the working tree and may depend on schema setup.
- No dedicated analytics schema is evident.
- No dedicated notification schema or external notification service is evident.
- No dedicated recommendation/referral schema is evident.
- Current AI support is import/data-improvement-oriented, not full social prescribing.
- Governance, consent, audit, sponsor/COI, and pilot operating rules need product-owner input.
- Production readiness cannot be fully inferred from code without deployment, environment, support, and monitoring review.

### Suggested next documentation files

- `docs/PITCH_INPUTS.md`
- `docs/PILOT_PLAN.md`
- `docs/AI_FEATURE_SPEC.md`
- `docs/RISK_AND_GOVERNANCE_REGISTER.md`
- `docs/PRODUCT_ROADMAP.md`
- `docs/SCREENSHOT_CHECKLIST.md`
- Partner/admin user guide.
- Data governance and consent brief.
- Conflict-of-interest disclosure draft.
- Demo-data and screenshot redaction checklist.
