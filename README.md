# CareAround SG Product Map

CareAround SG is a web app for helping people find senior-related support in Singapore, save useful resources, and turn those resources into practical directories that can be shared, printed, or used for care planning.

This README is written as a plain-English map of the product. It is meant to help the product owner reflect on what already exists, how the parts relate to one another, where the logic may need review, and how this can later become a user guide.

It is not mainly a technical setup guide.

## The Big Picture

CareAround SG has three simple jobs:

1. Help people discover nearby places and offerings.
2. Help users save the resources that matter to them.
3. Help users organize saved resources into personal or shared maps.

The product is built around a few everyday ideas:

| Product idea | Plain meaning |
| --- | --- |
| Place | A real-world location, such as an active ageing centre, clinic, community club, hospital, nursing home, religious site, or social service office. |
| Offering | A service, programme, promotion, event, or support activity. It may happen at one place, multiple places, or be managed as a reusable template. |
| Saved Asset | A place or offering that a signed-in user has saved for later. |
| My Directory | The user's personal collection of saved resources. |
| My Map | A curated directory made from saved resources. It can be kept private, shared by link, printed, or exported as an image. |
| Shared Map | A read-only public version of a My Map that other people can view through a link. |
| Subregion | A management area based on postal codes. It helps decide which admins or partners can manage which users and resources. |
| Audience Zone | A more targeted postal-code group used to decide who can see certain restricted offerings. |
| Membership Link | A QR or link flow that connects a user to a place, so member-only offerings can recognise that user's access. |

## Who Uses CareAround SG

| User group | What they can do |
| --- | --- |
| Guest | Browse public resources and shared maps without signing in. Guests cannot save resources or create maps. |
| Standard User | Save resources, manage My Directory, create My Maps, view shared maps, copy shared maps, maintain a profile, and link memberships. |
| Partner | Manage their assigned users, audience zones, and partner-owned resources within their allowed area. |
| Regional Admin | Manage resources, partners, subregions, and audience zones for their assigned region. |
| Super Admin | Manage the full system, including users, resources, categories, subregions, audience zones, and data tools. |

The product is intentionally role-based. A user should only see and manage what they are allowed to see and manage.

## Main Feature Areas

### 1. Discover

Discover is the public-facing exploration area.

People use it to:

- Browse places and offerings.
- Search by words such as a name, category, postal code, service type, or tag.
- Use a postal code or current location to understand what is nearby.
- See results as a list and on a map.
- Save useful places or offerings after signing in.
- See saved resources reflected as saved pins on the map.

Discover has different behavior on desktop and mobile:

- Desktop gives more room for the map, side panels, filters, and resource details.
- Mobile focuses more on browse cards and compact controls, with the map available when needed.

Important relationship:

Discover depends on the quality of the resource data. If a place has weak location data, unclear category data, or inconsistent visibility settings, Discover will feel confusing even if the page itself is working.

### 2. Resource Details

Each place or offering can have its own detail page.

A place detail can show things like:

- Name.
- Address and map location.
- Phone number.
- Hours.
- Website.
- Description.
- Logo, banner, and gallery images.
- Related offerings.

An offering detail can show things like:

- Name.
- Description.
- Schedule.
- Linked place or places.
- Contact details.
- Call-to-action link.
- Availability count, when tracking is enabled.
- Eligibility or access notes, when the offering is restricted.

Signed-in users can save a resource from its detail page.

Important relationship:

The detail page is where a user checks whether a resource is actually relevant. Discover gets them interested; the detail page helps them decide what to do next.

### 3. Saved Assets and My Directory

Saved Assets are the user's personal bookmarks.

When a signed-in user saves a place or offering:

- It appears in My Directory.
- It can be searched, sorted, and removed.
- It can be used later when creating a My Map.

My Directory is the bridge between discovery and planning. It is not just a favourites list; it is the user's staging area for building useful care directories.

Important relationship:

My Directory depends on saved resources staying meaningful over time. If a resource is later hidden, deleted, or changed, the system may still keep a saved snapshot so the user's map does not become empty without explanation.

### 4. My Maps

My Maps let a user turn saved resources into a curated directory.

A user can:

- Create a named map from saved resources.
- Add or remove resources from the map.
- Rename the map.
- Add or edit a description.
- Search within the map.
- Use a distance anchor, such as a postal code, to make the map more useful for a specific person or household.
- Print the map.
- Save the map as an image.
- Share the map through a public read-only link.
- Unshare the map later.
- Delete the map.

My Maps are useful for real care scenarios, for example:

