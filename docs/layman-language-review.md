# CareAround SG Layman Language Review

Last reviewed: 2026-06-08

This document reviews the words, phrases, helper text, warnings, instructions, and guide language used across CareAround SG. The goal is to make the app easier for a non-technical user, caregiver, partner staff member, or admin to understand.

This is a content review, not a code-change list. Because wording appears across many stable screens, the safest path is to update language in small batches and verify each affected flow after every batch.

Current review note: this document has been reconciled with the Organisation governance, Admin Region Scope, Support Coverage, Audit Trail, shared confirmation dialog, inline feedback, and Discover location badge releases. It still records some older observed wording as source material so future copy batches can replace those phrases safely.

## Copy Principles

Use these principles when editing app text.

| Principle | What it means in CareAround SG |
| --- | --- |
| Prefer everyday words | Use "resource", "place", "service", "programme", "map", and "saved" before technical terms like "asset", "boundary", or "rollout". |
| Explain the benefit | Tell users what a setting helps them do, not only what the setting is called. |
| Avoid internal labels | Terms such as "asset", "subregion", "audience zone", "CTA", "collateral", "governance", "Admin Region Scope", and "Org Group" should be hidden from public users or explained for trained staff. |
| Be gentle with personal data | Profile and eligibility copy should explain why details are asked for, without sounding judgmental or transactional. |
| Use one name per idea | Avoid switching between "Private Maps", "My Maps", "directory", and "map" unless the distinction is deliberate. |
| Make errors actionable | Error messages should say what happened and what the user can do next. |
| Keep mobile labels short | Some labels sit inside compact cards, tabs, drawers, and buttons. Longer wording needs layout checks. |
| Keep badges factual | Location badges should say why a visible resource may be relevant, not imply endorsement, eligibility, official advice, or a guaranteed match. |

## Recommended Product Glossary

These should become the preferred user-facing terms.

| Current or mixed term | Recommended layman term | Notes |
| --- | --- | --- |
| Asset | Resource | "Asset" is internal. Use "resource" for normal users. Keep "asset" only in admin/import areas if needed. |
| Hard asset | Place | A physical location. |
| Soft asset | Offering | A service, programme, event, activity, promotion, or support item. |
| Saved Assets | Saved Resources | Clearer and less technical. |
| Private Maps | My Maps | The app already uses "My Maps"; avoid introducing a second label. |
| My Directory | My Directory | Keep. It works as the personal saved-resource hub. |
| Shared directory / shared map | Shared Map | Pick one main label. "Shared Map" is easier to grasp because the UI is map-led. |
| Partner-boundary | Partner area | Explain as "services available through your partner area" or "services for people in this partner's area". |
| Audience zone | Target area | For layman copy, explain as "a selected postal-code area". Admin screens can still show "Audience Zone" with help text. |
| Subregion | Service area | For public/user copy, use "service area". Admin screens can keep "Subregion" if paired with explanation. |
| Eligibility profile | Eligibility details | Warmer and less formal. |
| Locked offering | Restricted offering | "Locked" can feel like a user did something wrong. "Restricted" is clearer. |
| Member-only | For linked members | Makes the dependency clearer. |
| CTA | Action button / sign-up link | Avoid "CTA" in user-visible labels. |
| Collateral | Flyer or programme material | "Collateral" is industry jargon. |
| Governance fields | Access and visibility settings | Easier for operators to understand. |
| Rollout | Local version / place version | "Rollout" may be acceptable for admins, but it needs help text. |
| List only | Not shown on map | Clearer, especially for saved resources. |
| User View / impersonation | View as this user | More human and more transparent. |
| Organisation governance | Organisation access | For staff/admin docs, explain that it manages organisation context, not resource editing. |
| Organisation Admin / Organisation Staff | Organisation admin / Organisation staff | Use title case only when matching UI labels. Clarify that staff view organisation context read-only. |
| Admin Region Scope | Admin support area | For non-technical explanations, describe it as the area an admin helps support. Do not imply ownership or public Discover relevance. |
| Support Coverage | Support coverage | Explain as "which admin team can help this user based on profile location". |
| Audit Trail | Change history | For public/non-technical docs, "change history" is easier. Admin docs can keep "Audit Trail" with a short explanation. |
| Recommended for you | Recommended for you | Keep short; explain elsewhere that it is based on saved/profile context and does not guarantee eligibility. |
| Recommended for this location | Recommended for this location | Keep short; explain elsewhere that it is based on the searched or temporary location context. |
| Audience-zone star badge | Star badge | Do not expose "Audience Zone" publicly. Explain as "this resource is also relevant to the selected area" when help text is needed. |

