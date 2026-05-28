# CareAround SG Next-Stage Roadmap

Date: 2026-05-28

Purpose: capture the next practical development sequence after the Region, Asset Access, phone-auth, Orchestrator, My Map resource notes, import-refresh, governance, and auth-stability work already committed on GitHub `main`.

## Current Baseline

GitHub `main` and Cloudflare Pages Production are currently aligned on `b7af05c4` - `Fix mobile WhatsApp auth handoff`.

Personal Resource Notes for My Map is no longer future work. It has been implemented as My Map resource notes with:

- multiple notes per map resource
- per-note `Share this note` control
- private notes kept out of shared-map snapshots
- shared notes included only when marked for sharing and republished
- shared-note display and translation for shared-map receivers
- tests around note storage, snapshot filtering, summary badges, and translation

## Recommended Order

1. **State reset and baseline verification**
   - Keep the handoff, roadmap, README, and regression ledger aligned with GitHub `main`.
   - Run `npm run test:server` and `npm run build:client`.
   - Run smoke/local UAT when credentials and local servers are available.
   - Keep this work docs-only unless verification finds a real regression.

2. **User Alerts / Notifications V1**
   - Start with in-app alerts only.
   - Use low-risk events first: resource changed, saved resource hidden, map share status, profile reminder, staff review task.
   - Defer WhatsApp, SMS, email, and push notifications until consent, templates, audit, and retention rules are designed.

3. **Partner Analytics V1**
   - Start with aggregate, privacy-safe reporting.
   - Define metrics before implementing dashboards.
   - Use small-count suppression and clear reporting boundaries before showing partner-facing insights.

4. **AI Social Prescribing / Guided Matching**
   - Start with rule-based, explainable matching before generative recommendations.
   - Treat suggestions as planning aids, not medical, clinical, financial, legal, or official advice.
   - Require human review for staff-assisted shortlist workflows.

5. **Post-stabilization cleanup**
   - Clean up large or complex surfaces only in small slices after a green baseline.
   - Prioritize docs drift, stale branch cleanup, and focused component extractions over broad rewrites.

## Already Implemented And Locked

These are not next-stage feature candidates unless a new regression is found:

- Discover recovery and stabilization.
- My Directory saved assets.
- Private Maps interactive behavior.
- Private Maps print/export.
- My Map resource notes.
- Shared maps, including map-note sharing and shared-note translation.
- Dashboard resources/admin stabilization.
- Workbook import/export.
- Import Material refresh review and batch saves.
- Offering public contact/action field parity.
- Direct hard-asset Owner/Staff access and local audience zones.
- Restricted resource notes/files.
- Secure multilingual foundation and translation review.
- Client route recovery.
- Phone identity uniqueness.
- WhatsApp phone login/signup, same-device preflight, recovery guidance, and auth handoff.
- Pilot governance foundation.
- AI enrichment stabilization.

## Feature Briefs

### User Alerts / Notifications V1

Orchestrator lenses: System Architect, Backend Platform Engineer, Frontend Product Engineer, UI/UX Product Designer, Privacy/Governance Reviewer, QA/Regression Lead.

V1 goal:

- Add an in-app notification center and unread state.
- Support low-risk internal app events before any external messaging.
- Make notification categories clear and easy to disable later when preferences are added.

Safe first events:

- Saved resource changed or hidden.
- My Map share link published or unpublished.
- Profile details could improve relevance.
- Staff-only resource review task.
- Translation needs review.

Out of scope for V1:

- Email, SMS, WhatsApp, or push notifications.
- Marketing messages.
- Sponsored alerts.
- Automated AI-triggered alerts.

First acceptance criteria:

- User can open a notification list.
- User can mark notifications read.
- Notifications are scoped to the intended user or staff role.
- No external message is sent.
- Privacy/terms text is reviewed before notifications collect new behavioral data.

### Partner Analytics V1

Orchestrator lenses: Data/Analytics Engineer, Backend Platform Engineer, UI/UX Product Designer, Privacy/Governance Reviewer, QA/Regression Lead.

V1 goal:

- Define and show aggregate, privacy-safe metrics that help partners understand resource engagement and data quality.
- Start with operational metrics before user-behavior-heavy analytics.

Candidate metrics:

- Resource count by type and status.
- Listings missing key fields.
- Recently updated resources.
- Member-only offering count.
- Shared map/resource save counts only after aggregation rules are in place.

Out of scope for V1:

- Individual user tracking in partner dashboards.
- Cross-partner comparison rankings.
- AI-generated analytics narratives.
- Exportable analytics containing identifiable user behavior.

First acceptance criteria:

- Metrics have plain-English definitions.
- Partner-visible reports use only allowed asset scope.
- Small groups are suppressed or withheld where privacy risk exists.
- Reports do not imply service impact or outcome without evidence.

### AI Social Prescribing / Guided Matching

Orchestrator lenses: System Architect, AI/Recommendation Engineer, Data/Analytics Engineer, UI/UX Product Designer, Privacy/Governance Reviewer, QA/Regression Lead.

V1 goal:

- Build explainable, rule-based matching before AI recommendations.
- Use AI later for summaries and comparison drafts only after matching rules and review workflows are trusted.

Safe first matching inputs:

- Postal code or distance anchor.
- Resource category and tags.
- Eligibility fields that the user has intentionally provided.
- Membership and visibility rules.
- Availability and resource freshness where available.

Out of scope for V1:

- Clinical triage.
- Diagnosis.
- Emergency advice.
- Autonomous referrals.
- Black-box ranking.
- Sponsored or paid-placement ranking.

First acceptance criteria:

- Results explain why they appear.
- Users and staff can distinguish "planning aid" from official advice.
- Staff-assisted recommendations can be reviewed before sharing.
- AI output does not bypass visibility, eligibility, membership, Region, Audience Zone, or Asset Access rules.

## Operating Notes

- Use the CareAround Orchestrator for every next-stage feature.
- Keep each feature in its own design, implementation, verification, commit, push, and deploy cycle.
- Prefer small production deploys during beta so production-only regressions are caught early.
- Update `docs/regression-ledger.md` when a new behavior becomes locked.
- Review privacy/terms copy before adding notifications, analytics, AI matching, external messaging, or new user-generated data categories.