- A caregiver preparing options for a parent.
- A social worker collecting nearby support.
- A family comparing services around a loved one's home.
- A partner creating a small handout of relevant resources.

Important relationship:

My Maps depend on My Directory. A user must first save resources before those resources can be added into a map.

### 5. Shared Maps

A Shared Map is the public read-only version of a My Map.

Guests can:

- Open the shared link.
- Browse the directory.
- Use the map and list.
- Print the shared map.

Signed-in users can also:

- Save resources from the shared map.
- Copy the shared map into their own My Maps, as long as they are not the original owner.

The owner can:

- Publish a share link.
- Unpublish it.
- Republish later, which creates a fresh link.

Important relationship:

Shared Maps make private curation reusable. They turn one person's map-building effort into something another person can view, print, copy, or build on.

### 6. Partner and Admin Dashboard

The dashboard is where trusted users manage the system.

Resource management includes:

- Creating and editing places.
- Creating and editing offerings.
- Managing place and offering images.
- Hiding resources manually or by schedule.
- Tracking offering availability.
- Linking offerings to places.
- Managing templates and rollouts for repeated offerings.

User management includes:

- Creating users.
- Assigning roles.
- Assigning managers.
- Connecting users to the right subregion through postal-code rules.

System management includes:

- Managing subregions.
- Managing audience zones.
- Managing categories and category icons.
- Importing and exporting data through workbooks.

Important relationship:

The dashboard controls what normal users eventually see in Discover, Resource Details, My Directory, and Shared Maps. If dashboard rules are unclear, the public experience can become inconsistent.

### 7. Places and Offerings

The most important content relationship is the difference between places and offerings.

| Concept | Meaning | Example |
| --- | --- | --- |
| Place | A physical location. | An active ageing centre at a specific address. |
| Standalone Offering | A service or programme managed directly as one resource. | A weekly exercise class available at one or more places. |
| Template Offering | A reusable parent offering. | A standard programme that can be rolled out to many places. |
| Child Offering | A local version of a template at a specific host place. | The same programme running at one particular centre, with local timing or contact details. |

This structure is powerful because it supports both simple and complex content:

- Simple resource: one place.
- Simple programme: one offering linked to one place.
- Multi-location programme: one offering linked to several places.
- Reusable programme: one template with child offerings at different host places.

Important relationship:

The more advanced template and rollout model can reduce duplicated work, but it must be easy for admins to understand which details come from the parent template and which details are local overrides.

### 8. Visibility and Access

Not every resource is visible to every person.

CareAround SG has several visibility and access ideas:

| Rule | Plain meaning |
| --- | --- |
| Public | The resource can be seen by normal visitors, subject to normal filters. |
| Hidden | The resource is intentionally not shown publicly. |
| Scheduled hiding | The resource is hidden during a chosen date/time window. |
| Member-only | The user may need a linked membership at a place to access the offering. |
| Partner-boundary | The offering is meant for users connected to a partner and inside that partner's postal-code boundary. |
| Audience-zone | The offering is meant for users whose postal code matches a selected audience zone. |
| Eligibility-based | The offering may depend on profile details such as age, gender, or property type. |

These rules are meant to support real-world programme access, but they are also one of the areas most likely to confuse users if the wording is not clear.

Important relationship:

Access logic depends on user profile data, postal-code boundaries, memberships, resource ownership, and visibility settings all lining up.

### 9. Membership Linking

Membership linking connects a standard user to a place.

The intended flow is:

1. A partner or admin generates a membership QR or link for a place.
2. A user opens the link.
3. If the user is not signed in, they are asked to sign in first.
4. The system links that user to the place.
5. Member-only offerings connected to that place can recognise the user's access.

Important relationship:

Membership linking is not just a profile badge. It affects whether member-only offerings can be accessed or recognised correctly.

### 10. Import and Enrichment Tools

CareAround SG includes tools to help operators add and maintain resource data.

These tools include:

- Google place import, for finding place candidates near a postal code.
- Place enrichment, for improving details such as address, hours, descriptions, service tags, and logo suggestions.
- Collateral import, for turning programme collateral into draft offerings for review.
- Workbook templates, exports, filtered exports, and imports.
- Separate workbook flows for places, standalone offerings, templates, and template rollouts.

Important relationship:

Import tools speed up operations, but they also introduce risk. Imported data still needs human review, especially for category choice, ownership, visibility, audience targeting, and whether an offering should be standalone or template-based.

### 11. Language and Translation

CareAround SG now has a language foundation for:

- English.
- Mandarin.
- Malay.
- Tamil.

