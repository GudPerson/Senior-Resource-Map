# Regional Discovery operator guide — local candidate

This is an isolated local implementation, using fictional fixtures. No schema was applied to a configured database and no pilot, deployment or production approval is implied. Compact embeds retain their existing path. An absent regional document means revision 0 and compact mode. Governance writes require the three new stores; an unavailable store returns 503 without request-path DDL.

## Schema and release preparation

The forward-only `server/drizzle/0011_regional_discovery.sql` creates only `my_map_regional_discovery_documents`, `subregion_enquiry_contact_fields` and `regional_embed_email_grants`. Existing resources, claims and publication permissions are unchanged. Run repository migration validation and the focused tests before a release. Use the normal release checklist and obtain separate authorisation to apply the migration to the selected database. No import, routing dataset, organisation pilot or global publication-field expansion is included.

After the operator selects the target environment using the existing secure configuration mechanism, `node server/scripts/bootstrap_regional_discovery_schema.js --verify` performs read-only verification. It checks required columns/types/nullability, presence of a primary key on each store, named foreign keys and their deletion rules, and named checks. It does not compare primary-key columns, foreign-key source/target columns or full CHECK expressions; this is a bounded installation check, not a complete structural drift audit. The reviewed migration and its snapshot remain the source for intended key structure. The separately authorised `--apply` option applies exactly migration 0011 in an atomic batch, then verifies it. Its SQL assumes the reviewed preceding schema; verify the actual target schema and approved adoption/journal state first. Do not execute migration 0000 on an existing database or substitute the generic boundary bootstrap. No canonical production apply/journal runner is established by this helper; it does not update a migration journal or prove that migrations 0000–0010 are enrolled. Exact target, migration 0011 authority, DDL comparison, backup/restore and realistic interruption rehearsal remain release gates. `--apply` is a one-time installation, not a repair/retry command after a successful application. Stop and reconcile any existing partial installation before trying again.

Rollback must retain an API that preserves both selected-venue scope and strict handling/stripping of the private embeddedRegionalDiscovery namespace. An older scope-aware API alone is insufficient. Prefer approved disable or UI rollback while retaining that capable API, the additive stores and audit history. Do not delete contact or approval records as part of a UI rollback. Retained curator drafts never publish themselves.

## Super Admin contact governance API

All examples below use paths relative to the existing authenticated API origin. Use an ordinary signed-in Super Admin session and the existing CSRF/origin protections; no credential belongs in these examples, URLs or logs. Both GET and PUT require Super Admin. Map curators, partners, regional admins and guests cannot approve or read the governance registry. All responses, including denials, use `Cache-Control: no-store`.

Read before editing:

```http
GET /api/regional-discovery-governance/subregions/91001/contacts/email
GET /api/regional-discovery-governance/subregions/91001/contacts/phone
GET /api/regional-discovery-governance/resources/hard/101/email-grant
```

IDs and addresses here are fictional. Contact fields are independently revisioned `email` or `phone`; resource type is `hard` or `soft`. An absent record returns its identity, `revision:0,status:"absent"`. A successful write returns the new revision. Supply the revision just read. A stale revision returns 409: reload and review the competing decision instead of overwriting it. Unknown body fields, invalid values and incomplete approval/withdrawal bodies return 400; a missing target returns 404.

Approve an exact home-SR destination after steward confirmation:

```http
PUT /api/regional-discovery-governance/subregions/91001/contacts/email
Content-Type: application/json

{"revision":0,"status":"approved","value":"enquiry@example.invalid","provenance":"Fictional steward approval reference SAMPLE-1"}
```

For phone, use the corresponding `/phone` path and a valid phone such as `+65 6000 0001`. Canonical stored email trims surrounding input whitespace and preserves mailbox/domain case exactly; canonical phone removes spaces, parentheses and hyphens, retaining an optional leading plus. The shared regional contact helper validates email dot-atom/domain syntax and phone destination syntax. Every action URL is server-derived: encoded `mailto:` or canonical `tel:`; no query, message body, extra recipient or personal context is accepted. Approval is recorded with actor, time, exact canonical value, SHA-256 binding and provenance. This establishes destination authority only after the real steward has confirmed it; syntax alone does not establish permission or routing.

Withdraw one field without affecting the other:

```http
PUT /api/regional-discovery-governance/subregions/91001/contacts/email
Content-Type: application/json

{"revision":1,"status":"withdrawn","provenance":"Fictional withdrawal reference SAMPLE-2","withdrawalReason":"Destination retired"}
```

Decision actor IDs in the two approval stores are positive historical provenance, independent of the live user table. Deleting an account retains those IDs, decision timestamps, values/status and provenance; the existing sensitive-audit event is also retained, with its live actor reference set to null by the existing audit schema. These historical IDs do not assert that the account still exists or still holds a role. An approved decision remains authoritative until explicit withdrawal; reading it never requires a current-user join. New decisions still require the existing live-account authentication, current Super Admin authorization and mandatory atomic audit.

Withdrawal requires nonblank provenance and reason. Omit `value` and `approvedOriginalEmail`; withdrawn records return neither a destination nor an action URL and clear the stored canonical value/hash. Previous approval actor/time remain as provenance, and the withdrawal actor/time are explicit. Reapproval needs the current revision and a fresh explicit value. Provenance/reasons are bounded references, not a place for personal case details.

## Original provider-email authority

The additional grant applies only to the Original email mode for one service. It never approves public images, descriptions or websites, and never changes owner-claim or global publishing stages. The submitted value must match the current canonical resource email:

```http
PUT /api/regional-discovery-governance/resources/hard/101/email-grant
Content-Type: application/json

{"revision":0,"status":"approved","approvedOriginalEmail":"sample+enquiry@example.invalid","provenance":"Fictional provider approval reference SAMPLE-3"}
```

Withdraw through the same route with `revision:1,status:"withdrawn",provenance,withdrawalReason`, omitting `approvedOriginalEmail`. An approved home-SR replacement needs only its own approved registry field and the curator's replacement intent; no per-provider grant is required for replacement. Email and phone decisions are independent. A later public producer must compare live canonical Original email with the frozen approval and current grant value/hash; a changed address, including a case change, must fail closed until reapproved and explicitly republished. A grant record is not authority for an arbitrary recipient or a grant of curator powers.

## Preview and audit evidence before activation

The local candidate now includes owner configuration/preview, explicit publication and guest producers. See [owner steps](regional-discovery-owner-guide.md) and the [implementation review and evidence](regional-discovery-implementation-review.md). Before activation, use the owner-only `POST /api/my-maps/:id/regional-discovery/preview` contract with `{revision,postalCode?}`. Verify Original/Hidden/home-SR modes independently; withdrawn email with approved phone; inside/outside/unresolved postals; a home-based unplotted service; and a withdrawn selected venue without fallback. A preview must not save a draft, publish, create a case or send a message. Never put a real senior's postal or personal context into request logs or analytics.

Approval and withdrawal write `sensitive_audit_logs` in the same database batch as the decision. Actions are `regional_contact_approved`, `regional_contact_withdrawn`, `regional_original_email_approved` and `regional_original_email_withdrawn`. Evidence includes actor, entity/resource identity, previous/new status and revision; destination, hash, provenance text and withdrawal reason are excluded from audit metadata. Inspect the authenticated existing audit trail and the governance GET to reconcile the decision; preserve both when reviewing a release. Audit failure rolls back the decision. A 409 writes no audit event.

A named network steward must confirm the actual local SRs, exact nonoverlapping postal membership, each service's effective zone/assigned SRs, curated public content, permitted distance points and current enquiry destinations. Synthetic passing tests prove local code behavior only. They do not prove real routing, permission, eligibility, capacity, admission, browser acceptance or production readiness.

## Release and activation remain separate

Local actual-App/browser and disposable-controller evidence is recorded in the implementation review. Its fix-round receipt supersedes the initial 29-case acceptance for desktop first use, compact chooser/reset and pending Studio writes; the original receipt remains historical. Catalogue GET and evaluation POST header checks use a fictional ambient cookie and retain presence booleans only. The API fixture rejects unexpected origins before matching allowed paths. These are widget-specific checks, not claims that normal owner/page navigation never uses cookies. It is not physical-device, real-coverage, configured-database or production acceptance. Keep organisation-pilot and real public-access activation unchanged. Final software release requires independent whole-branch review, exact-source CI and the project release checklist; protected current metadata/source-pin, schema/recovery and paired Worker/Pages gates remain. Original-email and enquiry-contact approval, exact postal membership and service coverage require a named operational steward. A curator cannot supply those approvals by saving or previewing settings.
