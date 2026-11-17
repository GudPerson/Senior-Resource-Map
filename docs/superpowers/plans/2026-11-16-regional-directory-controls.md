# Regional directory control clarity

Approved scope: make the existing owner controls easier to understand without changing saving, previewing, publishing, contact approvals, guest behavior or API contracts.

The optional Regional directory editor stays inside Share. Label its editable mode as a draft choice, use **Save draft**, **Discard unsaved changes**, **Preview draft**, and **Publish regional directory** / **Publish compact map**, and explain that only publishing changes the visitor view. Show **Currently published** separately, using the existing confirmed publication response and the parent map's sharing state. Loading, failed or unavailable readback must never imply that a compact map is published.

Implementation and verification:

1. Record the focused baseline and add failing coverage for sharing-state forwarding and the published-status mapping.
2. Add a small presentation helper and readback indicator; update labels and the existing browser selectors. Preserve all action handlers, request bodies, disabled rules and copy-link checks.
3. Run focused tests, the existing owner browser journeys, frozen-fixture verification, client regression coverage and the required client build. Capture owner controls with a different draft and published mode.
4. Record the local result in the regression ledger. No commit, push, deployment or live database action is included.

Architecture limitation: this freshly verified checkout has no Graft index. Its attempted call trace could not refresh, so this narrowly scoped change uses direct inspection of the existing editor, parent Share component and focused tests. Another checkout's index is not used.