There are two kinds of translation in the product:

| Translation area | Plain meaning |
| --- | --- |
| App interface language | Common buttons, navigation, Discover, My Directory, My Maps, profile, and other user-facing screens can change language through the language selector. |
| Resource content translation | Places and offerings can have translated names, descriptions, schedules, contact notes, and other public text. |

English remains the main version of resource content. When English content is saved, the system can prepare Mandarin, Malay, and Tamil translations. Partners or admins can then review those translations in the dashboard.

The translation review flow uses plain statuses:

| Status | Meaning |
| --- | --- |
| Ready | The translation is available and does not currently need attention. |
| Missing translation | The translation has not been filled yet. |
| Needs review | English changed after the translation was prepared or reviewed. |
| Staff edited | A person changed the translated wording manually. |
| Auto prepared | The system prepared the translation automatically. |

Important relationship:

Translations are meant to improve access, but they should not silently replace human judgement. If staff edit or review a translation and English later changes, the translated field should be flagged for review instead of being overwritten without warning.

Current language boundary:

- Public and everyday user-facing areas are intended to support the language selector.
- Deep admin and operational tooling may stay in English in V1, with clear notices where appropriate.
- Legal pages are English-authoritative in V1. Translated legal summaries should not be treated as official until reviewed.

### 12. Partner-Only Notes and Files

Some resource information is useful for partners but should not be visible to guests or standard users.

CareAround SG supports a protected partner-only area on place and offering details. It can hold:

- Reference notes.
- Pricing notes.
- Service guide notes.
- Checklists.
- Private images.
- Private PDFs.
- Extra partner viewer access.

Only authorised partners and admins should see this section. Standard users, guests, and unrelated partners should not see that it exists.

Private files are viewed through permission-checked links. They are not normal public image or file URLs.

Important relationship:

Partner-only content must stay separate from public resource content. It should not appear in Discover, public resource payloads, saved map snapshots, shared maps, workbook exports, or public map cache data.

### 13. Privacy, Cookies, and Terms

CareAround SG has public legal baseline pages:

- `/privacy` for the Privacy & Cookies Notice.
- `/terms` for the Terms of Use.

The current approach is:

- No cookie banner in V1 because the current browser storage is for essential or functional purposes: sign-in session, language choice, contrast, and text-size preferences.
- If analytics, heatmaps, marketing pixels, advertising, or other non-essential tracking tools are added later, consent controls should be added before those tools load.
- English legal text is authoritative in V1.
- The privacy/legal contact is still a placeholder and must be replaced before wider public launch.

Important relationship:

Legal pages should match what the app actually does. When CareAround SG adds new data collection, messaging, analytics, exports, AI workflows, or partner workflows, the privacy and terms pages should be reviewed.

### 14. Security and Data Protection Posture

CareAround SG has practical security guardrails intended to reduce common web-app and data-protection risks.

Current protections include:

- Security headers such as CSP, HSTS, frame protection, content-type protection, referrer policy, and permissions policy.
- Tighter CORS rules.
- Server-side request validation for sensitive JSON payloads.
- Request size and malformed JSON guards.
- Rate limits for higher-risk areas such as auth, uploads, AI import, and translation.
- Protected partner-only file access.
- Production session signing that requires a real secret.
- Tests that check access control and private-data exclusion from public/shared payloads.

This is not a formal security certification. It is a practical baseline that should keep improving as the product grows.

Important relationship:

Security and privacy are not one feature. They affect every workflow that touches user data, partner data, private files, imports, exports, maps, memberships, and admin tools.

### 15. User Data Export

Admins can export user data through a scoped CSV workflow.

The export is meant to support operations such as:

- Reviewing matching users.
- Exporting selected users.
- Supporting outreach, service planning, or admin review.

Important relationship:

User export is powerful because it can move personal data outside the app. It should remain role-protected, scoped, and used only for legitimate operational purposes. Any future user guide or partner/admin training should explain safe handling of exported files.

## How The Pieces Connect

### Main user journey

```text
Discover resources
  -> open a resource detail
  -> save useful resources
  -> review them in My Directory
  -> create a My Map
  -> print, export, or share the map
```

### Admin content journey

```text
Create or import places and offerings
  -> assign category, ownership, location, visibility, and audience rules
  -> resources appear in Discover when allowed
  -> users save resources
  -> saved resources become directories and shared maps
```

### Restricted offering journey

```text
Admin creates a restricted offering
  -> restriction depends on membership, postal boundary, audience zone, or profile details
  -> user signs in and completes profile or links membership
  -> system decides whether the offering is visible, locked, unavailable, or accessible
```