## Highest-Priority Wording Fixes

These are the changes most likely to improve layman understanding.

| Area | Current wording pattern | Suggested direction | Why |
| --- | --- | --- | --- |
| Save buttons and My Directory | "Save asset", "Saved Assets", "saved asset" | Use "Save resource", "Saved Resources", "saved resource" | "Asset" is an internal system word. |
| My Directory tabs | "Saved Assets" and "Private Maps" | Use "Saved Resources" and "My Maps" | Keeps the user model simple: resources first, maps second. |
| Profile postal-code copy | "partner-boundary offerings" | "offerings available in your partner area" | Boundary language is technical. |
| Profile eligibility copy | "Eligibility profile", "locked offerings" | "Eligibility details", "restricted offerings" | More respectful and easier to understand. |
| Discover filter copy | "asset type", "card density", "subregion scope", "distance filtering" | "resource type", "view size", "service area", "nearby distance" | Current terms sound like admin tooling. |
| Saved resource status | "Unavailable", "List only" | "No longer available", "Not shown on map" | Gives users a clearer mental model. |
| Admin data tools | "Template rollouts", "child offerings keyed by..." | "Local versions made from templates" | Workbook text should guide operators, not expose implementation keys. |
| Collateral import | "collateral", "confidence", "CTA", "governance fields" | "flyer/programme material", "AI confidence", "action button", "access and visibility settings" | Makes AI/import review safer for non-technical staff. |
| Delete confirmations | "asset list", "resources permanently" | Be specific: "resources in this map", "delete from the system" | Prevents accidental destructive actions. |
| Shared maps | Mixed "shared directory" and "shared map" | Choose "Shared Map" as the main label, explain it contains a directory list | Reduces naming friction. |
| Discover badges | Internal Region/Audience Zone mechanics | Use "Recommended for you", "Recommended for this location", and an unlabeled star badge with plain help text | Keeps public copy useful without exposing targeting internals. |
| Organisation and admin scope | Mixed "governance", "scope", "coverage", and "access" | Explain what the role lets a person do and what it does not let them do | Prevents staff from assuming organisation/admin scope grants resource editing. |
| Confirmation and feedback | Browser alerts/technical status language | Use the shared confirmation pattern and in-page feedback wording | Keeps demo flows calm and consistent. |

## Suggested Copy Changes By Flow

### Sign In and Registration

Observed copy:

- "Partner Sign In"
- "Access your partner or admin account"
- "Access your user account"
- "Postal Code (optional)"
- "Add it now to personalize nearby and partner-boundary services, or skip and complete it later."
- "Are you a Partner or Admin?"

Suggested edits:

| Current | Suggested |
| --- | --- |
| Access your user account | Save resources, create maps, and keep your profile up to date. |
| Access your partner or admin account | Manage resources, users, and service areas. |
| Postal Code (optional) | Postal code (optional) |
| Add it now to personalize nearby and partner-boundary services, or skip and complete it later. | Add it now to see nearby resources and services available in your partner area. You can also add it later. |
| Are you a Partner or Admin? | Staff or admin? |
| Google Auth Failed | Google sign-in did not work. Please try again. |

Notes:

- "Partner or Admin" is understandable, but "Staff or admin?" may feel less formal on a public login screen.
- Keep "Partner Sign In" if partner organisations already use that term operationally.

