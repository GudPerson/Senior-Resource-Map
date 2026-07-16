# CareAround Guide Knowledge And AI Controls

## Status

The public `docs/user-guide.md` is useful background, but it is not the source of truth for the in-app help assistant. It intentionally excludes operational workflows and has not kept pace with all current routes, role checks, access assignments, and recovery states.

The initial CareAround Guide knowledge is maintained in:

- `server/src/utils/helpKnowledge.js`
- `server/src/utils/helpAssistant.js`

## Source Of Truth Order

Help guidance must be checked in this order:

1. Current routes and route guards in `client/src/App.jsx`.
2. Current navigation visibility and capability checks in `client/src/components/dashboard/DashboardNavigation.jsx` and `client/src/lib/roles.js`.
3. Current page controls, labels, and recovery messages.
4. Current API authorization rules.
5. User-guide wording only when it still matches the live implementation.

Every verified help entry records the code or documentation files used to validate it.

## Assistant Boundary

CareAround Guide may:

- Explain navigation and current page controls.
- Give verified troubleshooting steps.
- Offer user-clicked links to approved routes.
- Explain why a workspace may be unavailable to the current account.

CareAround Guide must not:

- Make medical, care, eligibility, legal, or provider-availability decisions.
- Register users for services or promise service outcomes.
- Modify resources, profiles, maps, permissions, governance records, or account data.
- Receive or send passwords, identity numbers, medical details, private notes, access links, resource contents, or user identifiers to an AI model.
- Invent a route, permission, workflow, or support contact.

## Cost-Controlled Response Path

1. Match the question to the versioned verified-help catalog.
2. Return the deterministic answer when a topic is selected, AI is disabled, AI is unavailable, or quota is exhausted.
3. For matched free-text questions only, Workers AI may rewrite the verified answer in clearer language.
4. Unknown questions never go to Workers AI. They return a safe clarification response.

The production pilot enables only the bounded rewrite layer:

```text
HELP_ASSISTANT_AI_ENABLED=true
HELP_ASSISTANT_AI_MODEL=@cf/meta/llama-3.2-1b-instruct
HELP_ASSISTANT_AI_DAILY_LIMIT=50
HELP_ASSISTANT_AI_GATEWAY_ID=default
```

Repeated AI rewrites use the existing `MAP_CACHE` controls. AI Gateway logging is disabled for help requests so raw questions and responses are not stored there. The application keeps no server-side conversation history.

Set `HELP_ASSISTANT_AI_ENABLED=false` to disable model calls immediately without removing the deterministic assistant.

## Updating Help Safely

When a user-facing workflow changes:

1. Update the matching help entry in the same change.
2. Keep route actions within the client and server allowlists.
3. Add or update a focused test for matching, permissions, and guest behavior.
4. Update the public guide separately when the wording is suitable for a durable guide.
5. Increment `HELP_KNOWLEDGE_VERSION` when verified help behavior changes.