### My Map sharing journey

```text
User creates a private map
  -> user publishes a share link
  -> guest can view the read-only map
  -> signed-in recipient can save resources or copy the map
  -> owner can unpublish the link later
```

### Translation journey

```text
Partner or admin saves English resource content
  -> system prepares Mandarin, Malay, and Tamil where configured
  -> dashboard shows which languages are ready or need review
  -> staff can accept, edit, or refill missing text
  -> public users see their selected language when available
  -> missing or outdated translated text falls back to English
```

### Partner-only reference journey

```text
Resource editor adds private notes or files
  -> access is limited to resource editors and extra partner viewers
  -> authorised partners see the protected section on detail pages
  -> guests, standard users, and unrelated partners see nothing
  -> private content stays out of public maps, snapshots, and exports
```

### Privacy and security journey

```text
User signs in or saves data
  -> session and preferences are stored for essential app use
  -> protected APIs check identity, role, and request shape
  -> sensitive partner/admin data stays behind permission checks
  -> privacy and terms pages explain current use and responsibilities
```

## Feature Dependencies

| Feature | Depends on | Why it matters |
| --- | --- | --- |
| Discover | Resource data, categories, map locations, visibility rules, saved state | Weak data or unclear visibility makes search and maps feel unreliable. |
| Resource Details | Full place/offering records, linked locations, eligibility, availability | This is where users decide whether a resource is useful. |
| Saved Assets | Sign-in, live resource data, saved snapshots | Saved resources should remain understandable even if live content changes later. |
| My Directory | Saved Assets | The directory is the user's working list before creating maps. |
| My Maps | Saved Assets, map grouping, distance anchor, snapshots | Maps need stable resources, useful location grouping, and resilience when data changes. |
| Shared Maps | My Maps, share links, viewer permissions | Sharing should be simple for guests but richer for signed-in users. |
| Membership Access | User accounts, membership links, linked places, member-only offerings | A broken membership flow can make restricted offerings impossible to understand. |
| Dashboard | Roles, ownership, subregions, audience zones, import tools | Admin decisions shape the entire public experience. |
| Translation | English source fields, Google Translation setup, review metadata, public fallback utilities | Multilingual display should help users without overwriting reviewed staff wording. |
| Partner-Only Content | Resource ownership, partner/admin roles, extra viewer grants, protected file routes | Private notes and files must be useful to partners without leaking to public users. |
| Legal Pages | Current data practices, cookies/storage behavior, security posture, public contact details | Privacy and terms text should stay aligned with real product behavior. |
| User Export | Admin role, user filtering, CSV generation, safe handling process | Exported user data needs tight scope and careful operational use. |
| Security Baseline | Headers, CORS, validation, rate limits, session secrets, access-control tests | Security controls protect the trust model behind every feature. |

## Reflection Checklist and Possible Gaps

This section is intentionally written as questions, not as confirmed bugs. It is meant to help review product logic before turning this into a user guide or planning new enhancements.

### User experience questions

- Can a first-time visitor quickly understand the difference between a place and an offering?
- Does Discover explain why some resources can be saved, opened, or shown on the map while others cannot?
- Does the mobile experience make it clear when the user is browsing a list versus using the map?
- Does a standard user understand that My Directory is the saved-resource collection and My Maps are curated directories built from that collection?
- Should users get clearer guidance when they have saved resources but have not yet created a map?

### Resource model questions

- Are admins clear on when to create a place, standalone offering, template, or rollout?
- Are template child overrides easy enough to understand, especially when local details differ from the parent template?
- Can multi-location offerings be explained simply in the future user guide?
- Should the product use the words "place" and "offering" everywhere, or do some screens still use older wording?

### Visibility and access questions

- Can admins predict who will see a resource before they publish it?
- Is the difference between hidden, scheduled hidden, member-only, partner-boundary, audience-zone, and eligibility-based access clear enough?
- When a user cannot access an offering, does the app explain whether they need to sign in, complete profile fields, link membership, or simply do not qualify?
- Are partner-boundary and audience-zone rules too similar from a layman's point of view?
- Should there be a preview mode for admins to see what a standard user would see?

### Saved maps and sharing questions

- If a saved resource becomes hidden or deleted later, is the snapshot behavior clear to users?
- Should shared-map recipients know which resources are live and which are no longer available?
- Should map owners be warned before sharing a map that includes unavailable or list-only resources?
- Does copying a shared map feel different enough from saving one resource?
- Should map print/export include more guidance for offline users, such as phone-first contact details?