### Discover

Observed copy includes:

- "Adjust location, distance, asset type, and card density."
- "Discovery is scoped to the ... boundary set."
- "The selected subregion scope overrides distance filtering."
- "Review only assets already saved to your account."
- "Your saved assets are list-only right now..."
- "saved assets are list-only right now and not shown on the map."

Suggested edits:

| Current | Suggested |
| --- | --- |
| Adjust location, distance, asset type, and card density. | Choose your location, distance, resource type, and view size. |
| Discovery is scoped to the ... boundary set. | Results are limited to the selected service area. |
| The selected subregion scope overrides distance filtering. | When a service area is selected, it replaces the distance filter. |
| Review only assets already saved to your account. | Show only resources you have saved. |
| Your saved assets are list-only right now, so the map will unlock after you save a place or offering with a valid location. | Your saved resources do not have map locations yet. The map will appear after you save a place or offering with a valid address. |
| saved assets are list-only right now and not shown on the map. | saved resources are not shown on the map because they do not have a usable location. |

Notes:

- Discover should avoid "asset", "scope", "subregion", and "boundary" where possible.
- "Card density" may be fine for a design tool, but "view size" or "card size" is more natural.
- Location badges should be described as helpful relevance cues, not official recommendations, eligibility approval, or sponsor placement.

Current Discover badge copy guidance:

| Badge / cue | Recommended explanation |
| --- | --- |
| Recommended for you | This resource may be relevant based on your saved/profile location context. |
| Recommended for this location | This resource may be relevant to the location you searched or selected. |
| Star badge | This resource also matches the selected area. |
| Internal Audience Zone / Region boundary match | Do not show the internal reason publicly. Use the badge wording above. |

### Resource Cards and Details

Observed copy includes:

- "Save asset"
- "Remove saved asset"
- "Save to Saved Assets"
- "Remove from Saved Assets"
- "Available in X places"
- "Nearest:"
- "Get Directions"
- "Unavailable"
- "List only"

Suggested edits:

| Current | Suggested |
| --- | --- |
| Save asset | Save resource |
| Remove saved asset | Remove saved resource |
| Save to Saved Assets | Save to Saved Resources |
| Remove from Saved Assets | Remove from Saved Resources |
| Available in X places | Available at X places |
| Nearest: [address] | Nearest location: [address] |
| Get Directions | Get directions |
| Unavailable | No longer available |
| List only | Not shown on map |

Notes:

- "Available at" is more natural for places than "Available in".
- If "Offering" is the product term, keep it, but make sure users learn it early.

### My Directory

Observed copy includes:

- "Saved Assets"
- "Private Maps"
- "Your private maps built from saved assets."
- "Your saved resources in one place."
- "Search saved assets"
- "Private maps built from your saved assets"
- "Create My Map"
- "Delete ...? This removes the map and its asset list."
- "Refine saved assets"

Suggested edits:

| Current | Suggested |
| --- | --- |
| Saved Assets | Saved Resources |
| Private Maps | My Maps |
| Your private maps built from saved assets. | Maps you created from your saved resources. |
| Search saved assets | Search saved resources |
| Private maps built from your saved assets | Maps built from your saved resources |
| Create My Map | Create map |
| Delete "..."? This removes the map and its asset list. | Delete "..."? This removes the map and the resources inside it. Your saved resources will stay in My Directory. |
| Refine saved assets | Filter saved resources |
| Search and sort your saved resources without crowding the page header. | Search and sort your saved resources. |

Notes:

- The delete confirmation is especially important. A layman may wonder whether deleting a map also deletes saved resources or live resources.

### My Maps

Observed copy includes:

- "Manage assets"
- "Edit details"
- "Print view"
- "Share"
- "This directory is empty"
- "Add saved resources to turn this private map into a grouped directory you can share or export later."
- "Add from Saved Assets"
- "Map controls"

Suggested edits:

