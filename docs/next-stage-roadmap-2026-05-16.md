# CareAround SG Next-Stage Roadmap

Date: 2026-06-08

Purpose: capture the next practical development sequence after the Region, Asset Access, Organisation governance, Admin Region Scope, Support Coverage, Audit Trail, shared confirmation dialog, inline feedback, and Discover location badge work.

## Current Baseline To Preserve

- Public Discover is live with display-only location relevance cues: `Recommended for you`, `Recommended for this location`, and the audience-zone star badge. These cues must not change ranking, sorting, filtering, visibility, saved-map behavior, or the distance pill.
- Resource Owner/Staff access remains the operational editing lane. Organisation access, Org Groups, Region Groups, and Admin Region Scope do not grant resource edit rights by themselves.
- Organisation governance covers access lists, linked assets, covered offerings, and agreements. It is not an approval workflow for every partner collaboration.
- Admin support coverage uses Admin Region Scope and user profile location to help route support. It does not create Discover relevance or resource ownership.
- Audit Trail records meaningful governance/resource changes and excludes everyday browsing, personal map actions, and AI chat/querying.
- The 5 security review findings are intentionally KIV until after the live production demo unless the user explicitly reopens them.

## Recommended Order

1. **Demo stability window**
   - Keep pre-demo work to documentation, rehearsals, and low-risk performance polish that is already scoped.
   - Do not mix parked security fixes, schema work, broad IAM changes, or new product surfaces into the demo window.
   - Keep docs-only work local unless the user asks to push.

2. **After-demo security remediation**
   - Fix the 5 parked security findings one at a time.
   - Start with the auth rate-limit bypass, then CSRF/origin protection for cookie-authenticated share creation, public payload minimisation, session JWT slimming, and dependency triage/upgrades.
   - Add tests and a regression-ledger row for each fix before deployment.

3. **Personal Resource Notes for My Map**
   - Lowest-risk user-facing feature from the current list.
   - Adds immediate value to caregivers and users who already build My Maps.
   - Should start as private owner-only notes, not shared-map notes.

4. **User Alerts / Notifications V1**
   - Start with in-app alerts only.
   - Use low-risk events first: resource changed, saved resource hidden, map share status, profile reminder, staff review task.
   - Defer WhatsApp, SMS, and email notifications until consent, templates, audit, and retention are designed.

5. **Partner / Organisation Analytics V1**
   - Start with aggregate, privacy-safe reporting.
   - Define metrics before implementing dashboards.
   - Use small-count suppression and clear reporting boundaries before showing partner-facing insights.

6. **AI Social Prescribing**
   - Start with rule-based, explainable matching before generative recommendations.
   - Treat suggestions as planning aids, not medical, clinical, financial, legal, or official advice.
   - Require human review for staff-assisted shortlist workflows.

## Feature Briefs

### After-Demo Security Remediation

Orchestrator lenses: System Architect, Backend Platform Engineer, Frontend Product Engineer where UI/session flows are touched, Privacy/Governance Reviewer, QA/Regression Lead.

V1 goal:

- Reduce the known post-review security risks without destabilising the demo-tested product surface.
- Fix one security finding per narrow branch/release wherever possible.
- Keep each fix tied to tests, regression-ledger evidence, and a clear release note.

Recommended sequence:

1. Harden auth rate limiting so arbitrary rotated `X-Session-Token` values cannot bypass limits.
2. Add CSRF/origin protection for cookie-authenticated My Maps share creation.
3. Minimise public resource payloads so public users receive only fields needed for display.
4. Slim session JWTs so they carry less personal/access data.
5. Triage dependency advisories and upgrade or mitigate with targeted testing.

Out of scope before the live demo:

- Security refactors mixed into documentation refresh work.
- Broad auth/session rewrites.
- Schema or deploy configuration changes without a dedicated release gate.

First acceptance criteria:

- Each fix has a focused regression test proving the risky path is closed.
- Existing sign-in, Discover, My Directory, My Maps, Shared Maps, dashboard resources, and admin support flows still pass the relevant checks.
- Public UI wording does not claim security work is complete until the specific remediation has shipped and been verified.

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

### Partner / Organisation Analytics V1

Orchestrator lenses: Data/Analytics Engineer, Backend Platform Engineer, UI/UX Product Designer, Privacy/Governance Reviewer, QA/Regression Lead.

V1 goal:

- Define and show aggregate, privacy-safe metrics that help partners or organisation operators understand resource engagement and data quality.
- Start with operational metrics before user-behavior-heavy analytics.

Candidate metrics:

- Resource count by type and status.
- Listings missing key fields.
- Recently updated resources.
- Member-only offering count.
- Shared map/resource save counts only after aggregation rules are in place.
- Organisation coverage summaries for linked assets and covered offerings, without implying edit rights.
- Admin support workload summaries only after scope and small-count rules are agreed.

Out of scope for V1:

- Individual user tracking in partner dashboards.
- Cross-partner comparison rankings.
- AI-generated analytics narratives.
- Exportable analytics containing identifiable user behavior.

First acceptance criteria:

- Metrics have plain-English definitions.
- Partner/organisation-visible reports use only allowed asset and governance scope.
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
- Existing display-only location relevance cues, only as explanations for already-visible resources.

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
- AI output does not bypass visibility, eligibility, membership, resource ownership, Organisation access, Admin Region Scope, or Region/Audience Zone rules.

## Operating Notes

- Use the CareAround Orchestrator for every next-stage feature.
- Keep the live-demo window focused on stability and documentation unless the user explicitly reopens higher-risk work.
- Keep each feature in its own design, implementation, verification, commit, push, and deploy cycle.
- Prefer small production deploys during beta so production-only regressions are caught early.
- Update `docs/regression-ledger.md` when a new behavior becomes locked.
- Review privacy/terms copy before adding notifications, analytics, AI matching, or new user-generated notes.
- Do not claim the 5 parked security fixes are complete until each one is implemented, verified, and recorded.