### Membership and profile questions

- Does the membership QR flow make sense for seniors, caregivers, and frontline staff?
- Should users see a clearer list of places they are linked to and what those memberships unlock?
- Are profile fields such as date of birth, gender, and property type explained sensitively enough?
- Should the product separate "needed for eligibility" from "optional profile information" more clearly?

### Language and translation questions

- Which screens should be fully translated before public launch, and which admin screens can remain English-only with a clear notice?
- Should legal text stay English-only until reviewed, or should the app offer non-authoritative summaries later?
- Are translation statuses understandable to non-technical partner staff?
- Should users be told when a resource is being shown in English because translated text is missing?
- Who is responsible for reviewing Mandarin, Malay, and Tamil wording before larger rollout?

### Admin and operations questions

- Are workbook imports easy enough for a non-technical operator to use safely?
- Do import reports explain row errors in a way operators can fix without engineering help?
- Should imported resources default to hidden until reviewed?
- Are category names, icons, and tags governed tightly enough to avoid duplicate or confusing labels?
- Are subregion and audience-zone boundary conflicts easy to detect before they affect real users?
- Are user exports clearly scoped and safely handled after download?
- Do partner-only notes and files need clearer rules about what should never be uploaded?
- Should the privacy contact placeholder be treated as a launch blocker in every release checklist?

### Future enhancement questions

- Should CareAround SG support guided recommendations, not just search and saving?
- Should My Maps support notes, priority labels, or caregiver comments?
- Should shared maps have expiry dates or version history?
- Should partners get analytics about saved resources, copied maps, or QR membership usage?
- Should there be a dedicated user guide for each audience: public user, partner, regional admin, and super admin?

## Possible User Guide Outline

This README can become the base for a future guide. A practical guide could be split into:

1. Getting started with CareAround SG.
2. Choosing language, contrast, and text size.
3. Finding resources in Discover.
4. Understanding places and offerings.
5. Saving resources.
6. Building My Directory and My Maps.
7. Sharing, printing, and exporting maps.
8. Completing your profile and linking memberships.
9. Understanding privacy, cookies, and terms.
10. Managing resources as a partner or admin.
11. Reviewing translations.
12. Using partner-only notes and files safely.
13. Importing data safely.
14. Exporting user data safely.
15. Troubleshooting common access and visibility questions.

A more detailed guide foundation is kept in `docs/user-guide-foundation.md`.

## Behind The Scenes

This section is intentionally short. The main product should be understandable without knowing the technology.

- The user-facing app is a React web app.
- The server is a Hono-based API.
- The database is Postgres-style and is managed through structured database definitions.
- The deployed app uses Cloudflare Pages for the client and Cloudflare Workers for the API.
- A Cloudflare KV store is used for public map cache data.
- Google is used for sign-in and place/map-related workflows.
- Google Translation can be used to prepare Mandarin, Malay, and Tamil resource translations.
- Media upload support is available for logos, banners, and gallery images.
- Protected partner-only file viewing is handled through authenticated server routes.
- Workbook import/export supports operational data management.
- Local environment files exist for client and server configuration, but they are intentionally ignored by git and should never be printed or committed.

## Current Documentation Relationship

This README is the product reflection map. It is useful for understanding what the product does and how the major pieces relate to each other; it is not the release gate or the current-session handoff.

Use the supporting documents this way:

- `docs/session-handoff.md` records the current branch, dirty-worktree notes, active guardrails, and safest next resume point.
- `docs/regression-ledger.md` tracks locked behavior, regression checks, known-good references, and deploy gates.
- `docs/release-checklist.md` tracks pre-release verification steps.
- `docs/CAREAROUND_SG_PROJECT_DOSSIER.md` is the fuller internal dossier for product, architecture, pilot, governance, and roadmap context.
- `docs/AIC_DISCLOSURE_PACK.md`, `docs/PILOT_CONCEPT_NOTE.md`, `docs/FUNDER_PITCH_BRIEF.md`, `docs/PITCH_DECK_OUTLINE.md`, and `docs/COI_RISK_MANAGEMENT_PLAN.md` are conservative stakeholder-sharing drafts derived from the dossier.
- `docs/user-guide.md` is the draft user-facing guide.
- `docs/user-guide-foundation.md` turns this product map into tutorial, hint, and training material.
- `docs/layman-language-review.md` records wording principles and copy-review ideas.

Use this README when asking, "What does CareAround SG currently do, and how do the pieces fit together?"

Use the release and regression docs when asking, "How do we avoid breaking something before shipping?"