| Current | Suggested |
| --- | --- |
| Manage assets | Manage resources |
| Print view | Print-friendly view |
| This directory is empty | This map has no resources yet |
| Add saved resources to turn this private map into a grouped directory you can share or export later. | Add saved resources to build a map you can view, print, export, or share. |
| Add from Saved Assets | Add from Saved Resources |
| Map controls | Map options |

Notes:

- My Maps mixes "map" and "directory". That is acceptable if the UI explains that a map includes a directory list, but the headings should not constantly switch.

### Shared Maps

Observed copy includes:

- "Shared directory"
- "This shared directory is no longer available"
- "Explore CareAround SG"
- "Read-only directory"
- "Sign in to save resources or create your own copy."
- "Save copy to My Maps"
- "Unlock the full CareAround SG experience"

Suggested edits:

| Current | Suggested |
| --- | --- |
| Shared directory | Shared Map |
| This shared directory is no longer available | This shared map is no longer available |
| Read-only directory | View-only map |
| Sign in to save resources or create your own copy. | Sign in to save resources or keep your own copy of this map. |
| Save copy to My Maps | Copy to My Maps |
| Unlock the full CareAround SG experience | Sign in to save and personalise this map |

Notes:

- "Unlock the full experience" is a bit marketing-like. The app can be more direct and helpful.

### Profile and Eligibility

Observed copy includes:

- "Eligibility profile"
- "These details help determine whether you qualify for restricted offerings."
- "Complete your profile details to check whether you qualify for locked offerings."
- "Still needed"
- "Add your postal code to personalize nearby results and unlock any partner-boundary offerings you qualify for."
- "Places you've joined through the membership QR flow."

Suggested edits:

| Current | Suggested |
| --- | --- |
| Eligibility profile | Eligibility details |
| These details help determine whether you qualify for restricted offerings. | These details help check which restricted offerings may be available to you. |
| Complete your profile details to check whether you qualify for locked offerings. | Add the missing details to check whether this restricted offering is available to you. |
| Still needed | Details still needed |
| Add your postal code to personalize nearby results and unlock any partner-boundary offerings you qualify for. | Add your postal code to see nearby results and offerings available in your partner area. |
| Places you've joined through the membership QR flow. | Places linked to your account through a membership QR code. |
| QR link | QR code |

Notes:

- Be careful with "qualify". It can sound judgmental. "Available to you" is softer.
- Explain sensitive profile fields by benefit and privacy posture where possible.

### Membership Linking

Observed copy includes:

- "Membership linking"
- "Join a community place with one scan so member-only offerings can recognise your access."
- "Linking your membership..."
- "You're now linked."
- "Membership linked successfully."

Suggested edits:

| Current | Suggested |
| --- | --- |
| Membership linking | Link your place membership |
| Join a community place with one scan so member-only offerings can recognise your access. | Link your account to this place so member-only offerings can recognise your access. |
| Linking your membership... | Linking your account... |
| You're now linked. | Your account is linked. |
| Membership linked successfully. | Your place membership has been linked. |

Notes:

- "Join a community place" may sound like becoming a member of the organisation. "Link your account to this place" is clearer.

### Admin Dashboard and Data Tools

Observed copy includes:

- "Hard assets, programs, and services"
- "Asset type"
- "Boundary checks"
- "Derived Region"
- "Ownership"
- "Partner boundary"
- "Audience zone"
- "Template rollouts"
- "Child offerings keyed by templateExternalKey + hostExternalKey"
- "Places derive subregion from postcode on the server."
- "Organisation access"
- "Admin Region Scope"
- "Support Coverage"
- "Audit Trail"
- "Org Group"
- "Region Group"

Suggested edits:

