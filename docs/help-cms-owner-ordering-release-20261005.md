# Owner CMS ordering and publishing verification — 5 October 2026

## Owner interface

Source `fb6587bdfcd89f1a77c589433ce5cec20610d8db` delivers numbered, vertical topic rows and press-and-hold drag handles for topics, articles, sections and instructions. Space/Enter, arrow keys, Home/End and Escape provide keyboard ordering; the row menu retains an accessible move alternative. Stable item identities keep step attachments in place. Compact aligned edit controls and row menus replace scattered action buttons. Public reading layouts, content, database schema, roles and AI allowance are unchanged by this interface patch.

Local checks passed: server 1,146; client 917 plus five environment checks; locked maps 104; compiler 12 and CMS 59; focused ordering/adapter 50; fictional browser ordering 18 and desktop/390px layout two. The exact public source CI also passed. Browser automation is not physical-phone acceptance. Real owner navigation and the released controls were read in production without persisting a reorder or adding a synthetic article/media asset.

## Publishing recovery and persistent runtime setting

The first publication of the unchanged approved 48-article, 11-topic saved library completed quality gates, both uploads and 101 artifact checks, but its runner failed the final Worker-side readiness check. Public external Help/Guide/client identity checks passed, while the Worker could not retrieve its own custom-domain Help and Guide endpoints. Cloudflare documents `global_fetch_strictly_public` for this routing behavior: <https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public>.

A reviewed configuration-only update added that flag while preserving the compatibility date, existing flags, source tag, all binding identities/settings and every deployed module byte. The API rejected UUID-pinned inheritance before applying it; a subsequent supported `latest` inheritance update passed immediate identity checks in a single-writer release window. This endpoint has no documented atomic version precondition. The flag is now also retained in `server/wrangler.toml` so a later normal publication does not remove the fix.

The original GitHub run `37221246970` remains failed. Its original two asset retries and failure evidence are retained. A separate fresh check passed 101/101 byte/SHA-256/MIME artifacts with zero new retries, six ordinary HTML cases, public identity parity, health and DB-backed browsing. Operational recovery submitted the same immutable publication identity and unchanged original recovery references with the observed configuration-only Worker version; the endpoint's three live readiness checks all passed. The published pointer and saved workspace were promoted and the publication lock cleared.

Recovered content version: `2026-10-04.help-cms.1791135472846`; digest `96ec941bfbaebb1636c29bd4d7ea83e7d8ff5aee05c420da3f9dd764d253b12c`. Public base source: `fb6587bdfcd89f1a77c589433ce5cec20610d8db`; private ephemeral build source: `4286e177b7517236b315cf2468d03e444229778d`. Worker configuration version: `5b9872c3-f260-4062-8830-a87760660e3d`; Pages deployment: `a53c4bce-4586-4dc3-a852-cc036f406a1b`.

The permanent flag candidate passed the full 1,146 server tests and Worker dry-run. A new normal CMS publication from the newly pinned public source remains required to establish that future jobs retain this fix. Its final evidence belongs in the local release handoff; this document does not claim that future acceptance has already run. Ordinary app builds must continue to respect the live-content guard and cannot replace the private publication with an older public-repository baseline.

No database migration, resource write, new media publication, model call, AI renewal or budget change occurred. Existing restricted guidance and private drafts remain outside public source history.
