# Release Manifest: Asset Access, Overlapping Regions, and UAT Fixes

Date: 2026-05-15
Branch: `codex/partner-org-staff-handover`
Target: CareAround SG local UAT -> production deploy

## Release Scope

- Replace new partner-owner assignment flows with direct hard-asset Owner/Staff access.
- Keep legacy partner-owned reads available during transition, while removing partner as a new user-type assignment option.
- Support overlapping Region boundaries for managed resource read scope.
- Add standalone soft-asset access and service-region coverage support.
- Allow asset Owners/Staff to edit assigned places, linked offerings, standalone offerings, and restricted partner-only content according to role.
- Keep Super Admin as the only global override; Region Admins manage by assignment and region relevance, not automatic edit rights.
- Stabilize UAT-found UI issues:
  - offering cards render one per row in Dashboard Resources
  - offering action buttons wrap without clipping
  - guest Discover no longer shows partial counts when paginated resource fetches time out

## Schema And Runtime Notes

- Production runtime schema bootstrap remains disabled by default.
- Before Worker deploy, apply explicit schema setup to the target Neon database:

```bash
npm run bootstrap:boundary-schema --workspace=server
```

- New/updated schema surfaces include direct asset staff memberships, standalone soft-asset access/coverage, and region boundary helpers.

## Verification Evidence

Pre-deploy checks completed locally:

```bash
npm run test --workspace=server
# 220 tests, 220 pass, 0 fail

npm run build --workspace=client
# TypeScript and Vite production build completed
```

Local API smoke:

```bash
curl 'http://127.0.0.1:8787/api/hard-assets?page=1&pageSize=1'
# public hard total: 1576

curl 'http://127.0.0.1:8787/api/soft-assets?page=1&pageSize=1'
# public soft total: 48
```

Browser smoke:

- Guest `/discover` shows `All 1624`, `Places 1576`, and `Programme/service 48`.
- User UAT passed for Region overlap, asset Owner/Staff assignment, standalone soft assets, partner-role cleanup, dashboard resource access, and Discover count behavior after refresh.

## Deployment Plan

1. Confirm Cloudflare Wrangler authentication.
2. Run explicit Neon schema setup for production.
3. Deploy Worker API.
4. Deploy Cloudflare Pages client.
5. Run deployed health and smoke checks:
   - API health endpoint returns OK
   - deployed `/discover` renders stable public count
   - `/dashboard/resources` loads for Super Admin, Region Admin, asset Owner, asset Staff, and standard user cases
   - asset access assignment panel remains usable
   - standalone offering remains editable only through direct access or Super Admin

## Rollback Notes

- Client-only UAT fixes can be rolled back independently if needed.
- API/schema release should be treated as a coordinated deploy because the app expects new direct access tables and region coverage helpers.
- Legacy partner-owned data remains readable during the beta transition, so rollback should not require restoring partner login creation flows.