| Current | Suggested |
| --- | --- |
| hard assets, programs, and services | places and offerings |
| Asset type | Resource type |
| Boundary checks | Service-area checks |
| Derived Region | Matched service area |
| Ownership | Managed by |
| Partner boundary | Partner service area |
| Audience zone | Target area |
| Template rollouts | Local versions from templates |
| Child offerings keyed by templateExternalKey + hostExternalKey | Local versions are matched by template ID and host place ID. |
| Places derive subregion from postcode on the server. | A place's service area is chosen automatically from its postal code. |
| Organisation access | Organisation context access (admins manage; staff view) |
| Admin Region Scope | Admin support area |
| Support Coverage | Admin support coverage |
| Audit Trail | Change history |
| Org Group | Organisation coordination group |
| Region Group | Cross-organisation coordination group |

Notes:

- Admin screens can keep some operational terms if staff are trained on them, but every technical term should have a plain-English helper.
- "Ownership" is legally loaded. "Managed by" is often clearer.
- Organisation access, group roles, and Admin Region Scope need explicit "does not grant resource editing" helper text anywhere operators may confuse them with Resource Owner/Staff access.

### Resource Forms

Observed copy includes:

- "Ownership"
- "Partner Owner"
- "Bucket"
- "Sub-Category"
- "Host Locations"
- "Target subregion"
- "Audience mode"
- "Member only"
- "Eligibility rules"
- "CTA label"
- "Venue note"
- "Stable workbook identifier"

Suggested edits:

| Current | Suggested |
| --- | --- |
| Ownership | Who manages this resource |
| Partner Owner | Managing partner |
| Bucket | Offering group |
| Sub-Category | Category |
| Host Locations | Places where this offering is available |
| Target subregion | Service area |
| Audience mode | Who can see this offering |
| Member only | Only for linked members |
| Eligibility rules | Eligibility details |
| CTA label | Action button text |
| Venue note | Location note |
| Stable workbook identifier. Keep this unchanged after creation. | ID used for workbook import/export. Keep it unchanged after creation. |

Notes:

- "Bucket" should almost never appear to lay users. If it must appear for operators, explain it as a grouping of offerings.

### Import and AI Review

Observed copy includes:

- "Collateral import review"
- "Review the extracted offering drafts..."
- "No same-host match suggested."
- "Suggested match"
- "confidence"
- "Governance fields like ownership, audience targeting, member-only settings, availability, eligibility, and visibility stay untouched in this importer."
- "Standalone offerings only in V1"
- "The AI suggests structure..."

Suggested edits:

| Current | Suggested |
| --- | --- |
| Collateral import review | Review imported flyer/programme details |
| extracted offering drafts | draft offerings found from the uploaded material |
| No same-host match suggested. | No likely match found at this place. |
| Suggested match | Possible existing match |
| 80% confidence | AI confidence: 80% |
| Governance fields... | Access and visibility settings are not changed by this importer. |
| Standalone offerings only in V1 | This import creates standalone offerings only. |
| The AI suggests structure... | AI helps draft the details, but you choose what to create or update. |

Notes:

- Import screens are where operators can make high-impact mistakes. Copy should slow them down just enough to review choices clearly.

### Errors, Confirmations, and Empty States

Observed copy includes:

- "Failed to load your maps."
- "Failed to remove this saved asset."
- "Delete this resource permanently?"
- "Delete this user and all their resources?"
- "No maps match your current search."
- "Try another name or clear the current filter."
- "API route misconfigured..."
- "Session expired. Please log in again."

Suggested edits:

| Current | Suggested |
| --- | --- |
| Failed to load your maps. | We could not load your maps. Please refresh and try again. |
| Failed to remove this saved asset. | We could not remove this saved resource. Please try again. |
| Delete this resource permanently? | Delete this resource from CareAround SG? This cannot be undone. |
| Delete this user and all their resources? | Delete this user account and the resources managed by this user? This cannot be undone. |
| No maps match your current search. | No maps found for this search. |
| Try another name or clear the current filter. | Try a different map name or clear the search. |
| API route misconfigured... | Technical setup problem. Please contact the CareAround SG team. |
| Session expired. Please log in again. | Your session has ended. Please sign in again. |

Notes:

