# CareAround SG Next-Stage Roadmap

Date: 2026-05-16

Purpose: capture the next practical development sequence after the Region, Asset Access, phone-auth, and Orchestrator work.

## Recommended Order

1. **Documentation foundation**
   - Lock in the CareAround Orchestrator.
   - Refresh the README so the product map reflects Region, Asset Access, Audience Zones, phone auth, and current staff-access direction.
   - Keep this work docs-only, with no deploy required.

2. **Personal Resource Notes for My Map**
   - Lowest-risk user-facing feature from the current list.
   - Adds immediate value to caregivers and users who already build My Maps.
   - Should start as private owner-only notes, not shared-map notes.

3. **User Alerts / Notifications V1**
   - Start with in-app alerts only.
   - Use low-risk events first: resource changed, saved resource hidden, map share status, profile reminder, staff review task.
   - Defer WhatsApp, SMS, and email notifications until consent, templates, audit, and retention are designed.

4. **Partner Analytics V1**
   - Start with aggregate, privacy-safe reporting.
   - Define metrics before implementing dashboards.
   - Use small-count suppression and clear reporting boundaries before showing partner-facing insights.

5. **AI Social Prescribing**
   - Start with rule-based, explainable matching before generative recommendations.
   - Treat suggestions as planning aids, not medical, clinical, financial, legal, or official advice.
   - Require human review for staff-assisted shortlist workflows.

## Feature Briefs

### Personal Resource Notes For My Map

Orchestrator lenses: Frontend Product Engineer, Backend Platform Engineer, UI/UX Product Designer, Privacy/Governance Reviewer, QA/Regression Lead.

V1 goal:

- Let a signed-in map owner add private notes to resources inside their own My Map.
- Keep notes owner-only by default.
- Do not expose notes in shared maps, public snapshots, exports, or guest views.

Why first:

- It extends an already locked user journey instead of creating a new subsystem.
- It supports real caregiver planning: "why this option matters," "call first," "near Mum's home," or "ask about fees."
- It can be tested against the existing My Maps and Shared Maps privacy boundary.

Out of scope for V1:

- Shared-map recipient notes.
- Collaborative comments.
- Staff notes inside personal maps.
- AI-generated notes.
- Sensitive case-note workflows.

First acceptance criteria:

- Map owner can create, edit, and clear a note for a map resource.
- Notes are visible only in the owner's private map view.
- Shared map payloads and public views do not include private notes.
- Existing My Directory, My Maps, print/export, and shared-map behavior remain stable.

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

### AI Social Prescribing

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
- AI output does not bypass visibility, eligibility, membership, or Region/Audience Zone rules.

## Operating Notes

- Use the CareAround Orchestrator for every next-stage feature.
- Keep each feature in its own design, implementation, verification, commit, push, and deploy cycle.
- Prefer small production deploys during beta so production-only regressions are caught early.
- Update `docs/regression-ledger.md` when a new behavior becomes locked.
- Review privacy/terms copy before adding notifications, analytics, AI matching, or new user-generated notes.
