# CareAround SG Pilot Concept Note

Source: `docs/CAREAROUND_SG_PROJECT_DOSSIER.md`, generated from the current repository working tree.

## Pilot Title

CareAround SG Community Resource Navigation Pilot

## Problem Statement

Seniors, caregivers, families, and community partners often face a practical service-navigation gap. Relevant support may exist, but information can be scattered, outdated, hard to compare, difficult to share, or unclear by location, eligibility, and service context.

CareAround SG aims to make community-resource navigation more practical by helping users find senior-related places and programmes, save useful resources, organise them into maps, and share planning options safely.

## Target Users

- Seniors looking for nearby community support.
- Caregivers or family members preparing options for someone else.
- AAC staff or community partner staff supporting service navigation.
- Administrators maintaining resource listings and visibility/access rules.

`Assumption`: caregiver-mediated use may be a primary early pilot pattern, even if seniors can use the product directly.

## Target Partner Profile

`Needs input`: specific pilot partners are not confirmed by the repository.

Ideal pilot partner profile:

- A community-care or senior-service partner with a manageable first service area.
- Staff who can review resource accuracy and update listings.
- Willingness to use demo-safe or approved operational data.
- Clear data-handling boundaries.
- Ability to nominate a small number of staff users for onboarding and feedback.
- No expectation of preferential public ranking or sponsor-driven placement.

## 8-12 Week Pilot Scope

Recommended pilot window: 8-12 weeks.

Pilot shape:

- Start with one defined service area or one partner cluster.
- Use a controlled set of public/demo-safe resource listings.
- Let users discover, save, organise, print, export, and share maps.
- Let partner/admin staff maintain selected listings and review content.
- Use AI-assisted import/data-improvement only as staff-reviewed internal tooling.
- Use aggregate metrics for pilot evaluation.

## In-Scope Features

- Public Discover search and browse.
- Resource detail pages.
- Saved resources and My Directory.
- My Maps for planning, printing, image export, and sharing.
- Shared map viewing.
- Standard user registration and sign-in.
- Profile postal-code and optional relevance fields, if consent wording is ready.
- Partner/admin resource management for selected listings.
- Workbook import/export for controlled updates.
- Translation review for selected public-facing resources.
- Membership links only where partner rules are clear.
- Partner-only notes/files only where participating partners approve the operating rules.
- Basic aggregate reporting from operational data.

## Out-Of-Scope Features

- Emergency, medical, legal, financial, or clinical advice.
- Diagnosis, triage, clinical risk scoring, or case-management decisions.
- Formal referrals or warm handoffs unless separately designed and approved.
- Autonomous AI social prescribing.
- AI analytics narratives shared without human review.
- External notifications by SMS, WhatsApp, or email unless consent, templates, and provider rules are approved.
- Collection of national identification details, senior case files, clinical diagnosis details, private contact rosters, unnecessary personal addresses, or confidential partner information.
- AIC endorsement, official agency status, or agency-operated service claims.
- Paid resource ranking or sponsor-preferred placement.

## Data Collected

Data collection should be limited to what is necessary for the pilot.

Expected data:

- Account data needed for login.
- Optional postal-code/profile fields where purpose and consent are clear.
- Saved resources and My Maps created by users.
- Shared-map status and map contents.
- Resource listing edits and review status.
- Translation review status for selected resources.
- Partner staff access events where enabled.
- Aggregate pilot activity metrics such as resource views, saves, map creation, sharing, and listing freshness.

## Data Not Collected

The pilot should not collect:

- National identification details.
- Senior case files.
- Clinical diagnosis details.
- Emergency or triage records.
- Private contact rosters.
- Unnecessary personal addresses.
- Confidential partner information outside agreed operating content.
- Medical advice requests or clinical decision records.
- Individual user data for sale, advertising, or sponsor targeting.

## Success Metrics

User outcomes:

- Users can find relevant resources with fewer manual steps.
- Users save resources and create maps for planning.
- Users report that resource options are easier to compare and share.

Partner/admin outcomes:

- Partner/admin staff can update selected listings without engineering support.
- Resource data freshness improves during the pilot.
- Translation review coverage improves for selected resources.
- Staff report lower friction in preparing or sharing resource options.

Service-navigation outcomes:

- Search-to-detail conversion.
- Detail-to-save conversion.
- Saved-resource-to-map conversion.
- Shared-map views or copies.
- Percentage of pilot resources with usable coordinates, descriptions, schedules, and eligibility notes.

Governance outcomes:

- No sensitive-data leakage through public snapshots, shared maps, or exports.
- No AIC endorsement or official-agency claim is made.
- AI-assisted content remains human-reviewed.
- Partner access is limited to authorised users.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Users treat resource suggestions as official advice | Use clear disclaimers, provider-check prompts, and no endorsement claims. |
| Resource data is stale | Add review ownership, review dates, and partner update workflow. |
| Shared maps reveal sensitive planning context | Add sharing warnings and keep private fields out of public snapshots. |
| Partner staff access is misconfigured | Use role-based access, owner handover controls, tests, and audit logs. |
| AI suggestions are inaccurate | Keep AI as draft support only; require human review before publishing. |
| Pilot metrics over-collect personal data | Use aggregate metrics, consent, retention limits, and small-count suppression. |
| COI or endorsement concerns arise | Maintain disclosure pack, recusal rules, independent wording, and no AIC endorsement claims. |
| Sponsor or partner expects preferential visibility | Use a sponsor/visibility policy that separates funding from resource ranking. |

## Pilot Decisions Needed

- Confirm target service area or partner cluster.
- Confirm pilot partner and staff roles.
- Confirm data source and data-sharing permissions.
- Confirm whether profile fields, memberships, private notes/files, and translation review are in scope.
- Confirm whether any AI-assisted workflow is allowed in the pilot.
- Confirm who approves screenshots, pitch materials, partner communications, and disclosure wording.