- Confirmations should state whether the action affects only the user's own saved item/map or deletes something from the whole system.
- User-facing errors should avoid technical setup terms unless the reader is definitely an operator.
- Empty states should usually suggest one clear next action.

## Cross-App Consistency Decisions Needed

These decisions should be settled before large-scale copy edits.

1. Should "Saved Assets" be fully renamed to "Saved Resources" everywhere user-facing?
2. Should "Private Maps" be fully renamed to "My Maps"?
3. Should "Shared directory" be fully renamed to "Shared Map"?
4. Should "Offering" remain the public term, or should it become "Service/programme" in some areas?
5. Should admin-only terms like "subregion", "audience zone", and "rollout" stay visible for trained staff, with helper text, or be renamed too?
6. Should British/Singapore spelling be standardized across the app, for example "personalise" versus "personalize", "programme" versus "program"?
7. Should Discover include a small badge legend, or should badge explanations stay in the user guide/help text only?
8. Should Organisation/Admin governance screens keep formal labels, or pair every formal label with a short "what this does not allow" explanation?

Recommended defaults:

- Rename "Saved Assets" to "Saved Resources".
- Rename "Private Maps" to "My Maps".
- Use "Shared Map" as the main public label.
- Keep "Offering" for now, but define it clearly in onboarding/help text.
- Keep admin terms where they map to operational workflows, but add plain-English helper text.
- Use Singapore/British spelling in user-facing copy: "personalise", "programme", "recognise".
- Keep Discover badge labels short and put detailed explanations in guide/help copy, not on every card.
- Keep Organisation/Admin labels formal in admin screens, but add helper text that separates organisation access, group coordination, admin support area, and Resource Owner/Staff editing rights.

## Safe Implementation Sequence

Because the app has locked/stabilized flows, update copy in small batches:

1. User-facing terminology batch:
   - Save button labels.
   - My Directory tabs and headings.
   - Saved resource cards.
   - Shared Map labels.

2. Profile and access explanation batch:
   - Postal-code helper text.
   - Eligibility wording.
   - Membership linking page.
   - Restricted offering notices.

3. Discover wording batch:
   - Filter panel labels.
   - Empty states.
   - Saved-map notes.
   - Location/distance helper text.
   - Badge legend/help text for `Recommended for you`, `Recommended for this location`, and the star badge.

4. My Maps wording batch:
   - Map detail controls.
   - Empty states.
   - Share modal.
   - Print/export labels.

5. Admin and import wording batch:
   - Resource forms.
   - Workbook import/export guide text.
   - Audience-zone/subregion helper text.
   - Collateral import review language.
   - Organisation governance, Admin Region Scope, Support Coverage, and Audit Trail helper text.

## Verification After Copy Changes

For each batch, verify:

- Text fits on mobile and desktop.
- Buttons do not wrap awkwardly.
- Existing user flows still make sense.
- No technical term remains unexplained in the affected screen.
- No destructive action becomes less clear.
- Smoke-test the touched surface manually before broader release checks.
- For badge wording, confirm the text remains display-only and does not imply ranking, eligibility, official advice, or sponsorship.
- For organisation/admin wording, confirm the copy does not imply Organisation access, Org Groups, Region Groups, or Admin Region Scope grant resource edit rights.

Suggested manual checks:

- `/discover`
- `/login`
- `/my-directory`
- `/my-directory/maps/:mapId`
- `/shared/maps/:token`
- `/dashboard/profile`
- `/dashboard/resources`
- `/dashboard/admin`

## Open Product Questions

These are not blockers, but they affect how the final language system should feel.

- Should CareAround SG sound more like a public service directory, a caregiver planning tool, or a partner operations platform?
- Should older adults be addressed directly, or should the default voice assume caregivers and staff are often the ones using the app?
- Should restricted offerings be explained as "not available", "needs more information", or "check eligibility" depending on the reason?
- Should the app include a small "What do these terms mean?" help section for Place, Offering, Saved Resource, My Map, and Shared Map?
- Should the admin dashboard have its own glossary separate from the public user experience?
