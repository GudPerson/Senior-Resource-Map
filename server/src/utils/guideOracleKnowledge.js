import { GUIDE_TOPICS } from './guideKnowledge.js';
import { createGuideFactIndex, guideFactContextMatches } from './guideFactRetrieval.js';
import { guideReviewedRelationFact, guideHiddenSavedResourceFact, guideProviderUsageLookup } from './guideProductRelations.js';

// Reviewed user-facing facts. The Obsidian map is a discovery aid, not a live
// authority: each addition here must be checked against the current app and
// regression ledger before it can be used in an answer.
export const GUIDE_ORACLE_VERSION = '2026-10-01.50';
const extraFacts = [
    { id: 'hidden-saved-resources', title: 'Hiding a public listing and existing saved entries',
        keywords: ['hidden listing saved copy', 'hide resource saved entry', 'provider hides saved programme', 'hidden saved place unavailable'],
        message: 'Hiding a public Place or Programme/service does not automatically remove people’s saved entries from My Directory. The saved entry can remain and be marked unavailable when that viewer can no longer see the listing. If the listing becomes visible to that viewer again, the same saved entry can become available again; other audience rules still apply. Hide/Show changes visibility and is separate from Delete. Removing your own saved entry is another action and does not delete the public listing. The Guide cannot inspect everybody’s saved list or confirm a particular person’s entry from this general question.',
        route: '/my-directory', evidence: 'server/src/controllers/favoritesController.js:216-223; server/src/utils/savedAssets.js:124-166,346-431; server/src/utils/visibility.js:17-86; server/src/controllers/hardAssetsController.js:1966-1972,2032-2036; server/src/controllers/softAssetsController.js:2045-2064,2220-2225,2238-2279', reviewed: '2026-10-01' },
    { id: 'guide-notification-controls', title: 'Changing notification preferences outside Guide chat',
        keywords: ['guide enable notifications', 'turn on alerts for me', 'can you mute notifications', 'guide change notification preferences'],
        message: 'The Guide can explain notification controls, but cannot change your preferences, mute or unmute resources, or enable message delivery from chat. To choose saved-resource updates, open Inbox → Updates → Notification preferences. For schedule changes, enable Saved schedule changes there, enable in-app notifications in Profile, and make sure that resource is not muted. Email, WhatsApp and SMS preferences do not enable external delivery in the current pilot. The Guide has not changed any setting and cannot confirm your current preferences or that an alert has fired from this general question.',
        route: '/help?tab=inbox', evidence: 'server/src/routes/guideActions.js:119-224; client/src/features/support/NotificationPanel.jsx:43-77; client/src/pages/dashboard/ProfilePage.jsx:541-575; server/src/utils/governance.js:258-262', reviewed: '2026-10-01' },
    { id: 'notification-delivery-channels', title: 'In-app and external notification channels',
        keywords: ['in-app updates', 'email notifications', 'whatsapp alerts', 'sms alerts', 'notification channels', 'external delivery'],
        message: 'In-app Updates and external messages are different. In the current CareAround notification pilot, email, WhatsApp and SMS choices in Profile record preferences only; external delivery remains disabled even when those choices are enabled. For a saved Programme schedule update, open Inbox → Updates and enable Saved schedule changes in Notification preferences. Profile in-app notifications must be enabled and that resource must not be muted. The Guide cannot confirm that a particular alert has fired from this general question. WhatsApp sign-in and contacting a provider are separate workflows.',
        route: '/help?tab=inbox', evidence: 'server/src/utils/governance.js:6-7,258-262; server/src/controllers/governanceController.js:1967-2008; server/src/utils/notificationRepository.js:8-14,31-52; client/src/pages/dashboard/ProfilePage.jsx:541-575; client/src/locales/en.js:1091-1092', reviewed: '2026-09-30' },
    { id: 'resource-export-context', title: 'Which resource workbook was downloaded?',
        keywords: ['exported resource workbook', 'downloaded resource spreadsheet', 'refresh a downloaded file', 'download tracks changes'],
        message: 'Which download do you mean? If it is Download Map Assets Excel from an owned My Map, the downloaded resource workbook is a snapshot and does not refresh when listings or the map change. Generate a new download when you need the map’s current resource list, and review provider details and private planning places before sharing it. A workbook from another screen has a different scope; tell me that screen or download label so I can give the matching steps. The Guide cannot re-export or upload a file for you.',
        route: '/my-directory', evidence: 'client/src/components/MyMapExcelExportButton.jsx:6-63; client/src/lib/myMapExcelExporter.js:87-97; client/src/lib/myMapAssetLedger.js:105-172', reviewed: '2026-09-30' },
    { id: 'offering-translation-review', title: 'Translate a managed Programme/service',
        keywords: ['translate a programme i manage', 'translate an offering', 'programme translation review', 'translate existing service', 'edit programme translation'],
        message: 'The Guide cannot translate or edit an existing Programme/service in chat. If Edit is available on the exact listing, open Manage My Resources → Offerings → Edit → Translate. Save its English content first, then review the language cards. The editor can fill missing translated text or refresh one language; check the wording and choose Save review. English remains the main version, and staff-edited wording is not overwritten automatically. The server checks permission for the selected listing.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:314-315,2151-2162,2175-2184; client/src/components/TranslationReviewPanel.jsx:109-242,245-427; client/src/lib/api.js:496-504', reviewed: '2026-09-29' },
    { id: 'saved-schedule-notifications', title: 'Updates when a saved Programme schedule changes',
        keywords: ['saved programme schedule notification', 'notify when saved programme changes date', 'saved schedule changes', 'calendar notification', 'programme date alert'],
        message: 'A saved Programme/service can produce an in-app Saved schedule changes update after its published Care Calendar schedule changes. Open Inbox → Updates and enable Saved schedule changes in Notification preferences. In-app notifications must also be enabled in Profile, and that resource must not be muted. Checks run after a change rather than promising an instant alert; enabling or unmuting starts from current information without a catch-up alert. This does not move your My Plans entry or book with the provider. The Guide cannot verify that a particular alert has fired from a general question.',
        route: '/help?tab=inbox', evidence: 'client/src/features/support/NotificationPanel.jsx:43-77; client/src/pages/SupportHubPage.jsx:25-68; server/src/utils/notificationDomain.js:40-115; server/src/utils/notificationProcessor.js:8-48', reviewed: '2026-09-29' },
    { id: 'shared-map-viewer-boundary', title: 'Who opened a Shared Map',
        keywords: ['who opened my shared map', 'who viewed my shared map', 'shared map viewers', 'shared map views'],
        message: 'The Guide cannot show who opened a Shared Map or identify viewers from chat. The reviewed My Map sharing controls let you inspect and update the published snapshot and stop sharing; I cannot verify an owner-facing viewer list or view-count report there. Review the content and link before sharing, and use Help to describe any reporting need without including other people’s details.',
        route: '/my-directory', evidence: 'client/src/components/ShareMapModal.jsx:270-435; server/src/controllers/sharedMapsController.js:310-329,475-500; server/src/routes/guide.js:120-324', reviewed: '2026-09-29' },
    { id: 'offering-template-delete', title: 'Delete an Offering template',
        keywords: ['delete an offering template', 'delete template', 'remove template', 'delete place versions', 'delete generated versions'],
        message: 'Deleting an Offering template also deletes all of its generated place versions. In Manage My Resources → Templates, review the template and its place versions before using that template’s Delete control and confirmation. If you mean removing only one place version, open Manage place versions and choose that version instead. There is no reviewed restore workflow to promise from chat. The Guide cannot delete either one for you; the server checks the exact template or place-version permission.',
        route: '/dashboard/resources', evidence: 'client/src/pages/dashboard/ResourcesPage.jsx:1768-1790,3410-3428,3890-3918; server/src/controllers/softAssetParentsController.js:532-588', reviewed: '2026-09-29' },
    { id: 'offering-template-propagation', title: 'Edit an Offering template and its place versions',
        keywords: ['edit offering template', 'update template', 'change template', 'template changes place versions', 'template propagation', 'place version override'],
        message: 'An Offering template holds shared content for its generated place versions. When an authorised person saves a template edit, shared fields are propagated to existing active versions unless a field has a local override. A place version can keep its own schedule or contact overrides; its visibility and availability are local controls. Review the affected versions before saving a broad change, and use Edit place version for local details. Editing the template does not automatically unhide or publish a hidden version. The Guide cannot edit either one in chat.',
        route: '/dashboard/resources', evidence: 'client/src/pages/dashboard/ResourcesPage.jsx:3410-3428,3430-3590; server/src/controllers/softAssetParentsController.js:443-530; server/src/utils/softAssetHierarchy.js:11-43,149-169,176-260', reviewed: '2026-09-29' },
    { id: 'offering-template-overview', title: 'Offering templates and place versions',
        keywords: ['offering template', 'programme template', 'parent template', 'new template', 'templates tab', 'generate place versions', 'create a template'],
        message: 'An Offering template is shared Programme/service content, not itself a public listing. If New Template is available to your account, open Manage My Resources → Templates, choose New Template, review Profile, Defaults, Visibility, Generate and Translate, then choose Create Template. Save the template before choosing Generate place versions for selected host Places. The server checks permission for the template and every host; each newly generated place version starts hidden until its local details and visibility are reviewed. An existing active version at a selected host is skipped. The Guide’s direct Create action is for one new Programme/service, not a template or batch of place versions.',
        route: '/dashboard/resources', evidence: 'client/src/pages/dashboard/ResourcesPage.jsx:2390-2415,2640-2655,3410-3450,3690-3782; client/src/components/SoftAssetTemplateForm.jsx:72,775-789; server/src/controllers/softAssetParentsController.js:317-441,590-671; server/src/utils/softAssetHierarchy.js:111-147', reviewed: '2026-09-29' },
    { id: 'admin-region-scope', title: 'Admin Region Scope',
        keywords: ['admin region scope', 'manage region scope', 'assign region scope', 'change admin region scope', 'region scope', 'which regions can an admin manage'],
        message: 'Region Scope assigns Subregions to an Admin account. A Super Admin can open Admin → Users, choose the exact Admin, then use Manage Region Scope to review and save its assigned Subregions. The server checks the current roles and prevents a scope change that would leave that Admin’s managed users outside the new scope. Region Scope controls scoped admin work; it does not grant editing of a Place or Programme/service, organisation access, or group access. A signed-in Admin can ask the Guide for this account’s current assigned Subregions; the Guide cannot show or change another account’s assignment in chat.',
        route: '/dashboard/admin', actionLabel: 'Open Admin', evidence: 'client/src/pages/dashboard/AdminPage.jsx:1060-1115,4148-4161,4424-4526; server/src/utils/adminRegionScope.js:45-85', reviewed: '2026-09-29' },
    { id: 'region-boundary-layers', title: 'Regions and Subregion boundaries',
        keywords: ['region configuration', 'configure regions', 'regions tab', 'region boundaries', 'subregion boundaries', 'mapping workbook', 'unmapped postcodes', 'create subregion', 'upload boundaries'],
        message: 'Admin → Regions shows three separate layers: Regions, operational Subregions, and Unmapped postcodes awaiting review. Only Subregion postcodes route accounts and resources. Super Admin can create or change Subregion metadata and load the three-layer mapping workbook. An Admin can upload or export boundary postcodes only for Subregions within their assigned scope; names, codes and deletion remain Super Admin controls. Upload Boundaries defaults to Add to existing boundaries. Replace listed subregions removes existing codes for affected Subregions first, so use it only for a planned rebuild after reviewing the file and confirmation. The Guide cannot inspect current mappings or upload or replace boundaries in chat.',
        route: '/dashboard/admin', actionLabel: 'Open Admin Regions', evidence: 'client/src/lib/roles.js:206-214; client/src/pages/dashboard/AdminPage.jsx:2944-3120,3127-3209; server/src/routes/subregions.js:1-12; server/src/controllers/subregionsController.js:430-488,569-692', reviewed: '2026-09-29' },
    { id: 'governance-group-membership', title: 'Governance group access',
        keywords: ['governance group member', 'coordination group member', 'org group access', 'region group access', 'add group member'],
        message: 'To change governance-group membership, open the authorised Org Groups or Region Groups panel, select the exact group, then use Group access to choose an eligible user and Staff or Admin role. An Org Group member must already have access to that organisation. Only an Organisation Admin or Super Admin may assign an Org Group Admin; only Super Admin may assign a Region Group Admin. The server checks the exact group and target role. Group roles support coordination; they do not grant editing, publishing or restricted-content rights over linked resources. The Guide cannot add or remove members in chat.',
        route: '/dashboard', evidence: 'client/src/components/admin/GovernanceGroupsPanel.jsx:604-667; server/src/utils/governanceGroups.js:165-199; server/src/controllers/governanceController.js:1183-1246', reviewed: '2026-09-29' },
    { id: 'governance-group-overview', title: 'Governance coordination groups',
        keywords: ['governance group', 'coordination group', 'governance coordination group', 'group access'],
        message: 'Governance coordination groups are separate from public Resource Groups in Manage My Resources. An Org Group belongs to one organisation; a Region Group can coordinate across organisations. Open the authorised group panel to select a group and review its coordination context. Group membership does not grant editing, publishing or restricted-content rights over linked resources. The group form has an Archived status, but the Guide cannot archive a group or verify recovery from chat; do not use a public Resource Group Delete control for this.',
        route: '/dashboard', evidence: 'client/src/components/admin/GovernanceGroupsPanel.jsx:432-613; server/src/utils/governanceGroups.js:78-80,86-192; server/src/controllers/governanceController.js:1018-1080,1183-1246', reviewed: '2026-09-29' },
    { id: 'governance-org-group', title: 'Create an Org Group',
        keywords: ['org group', 'organisation group', 'organization group', 'create org group', 'edit org group'],
        message: 'An Org Group is a coordination group for one organisation. An Organisation Admin can open Organisation Workspace, select an organisation they administer, then use Org Groups → New Group; Super Admin can use Admin → Organisations. Enter a name and status, review optional coordination notes and public wording, then choose Create Group. Select an existing Org Group and choose Save Group to edit its details. The selected organisation must allow new records for creation, and the server checks current permission and scope. This is not the public Resource Group form in Manage My Resources; the Guide cannot create or edit the group in chat.',
        route: '/dashboard/organization', evidence: 'client/src/components/admin/GovernanceOrganizationsPanel.jsx:1025-1031; client/src/components/admin/GovernanceGroupsPanel.jsx:432-600; server/src/utils/governanceGroups.js:86-122; server/src/controllers/governanceController.js:1082-1138', reviewed: '2026-09-29' },
    { id: 'governance-region-group', title: 'Create a Region Group',
        keywords: ['region group', 'regional coordination group', 'create region group', 'edit region group'],
        message: 'A Region Group is a governance coordination group that can link multiple organisations. Only Super Admin can create one: open Admin → Region Groups, choose New Group, enter a name and status, review any optional Region ID, coordination notes and public wording, then choose Create Group. Select an existing Region Group and choose Save Group to edit its details if permitted. The server validates the selected Region and permission. A Region Admin title alone does not grant creation. A Region Group is not a public Resource Group, and its role does not grant resource editing rights. The Guide cannot create or edit it in chat.',
        route: '/dashboard/admin', evidence: 'client/src/pages/dashboard/AdminPage.jsx:2709,2938; client/src/components/admin/GovernanceGroupsPanel.jsx:432-600; server/src/utils/governanceGroups.js:86-122; server/src/controllers/governanceController.js:1082-1138', reviewed: '2026-09-29' },
    { id: 'organization-workspace', title: 'Organisation Workspace',
        keywords: ['organisation workspace', 'organization workspace', 'organisation access', 'organization access', 'organisation admin', 'organization admin'],
        message: 'Organisation Workspace appears in the dashboard for accounts with active organisation access. Organisation Staff can view their assigned organisation context; Organisation Admin can manage its profile and access, subject to server checks. New organisation creation is not offered in that workspace. Organisation governance access alone does not give editing rights over a Place or Programme/service. The Guide cannot show organisation records or change access in chat; ask whether this account can open the workspace for a current access check.',
        route: '/dashboard/organization', evidence: 'client/src/lib/roles.js:136-150; client/src/App.jsx:55-77,227; client/src/pages/dashboard/OrganizationWorkspacePage.jsx:8-29; client/src/components/admin/GovernanceOrganizationsPanel.jsx:290-303,742-862; server/src/utils/governance.js:226-256; server/src/controllers/governanceController.js:864-894', reviewed: '2026-09-29' },
    { id: 'audit-trail', title: 'Audit Trail',
        keywords: ['audit trail', 'audit logs', 'find audit trail', 'view audit trail'],
        message: 'Audit Trail is a dashboard page for Super Admin and accounts with active organisation-admin access. It shows permitted governance and resource-change records, with Category, Action type and Organisation filters, Refresh and Load more. The server limits organisation admins to their organisations. Ask whether this account can open Audit Trail for a live access check. The Guide can also check up to five recorded resource updates today, yesterday or over the last seven days within current Audit Trail access; it does not display raw metadata or infer access from a job title.',
        route: '/dashboard/audit', evidence: 'client/src/App.jsx:55-77,226; client/src/lib/roles.js:159-161; client/src/components/admin/AuditTrailPanel.jsx:106-275; server/src/controllers/governanceController.js:2059-2155; server/src/utils/guideAuditActivity.js', reviewed: '2026-09-30' },
    { id: 'saved-versus-managed', title: 'Saved resources and managed resources',
        keywords: ['saved versus managed', 'saved and managed', 'my directory vs my resources', 'resources i manage', 'manage my resources',
            'heart a programme', 'heart a resource', 'save and edit', 'saved and edit'],
        message: 'Saving a Place or Programme/service with its heart adds it to My Directory for your own use. Saving does not itself give you permission to edit or manage that resource, and saving a Programme/service does not register or book you for it. You may have separate management rights; check Manage My Resources in the dashboard for Places and Programmes/services assigned to your account.',
        route: '/my-directory', evidence: 'My Directory; Manage My Resources; reviewed Save resources and Plans are not bookings topics', reviewed: '2026-09-28' },
    { id: 'saved-identity-privacy', title: 'Saving a resource and your identity',
        keywords: ['provider see my name when i save', 'saving shares my profile', 'heart a programme and provider identity', 'does bookmarking tell a provider who i am'],
        message: 'Using the heart saves the Place or Programme/service to your own My Directory. That Save action does not send your name or profile details to the provider, notify the provider that you saved the listing, register you, or link you as a Place member. My Directory is not a public saver list. Joining a Place through its membership link is separate: authorised Place managers can see membership details, including names. Contacting a provider or publishing a Shared Map is also separate from saving. The Guide cannot identify who saved a provider’s listing or check another person’s saved list.',
        route: '/my-directory', evidence: 'server/src/routes/favorites.js:12-15; server/src/controllers/favoritesController.js:216-269,271-340; server/src/controllers/membershipsController.js:10-83; server/src/utils/memberships.js:5-12,49-105; server/src/controllers/hardAssetsController.js:136-138,1063-1083,1672-1692', reviewed: '2026-10-01' },
    { id: 'guide-provider-identity-check', title: 'Checking what a provider has received',
        keywords: ['check provider received my name', 'verify my personal information was sent to a centre', 'provider already told my name'],
        message: 'The Guide cannot check whether a provider has received your name or personal information. It cannot inspect the provider’s messages, registration records or contact history. Saving a listing does not send your profile to its provider, but that does not establish what the provider received through membership, registration or other contact. For confirmation, contact the provider using the channels on its listing if available. This chat has not contacted the provider or verified delivery.',
        route: '/discover', evidence: 'server/src/routes/guide.js; server/src/routes/guideActions.js; reviewed saved-identity-privacy and provider-contact facts', reviewed: '2026-10-01' },
    { id: 'saved-versus-membership', title: 'Private bookmarks and Place membership',
        keywords: ['membership qr versus bookmark', 'joining a place same as saving', 'membership link versus private bookmark', 'difference between heart and joining'],
        message: 'Saving with the heart is a private bookmark in your My Directory. Joining a Place through its membership link or QR connects your signed-in account to that Place; it is a separate membership, not a saved resource. Authorised Place managers can see membership details, including names. Saving does not create that membership, and joining does not automatically save the Place or its Programme/service. Membership may help with member-only eligibility, but it does not register you for a Programme/service or grant editing rights. Review your memberships in Profile and your bookmarks in My Directory.',
        route: '/dashboard/profile', evidence: 'server/src/controllers/favoritesController.js:216-269,271-340; server/src/controllers/membershipsController.js:10-83; server/src/utils/memberships.js:5-12,49-105; reviewed saved-identity-privacy and place-membership facts', reviewed: '2026-10-01' },
    { id: 'saved-list-privacy', title: 'Who can see saved resources',
        keywords: ['who can see my saved resources', 'is my directory private', 'saved list visible to others'],
        message: 'My Directory loads the resources saved by your signed-in account; it is not a public list of everything you saved. A staff role alone does not grant another person a view of your whole saved list through My Directory or Guide chat. Publishing a Shared Map makes its selected snapshot available through that link, not your whole saved list. Review the shared snapshot before giving anyone its link.',
        route: '/my-directory', evidence: 'server/src/controllers/favoritesController.js:216-224,329-338; server/src/controllers/myMapsController.js:757-841; docs/user-guide.md:20-21', reviewed: '2026-09-29' },
    { id: 'other-account-saved-privacy', title: 'Another person’s saved resources',
        keywords: ['what resources did my colleague save', 'see what someone else saved', 'colleague saved list'],
        message: 'The Guide reads only the signed-in account’s saved resources and cannot show a colleague’s saved list from your chat. A colleague may choose to share a selected My Map snapshot, but that is separate from their whole My Directory. Do not use another person’s sign-in details; open My Directory for your own saved resources.',
        route: '/my-directory', evidence: 'server/src/controllers/favoritesController.js:216-224,329-338; server/src/utils/guideSavedResources.js:34-58; server/src/controllers/myMapsController.js:757-841', reviewed: '2026-09-29' },
    { id: 'save-place-separately', title: 'Save a Place separately from its Programmes',
        keywords: ['save a place without its programme', 'save place separately', 'save place without following programme'],
        message: 'A Place and its linked Programmes/services are separate resources. You can save the Place without saving each Programme/service; use the heart on any Programme/service you also want in My Directory. Saving either one does not register you for a Programme/service or give you permission to edit its listing.',
        route: '/discover', evidence: 'server/src/controllers/favoritesController.js:216-224,240-262; client/src/components/SaveAssetButton.jsx:40-75; reviewed Saved resources and managed resources fact', reviewed: '2026-09-29' },
    { id: 'my-places', title: 'My Places', keywords: ['my places', 'personal places', 'personal place', 'private place', 'planning location', 'planning locations', 'private planning', 'create a personal place', 'add a personal place', 'private planning place'],
        message: 'My Places in My Directory are private planning locations you can reuse across your own maps. Open My Places and choose Add personal place to create one. Removing a personal place from one map leaves it in My Places; deleting it from My Places removes it from every linked map. Saving a private planning location does not make it a public directory Place or assign it to you to manage.',
        route: '/my-directory?section=my-places', evidence: 'client/src/components/personalPlaces/PersonalPlacesSection.jsx:67-101,149-164; client/src/pages/MyDirectoryPage.jsx:28-34; server/src/controllers/personalPlacesController.js:470-501', reviewed: '2026-09-29' },
    { id: 'personal-place-address-edit', title: 'Edit a private My Place address',
        keywords: ['edit my personal place address', 'change my place address', 'update private planning place address', 'change address in my places'],
        message: 'For a personal place you own, open My Directory → My Places and choose Edit on that place. In the editor, update its postal code and address, check the location, then save. The server checks ownership when saving. This changes your private planning place, not a public directory Place; the Guide cannot edit it from chat.',
        route: '/my-directory?section=my-places', evidence: 'client/src/components/personalPlaces/PersonalPlacesSection.jsx:67-84,272-295; client/src/components/personalPlaces/PersonalPlaceEditorModal.jsx:345-390; server/src/controllers/personalPlacesController.js:423-451', reviewed: '2026-09-29' },
    { id: 'personal-place-sharing', title: 'Personal places and sharing',
        keywords: ['personal place shared map', 'personal places shared map', 'share my personal place', 'visitors see my personal places', 'personal place export', 'private planning locations shared', 'private planning locations spreadsheet'],
        message: 'Personal places are excluded from a published Shared Map. Your owner map and its resource-ledger downloads can include them, so review an export before sharing it with anyone. A personal place is not a public directory Place.',
        route: '/my-directory?section=my-places', evidence: 'server/src/utils/myMapDirectory.js:1201-1271; client/src/lib/myMapAssetLedger.js:105-172; client/src/lib/myMapExcelExporter.js:57', reviewed: '2026-09-29' },
    { id: 'map-membership', title: 'Saved resources and map membership',
        keywords: ['saved but not on map', 'resource on my map', 'add to map', 'remove from map', 'map membership', 'still in my directory'],
        message: 'Saving a resource adds it to My Directory. You choose separately whether to add it to a particular My Map. If a saved Programme/service is missing from a map, open My Directory → My Maps, choose that map and use its resource controls to add the Programme/service. Removing it from a map does not automatically unsave it from My Directory.',
        route: '/my-directory', evidence: 'Saved Resources; My Maps; docs/user-guide.md', reviewed: '2026-09-28' },
    { id: 'saved-to-shared-map', title: 'Saving versus publishing a resource on a Shared Map',
        keywords: ['save a place shared map automatically', 'saved resource appear on shared map', 'bookmark programme published map'],
        message: 'Saving a Place or Programme/service adds it to your My Directory, not automatically to any My Map or Shared Map. Add that saved resource to the particular My Map you own. A published Shared Map is a separate snapshot: explicitly update the shared version and preview it before visitors can see the changed map. The Guide cannot add or publish it for you.',
        route: '/my-directory', evidence: 'server/src/controllers/myMapsController.js:881-912,757-841; reviewed map-membership and map-studio facts', reviewed: '2026-09-29' },
    { id: 'map-studio', title: 'Map Studio views', keywords: ['map studio', 'studio changes', 'studio view', 'saved map view', 'map presentation', 'publish view'],
        message: 'Map Studio saves a presentation of a My Map. Saving or changing a Studio view does not by itself refresh the published Shared Map or its embedded presentation. Select the saved view when explicitly publishing or updating the shared snapshot, then preview the embedded result.',
        route: '/my-directory', evidence: 'Map Studio; Shared Maps; docs/regression-ledger.md', reviewed: '2026-09-28' },
    { id: 'plans-not-bookings', title: 'Plans are not bookings',
        keywords: ['my plans', 'plan attendance', 'calendar plan', 'reserve a place', 'reserve a seat', 'is it booked', 'booked', 'booking', 'registration', 'attending', 'signed up'],
        message: 'A personal plan records intended attendance. It is not a booking, registration, or confirmation from the provider. Check the provider’s current details and contact them when registration is needed.',
        route: '/dashboard/calendar', evidence: 'My Plans & Updates; Care Calendar', reviewed: '2026-09-28' },
    { id: 'provider-plan-lifecycle', title: 'Hiding a Programme and existing personal plans',
        keywords: ['hide my programme existing plans', 'unpublish sessions existing plans', 'turn off calendar sessions people planned', 'hidden programme my plans'],
        message: 'Hiding a Programme/service does not automatically delete an existing personal plan. While hidden, its current sessions are not offered as Care Calendar occurrences; turning off or unpublishing its sessions likewise does not delete a personal plan. A person can still see their own earlier plan in My Plans and may need to review a changed schedule in Updates. A plan is not a provider booking. The Guide cannot identify who planned the Programme or edit another person’s plans; check current details with the provider before relying on an old date.',
        route: '/dashboard/calendar?section=updates', evidence: 'server/src/controllers/calendarController.js:216-339; client/src/lib/careCalendarPlanning.js:58-123; server/test/calendarNotificationJourney.test.js:139-163', reviewed: '2026-09-30' },
    { id: 'provider-plan-privacy', title: 'Who planned a provider Programme',
        keywords: ['who planned my programme', 'members who added my programme to my plans', 'how many people planned my service', 'provider list of planned attendees'],
        message: 'The Guide cannot show a provider who added its Programme/service to My Plans, how many people planned it, or a member or attendee list. My Plans is private to each signed-in account; the Calendar read and removal paths check that account. A personal plan is not a registration or verified attendance record. Ask the provider about its own registration process if an official attendance list is needed, without putting member details in Guide chat.',
        route: '/help?tab=report', evidence: 'server/src/controllers/calendarController.js:216-246,514-528; server/src/utils/guidePlans.js:16-53; reviewed plans-not-bookings fact', reviewed: '2026-09-30' },
    { id: 'plan-a-session', title: 'Add a saved activity session to My Plans',
        keywords: ['add a session to my plans', 'add to my plans', 'plan an activity', 'plan a session', 'star a session', 'how do i plan a session', 'create a calendar plan', 'make a calendar plan'],
        message: 'Save the Offering first, then open Care Calendar and choose Calendar. On an active session, choose Add to My Plans. If it overlaps another plan, review the conflict warning before deciding whether to add it anyway. My Plans records intended attendance only; it is not a provider booking or registration. Confirm attendance with the provider.',
        route: '/dashboard/calendar?section=calendar', evidence: 'client/src/components/calendar/CalendarEventCard.jsx:91-121; client/src/pages/dashboard/CareCalendarPage.jsx:195-222; server/src/controllers/calendarController.js:384-449', reviewed: '2026-09-29' },
    { id: 'plan-schedule-update', title: 'Review a changed planned session',
        keywords: ['planned session changes', 'plan schedule changed', 'schedule changes after i plan', 'my plan changed', 'plan was cancelled', 'my session is cancelled', 'review calendar update', 'acknowledge schedule update', 'acknowledging a schedule update'],
        message: 'If an Offering schedule changes after you add a session to My Plans, your old choice is not moved automatically. Open Care Calendar > Updates to compare affected plans with current sessions. Remove an old plan and choose Add to My Plans on a current active session if needed. Acknowledging the update removes the notice; it does not add a new plan or book you with the provider. Recheck details with the provider before relying on a date.',
        route: '/dashboard/calendar?section=updates', evidence: 'client/src/components/calendar/CalendarUpdatesView.jsx:47-132; client/src/locales/en.js:311-317; server/src/controllers/calendarController.js:197-213', reviewed: '2026-09-29' },
    { id: 'calendar-personal-entry', title: 'Add a personal date to Care Calendar',
        keywords: ['personal appointment in care calendar', 'add my own appointment', 'add a personal calendar date'],
        message: 'Care Calendar shows planned sessions from saved Programmes/services and dated notes from your own My Maps. To add a personal date linked to a map resource, open that resource’s Map Notes, save a note, choose Add to Calendar, then enter its title and date. I cannot verify a general appointment-entry button outside those supported sources. A calendar entry is personal planning, not a provider booking.',
        route: '/dashboard/calendar', evidence: 'client/src/components/SharedMapDirectoryList.jsx:744-790; client/src/pages/dashboard/CareCalendarPage.jsx:266-291,369-405; server/src/controllers/calendarController.js:30-52,384-468', reviewed: '2026-09-29' },
    { id: 'plan-date-change', title: 'Change the date of a personal plan',
        keywords: ['change the date of a personal plan', 'move my planned session date', 'reschedule my own plan'],
        message: 'If your plan is a provider Programme/service session, its time follows that provider’s schedule. Remove the old session from My Plans and add a different current active session if one is offered; changing your plan does not change the provider’s schedule or registration. If you mean a dated My Map note, remove its calendar entry and use Add to Calendar on the saved note to choose another date.',
        route: '/dashboard/calendar?section=plans', evidence: 'client/src/components/calendar/CalendarEventCard.jsx:91-130; client/src/components/SharedMapDirectoryList.jsx:775-790; client/src/pages/dashboard/CareCalendarPage.jsx:266-291; server/src/controllers/calendarController.js:470-540', reviewed: '2026-09-29' },
    { id: 'resource-types', title: 'Places and Programmes/services',
        keywords: ['what is a place', 'what is a programme', 'what is a service', 'place vs programme', 'what is an offering'],
        message: 'A Place is a physical resource such as a centre or service office. A Programme/service is an activity or support offering; it may be linked to a Place. Their schedules, audiences and access details can differ.',
        route: '/discover', evidence: 'Places; Programmes & services; client/src/App.jsx', reviewed: '2026-09-28' },
    { id: 'town-maps', title: 'High-Detail Town Maps',
        keywords: ['town maps', 'download town map', 'high detail town maps', 'map library'],
        message: 'High-Detail Town Maps are downloadable town-map files in My Directory. They are separate from printing or exporting one of your own My Maps.',
        route: '/my-directory', evidence: 'High-Detail Town Maps; client/src/App.jsx', reviewed: '2026-09-28' },
    { id: 'resource-groups', title: 'Resource Groups',
        keywords: ['resource group', 'group resources', 'coordination team', 'collection of directory listings'],
        message: 'A Resource Group collects existing public Places and offerings, such as Programmes and services, into one directory collection. A governance coordination group is a different kind of group; membership there does not by itself grant editing rights to a resource.',
        route: '/dashboard/resources', evidence: 'Resource Groups; Coordination groups; Accounts & access', reviewed: '2026-09-28' },
    { id: 'group-other-provider-members', title: 'Another provider’s listing in a Resource Group',
        keywords: ['group include another provider', 'group include another organisation', 'group include another organization', 'another provider place in resource group'],
        message: 'A Resource Group can include an eligible public, non-hidden Place or Offering from another provider. Adding that listing to a Group does not transfer its ownership or give the Group manager permission to edit the member listing. You still need permission to edit the Group itself; check the exact Group in Manage My Resources before changing its members.',
        route: '/dashboard/resources', evidence: 'server/src/controllers/softAssetsController.js:1354-1421,1456-1507; client/src/lib/resourceListLoading.js:70-74; client/src/components/GroupAssetForm.jsx:66-88', reviewed: '2026-09-29' },
    { id: 'group-target-regions', title: 'Target Regions for a Resource Group',
        queryRequiresAny: ['group'],
        keywords: ['group target regions', 'resource group visible only in regions', 'target my resource group to certain regions'],
        message: 'In a Resource Group’s Visibility step, choose Public for everyone or Target region/s and select existing Regions. A target-region Group is shown only when the viewer is inside a selected Region boundary. The selected scope and your permission to change that Group are checked when saving; this does not change the visibility or ownership of its member listings.',
        route: '/dashboard/resources', evidence: 'client/src/components/GroupAssetForm.jsx:785-859; server/src/controllers/softAssetsController.js:1080-1195,1456-1507', reviewed: '2026-09-29' },
    { id: 'group-staff-visibility', title: 'Resource Group staff-only visibility boundary',
        keywords: ['resource group staff only', 'group visible only to staff', 'private staff resource group'],
        message: 'The current Resource Group Visibility step offers Public or Target region/s, not a staff-only audience. Target Regions limit where a Group is shown, not which staff role can view it. I cannot make a public Resource Group staff-only. If you mean a governance Org Group of people, that is a separate workflow.',
        route: '/dashboard/resources', evidence: 'client/src/components/GroupAssetForm.jsx:785-865; reviewed Resource Group and governance-group distinctions', reviewed: '2026-09-29' },
    { id: 'group-create', title: 'Create a Resource Group',
        keywords: ['how do i create a resource group', 'create a resource group', 'make a resource group', 'new group', 'add a group to manage my resources'],
        message: 'If New Group is available to your account, open Manage My Resources and choose New Group. Give the Group a name, choose its audience and owner, select existing public Places or offerings as members, review the preview, then save. A Group without an owner or public members is not ready for Discover. This is a Resource Group, not a governance coordination group; your account and selected scope are checked when saving.',
        route: '/dashboard/resources', evidence: 'client/src/pages/dashboard/ResourcesPage.jsx:2385-2423; client/src/components/GroupAssetForm.jsx:169-175,489-571; server/src/controllers/softAssetsController.js:1080-1195', reviewed: '2026-09-29' },
    { id: 'group-edit', title: 'Edit a Resource Group',
        keywords: ['how do i edit a resource group', 'edit a resource group', 'change resource group members', 'add a place to a resource group', 'remove a programme from a resource group', 'edit group members'],
        message: 'Open Manage My Resources and choose Groups. On a Group you are allowed to edit, choose Edit to change its details or selected members, review the updated preview, then save. Members must be eligible public, non-hidden resources. If Edit is not shown for that Group, this Guide cannot grant access. Changes to a governance coordination group use a separate workflow.',
        route: '/dashboard/resources', evidence: 'client/src/pages/dashboard/ResourcesPage.jsx:3038-3131,3590-3625; client/src/components/GroupAssetForm.jsx:524-571; server/src/controllers/softAssetsController.js:1354-1421,1456-1507', reviewed: '2026-09-29' },
    { id: 'asset-workbook-import', title: 'Import an asset workbook',
        keywords: ['import a workbook', 'import workbook', 'upload workbook', 'import a spreadsheet', 'upload a spreadsheet', 'import xlsx', 'import csv', 'bulk import resources'],
        message: 'Asset workbook imports are in Admin → Data Tools for Super Admin accounts. Choose the matching resource type; Standalone Offerings are separate from template-generated rollouts. Download the Excel template and review its Guide, Data and Reference sheets. Stable external keys drive updates; names do not. Upload Workbook starts the import immediately and may create or update rows, so check the file before uploading and review the Import Report afterward. CSV is a data-only fallback. This is separate from the Guide’s Programme/service draft-review-Create action; the Guide cannot import the file for you.',
        route: '/dashboard/admin', evidence: 'client/src/lib/roles.js:206-217; client/src/pages/dashboard/AdminPage.jsx:28-54,1686-1854,4193-4265; server/src/routes/admin.js:6-12; server/src/controllers/workbookController.js:2667-2725', reviewed: '2026-09-29' },
    { id: 'resource-edit', title: 'Edit a Place or Offering',
        keywords: ['edit a place', 'edit a programme', 'edit a program', 'edit a service', 'edit an offering', 'change a place', 'update an offering', 'change an offering'],
        message: 'Open Manage My Resources, choose Places or Offerings, then open the resource card and choose Edit if that control is available. Save the changes in its editor. Editing depends on the selected resource and is checked again by the server; appearing in My Directory because you saved it is not editing access. A template-generated Place version has inherited fields, so edit its parent template for those shared details.',
        route: '/dashboard/resources', evidence: 'client/src/pages/dashboard/ResourcesPage.jsx:1562-1600,2699-2812,3183-3295; server/src/controllers/hardAssetsController.js:1945-1975; server/src/controllers/softAssetsController.js:2045-2090', reviewed: '2026-09-29' },
    { id: 'offering-host-change', title: 'Change an existing Offering’s linked Place',
        keywords: ['move a programme to another place', 'move an offering to another place', 'change a programme host place', 'replace an offering linked place', 'switch the host place for a service'],
        message: 'For an existing standalone Programme/service you can edit, open Manage My Resources → Offerings → Edit → Host & coverage. In Host Locations, remove the old Place and select the new Place, then review the service area, audience, visibility and schedule before saving. If Edit or the new Place is unavailable, this Guide cannot grant access: the server checks your permission for both the Offering and each new linked Place. These steps do not establish a rehost control for a template-generated place version. The Guide cannot move an existing Offering in chat.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:315,575-627,1978-2036; client/src/pages/dashboard/ResourcesPage.jsx:3285-3287; server/src/controllers/softAssetsController.js:2045-2110,2240-2260', reviewed: '2026-09-30' },
    { id: 'offering-multi-host', title: 'One Offering linked to several Places',
        keywords: ['create one service at several places', 'one programme at multiple places', 'link multiple places to one offering', 'one service at two centres'],
        message: 'The standard standalone Offering editor can link one Programme/service to multiple Host Locations when those Places are in the same service area. An authorised manager can use New Offering, choose the Places in Host & coverage, then review Visibility and save. The server checks permission for each linked Place and, when editing, the Offering itself. If New Offering or a Place is unavailable, this Guide cannot grant that access. The Guide’s reviewed Create action currently prepares one Place-linked Programme/service; it cannot create one listing across several Places in chat. Template-generated place versions use a separate workflow.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:590-605,835-850,1978-2036; client/src/pages/dashboard/ResourcesPage.jsx:2395-2405; server/src/controllers/softAssetsController.js:1802-1840,2045-2110', reviewed: '2026-09-30' },
    { id: 'place-owner-transfer-boundary', title: 'Place ownership transfer versus staff access',
        keywords: ['transfer a place to another organisation', 'transfer place ownership', 'change place owning organisation'],
        message: 'I cannot verify a self-service control to transfer a Place to another organisation in the current Place editor, and the Guide cannot perform that transfer. The Place’s Access step manages individual Owners and Staff when the current account is allowed to do so; adding an Owner is not an organisation-ownership transfer. If a true transfer is needed, use Help to request review of the exact Place and intended organisation without sharing passwords or private account details.',
        route: '/help?tab=report', evidence: 'client/src/components/AssetForm.jsx:548-576,1309-1314; client/src/components/AssetAccessPanel.jsx:39-193; server/src/controllers/hardAssetsController.js:1979-1986; reviewed Place staff-access boundary', reviewed: '2026-09-30' },
    { id: 'place-contact-edit', title: 'Edit a Place’s public contact details',
        keywords: ['update place phone', 'change place phone', 'edit place contact', 'update place contact email'],
        message: 'Open Manage My Resources → Places, open the exact Place and choose Edit if that control is available. In Location, update its public Phone, WhatsApp contact, Contact email or Hours, then review and save. The WhatsApp contact is not a sign-in number. Saving or managing a different resource does not grant editing rights to this Place; the Guide cannot change the listing for you.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:1197-1255; server/src/controllers/hardAssetsController.js:1945-1975', reviewed: '2026-09-29' },
    { id: 'offering-contact-edit', title: 'Edit an Offering’s public contact details',
        keywords: ['change programme phone', 'update offering contact', 'edit service contact email', 'change programme contact details'],
        message: 'Open Manage My Resources → Offerings, open the exact Programme/service and choose Edit if available. In Profile → Public contact and action details, update its contact phone, WhatsApp contact, email or action link, then review and save. This changes the Offering’s details, not its linked Place’s contact fields. The server checks your permission for that listing; the Guide cannot edit an existing listing for you.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:1660-1723; server/src/controllers/softAssetsController.js:2045-2059,2190-2205', reviewed: '2026-09-29' },
    { id: 'offering-schedule-edit', title: 'Change an Offering’s published sessions',
        keywords: ['update offering schedule', 'change programme sessions', 'switch off offering schedule', 'turn off programme dates'],
        message: 'Open Manage My Resources → Offerings and choose Edit on a Programme/service you may edit. In Schedule, review the dated sessions or recurring weekly series and the public preview before saving. Turning off already published sessions asks for confirmation because upcoming sessions will leave the Offering and Care Calendar; people with personal plans must review the change. A changed schedule is not a provider booking cancellation, and the Guide cannot edit the existing Offering for you.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:1764-1878; server/src/controllers/softAssetsController.js:2165-2177,2248-2289; docs/regression-ledger.md', reviewed: '2026-09-29' },
    { id: 'listing-publication-boundary', title: 'Directory visibility and Resource Claims approval',
        keywords: ['resource claims publication approval', 'approve directory listing', 'approval to publish a place', 'approval for every listing'],
        message: 'The ordinary Place or Offering editor has its own directory visibility controls and permission checks. Resource Claims publication approval is a separate governed-pilot workflow: after Owner verification and an active agreement, a Super Admin can approve selected provider fields and public uses in personal Shared Maps or embeds. That approval is not the general create step for every Discover listing, and the governed-pilot workspace may be unavailable in the current app release. The Guide cannot approve a claim or publish an existing listing from chat.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:1261-1287,2038-2066; client/src/components/ResourceClaimsPanel.jsx:222-265; server/src/controllers/resourceClaimsController.js:667-741; server/src/controllers/softAssetsController.js:1758-1960; client/src/lib/governedPilotRelease.js:21', reviewed: '2026-09-29' },
    { id: 'resource-hide-delete', title: 'Hide, show or delete a managed resource',
        keywords: ['hide a place', 'hide an offering', 'hide a resource', 'unhide a place', 'show in app', 'hide from app', 'delete a place', 'delete an offering', 'delete a resource', 'hide vs delete', 'hide or delete', 'hiding and deleting', 'hiding vs deleting', 'bulk hide'],
        message: 'In Manage My Resources, Hide from app or Show in app changes a Place or Offering’s visibility when that card permits it; it is separate from Delete. The filtered Hide all and Unhide all controls show a count-and-filter confirmation and skip items this account cannot change. Delete has its own confirmation and removes the listing from the directory; the UI does not offer an undo. Check the exact resource and any linked Offerings before deleting a Place. Saving or unsaving in My Directory does neither of these things.',
        route: '/dashboard/resources', evidence: 'client/src/pages/dashboard/ResourcesPage.jsx:1562-1600,1887-1913,2554-2590,2764-2813,3280-3295,3830-3917; server/src/controllers/hardAssetsController.js:1968-1972,2075-2115; server/src/controllers/softAssetsController.js:2058-2064,2358-2393; docs/regression-ledger.md:1719-1743', reviewed: '2026-09-29' },
    { id: 'saved-resource-removal', title: 'Remove a saved resource from My Directory',
        keywords: ['remove a saved place', 'delete a saved place', 'remove a saved offering', 'delete a place from my directory', 'remove a place from my directory', 'unsave a place'],
        message: 'If you mean removing a Place or Offering from your own saved list, open My Directory and choose its Unsave or Remove saved control. This changes your saved list; it does not delete the public listing or remove that resource from a My Map. Review any confirmation before bulk removal.',
        route: '/my-directory', evidence: 'docs/user-guide.md:125-133; client/src/pages/MyDirectoryPage.jsx:493-531; docs/regression-ledger.md:1724-1740', reviewed: '2026-09-29' },
    { id: 'my-map-resource-removal', title: 'Remove a resource from one My Map',
        keywords: ['remove a place from my map', 'delete a place from my map', 'hide a place on my map', 'remove a resource from my map', 'hide a pin on my map'],
        message: 'If you mean removing a resource from one of your My Maps, open that map and use its resource controls. This changes that map’s membership; it does not unsave the resource from My Directory or delete the public listing. If you mean hiding its pin in a Map Studio view instead, that is a presentation change and the resource card remains available, so check which result you want before editing.',
        route: '/my-directory', evidence: 'client/src/pages/MyMapDetailPage.jsx:2934-2970; server/src/controllers/myMapsController.js:1107-1128; docs/regression-ledger.md:573-591', reviewed: '2026-09-29' },
    { id: 'remove-plan', title: 'Remove a session from My Plans',
        keywords: ['remove a programme from my plans', 'delete a programme from my plans', 'remove a session from my plans', 'delete a session from my plans', 'remove from my plans'],
        message: 'Open Care Calendar → My Plans and choose Remove from My Plans on the planned session. This removes your own calendar plan; it does not delete the provider’s Programme/service listing or cancel a provider booking. Check with the provider separately if you registered with them.',
        route: '/dashboard/calendar?section=plans', evidence: 'client/src/components/calendar/CalendarEventCard.jsx:108-115; client/src/pages/dashboard/CareCalendarPage.jsx:225-236,389-403; server/src/controllers/calendarController.js:514-540', reviewed: '2026-09-29' },
    { id: 'shared-map-copy', title: 'Copy a Shared Map',
        keywords: ['copy a shared map', 'copy shared map', 'copy someone elses map', 'copy of a public map', 'edit a shared map', 'shared map copy'],
        message: 'Only the owner can add a saved resource to the original private My Map. Sharing publishes a view-only snapshot; it does not let a visitor add a Place to your original. When Copy to My Maps is available, a signed-in visitor can make a separate private map from the snapshot and edit their copy; it does not change the original map.',
        route: '/my-directory', evidence: 'server/src/controllers/myMapsController.js:881-912; server/src/controllers/sharedMapsController.js:404-471; client/src/pages/SharedMapPage.jsx:655-668', reviewed: '2026-09-29' },
    { id: 'my-map-exports', title: 'My Map downloads',
        queryRequiresAny: ['map'],
        keywords: ['download map notes', 'download map assets excel', 'my map export', 'map exports', 'map pdf', 'map spreadsheet', 'resource list from my map', 'download a resource list from my map'],
        message: 'An owned My Map has separate downloads for different purposes: Download Map Notes creates a PDF ledger, and Download Map Assets Excel creates a resource workbook. Use the map image or Print View when you need a visual map. A downloaded file is a snapshot; recheck important provider details before sharing it.',
        route: '/my-directory', evidence: 'client/src/components/MyMapPdfExportButton.jsx:6-66; client/src/components/MyMapExcelExportButton.jsx:6-63; docs/user-guide.md:191-202', reviewed: '2026-09-28' },
    { id: 'private-map-export-sharing', title: 'Share a private My Map workbook',
        keywords: ['export my private map and share', 'share private map excel', 'share my map spreadsheet'],
        message: 'For an owned My Map, Download Map Assets Excel creates a workbook for that map, not your whole My Directory. Your owner map export can include private planning places, so review the workbook before sharing it with anyone. Sending the file is a separate choice from publishing a Shared Map snapshot, and the file will not track later map changes.',
        route: '/my-directory', evidence: 'client/src/components/MyMapExcelExportButton.jsx:6-63; client/src/lib/myMapAssetLedger.js:105-172; server/src/utils/myMapDirectory.js:1201-1271', reviewed: '2026-09-29' },
    { id: 'directory-export-boundary', title: 'Export all of My Directory',
        keywords: ['export my whole my directory', 'export my entire my directory', 'download all saved resources', 'export all saved resources', 'download my directory as excel'],
        message: 'I cannot verify a one-click export of every saved resource in My Directory. Download Map Assets Excel belongs to an individual My Map and exports that map’s resource workbook, not your whole saved list. If you need a particular map’s list, open that owned map in My Directory and use Download Map Assets Excel. Review the file before sharing it, especially if your map contains private planning places.',
        route: '/my-directory', evidence: 'client/src/pages/MyDirectoryPage.jsx; client/src/components/MyMapExcelExportButton.jsx:6-63; client/src/lib/myMapExcelExporter.js:87-97; client/src/components/personalPlaces/PersonalPlacesSection.jsx', reviewed: '2026-09-29' },
    { id: 'offering-host-versus-membership', title: 'Programme host Places and personal membership',
        keywords: ['host place versus membership', 'programme host location same as user membership', 'linking programme places makes me a member', 'offering host and place membership difference'],
        message: 'A Programme/service’s Host Locations connect that listing to one or more public Places. A personal Place membership connects a signed-in person’s account to a Place through its membership link; these are separate relationships. Linking or changing a Programme’s host Places does not make you a member of those Places, register you for the Programme, or give you editing rights. People who saved the listing are not enrolled by that host change. A member-only Programme may require an active membership at a linked Place and other eligibility checks. An authorised manager changes hosts in the Offering editor; you can review your own Place membership in Profile. The Guide cannot grant membership, confirm your eligibility or edit an existing listing in chat.',
        route: '/dashboard/profile', evidence: 'server/src/db/schema.js:467-478,1361-1364; server/src/controllers/membershipsController.js:10-83; server/src/utils/eligibility.js:220-243,306-327; server/src/utils/softAssetScope.js:84-93; server/src/controllers/softAssetsController.js:2045-2320; client/src/components/AssetForm.jsx:1978-2036; reviewed offering-host-change and place-membership facts', reviewed: '2026-10-01' },
    { id: 'other-place-memberships', title: 'Another person’s Place memberships',
        keywords: ['friend place membership lookup', 'father joined places', 'another user linked centres'],
        message: 'The Guide cannot check or list another person’s Place memberships in this chat. Linked places in Profile shows the signed-in account’s own memberships; it is not a lookup of someone else. This reply has not checked anyone’s membership records or confirmed which Places they have joined. Place membership is separate from saving a resource, editing it and registering for a Programme/service. Keep personal profile details out of chat.',
        route: '/help', actionLabel: 'Open help', evidence: 'server/src/controllers/membershipsController.js:85-101; client/src/pages/dashboard/ProfilePage.jsx:153-177,451-522; server/src/routes/guide.js:85-369 (no membership-list adapter)', reviewed: '2026-10-01' },
    { id: 'place-membership-navigation', title: 'Review your linked Place memberships',
        keywords: ['where to see my place memberships', 'which centres have my membership', 'find linked places in profile'],
        message: 'To check your linked Place memberships yourself, sign in and open dashboard → Profile. Scroll below the profile form to Linked places, which shows Places joined through the membership QR flow, their status and the linking method. You do not need to send your personal profile fields to the Guide. This reply has not checked your membership records or confirmed that you belong to any Place. Linked places is separate from saved resources in My Directory and from resources you can edit in Manage My Resources; membership does not grant editing rights or Programme registration.',
        route: '/dashboard/profile', evidence: 'client/src/pages/dashboard/ProfilePage.jsx:153-177,451-522; client/src/locales/en.js:1063-1068; server/src/controllers/membershipsController.js:85-101; server/src/utils/memberships.js:107-148', reviewed: '2026-10-01' },
    { id: 'place-membership', title: 'Linked Place membership',
        keywords: ['place membership', 'membership qr', 'link membership', 'member only programme', 'membership means registered', 'membership grants editing'],
        message: 'A Place membership link can connect your signed-in account to that Place and may help with access to member-only Programmes/services. Other eligibility rules can still apply. Linking membership does not register you for a Programme/service or give you permission to edit the Place; check registration with the provider.',
        route: '/dashboard/profile', evidence: 'server/src/utils/eligibility.js:306-327; server/src/controllers/hardAssetsController.js:1903-1943; docs/user-guide.md:289-303', reviewed: '2026-09-28' },
    { id: 'offering-eligibility', title: 'Programme and service eligibility',
        keywords: ['member-only programme access', 'restricted programme eligibility', 'qualify for a programme', 'eligible for a service', 'programme access criteria'],
        message: 'A Programme/service may have profile criteria, and a member-only one also requires an active membership at a linked Place. An account role alone does not bypass those checks. The Guide cannot confirm your eligibility for a particular listing from chat; open its current details if visible and confirm participation requirements with the provider. Eligibility is separate from booking or registration.',
        route: '/discover', evidence: 'server/src/utils/eligibility.js:128-225,306-342; server/src/controllers/softAssetsController.js:1695-1756; server/test/eligibility.test.js:1-115', reviewed: '2026-09-29' },
    { id: 'offering-profile-missing', title: 'Missing profile details for restricted offerings',
        keywords: ['missing chas details', 'missing profile eligibility', 'incomplete profile restricted programme', 'programme locked missing data', 'required personal detail', 'blank profile detail'],
        message: 'When a Programme/service uses profile criteria and a required field is missing, CareAround can leave the access check unresolved. Complete the relevant field in your Profile and check the listing again. A missing field does not prove you qualify, explain every visibility difference, or register you with the provider; keep personal details out of Guide chat.',
        route: '/dashboard/profile', evidence: 'server/src/utils/eligibility.js:128-225; server/src/controllers/softAssetsController.js:1695-1756', reviewed: '2026-09-29' },
    { id: 'saved-not-eligible', title: 'Saving does not grant eligibility',
        keywords: ['saved restricted programme eligibility', 'save programme eligible', 'heart member only programme', 'saving grants access'],
        message: 'Saving a Programme/service to My Directory is a personal bookmark. It does not satisfy profile criteria, create Place membership, grant access to a restricted listing, or register you with the provider. Check the listing’s current details and ask the provider about participation.',
        route: '/my-directory', evidence: 'server/src/controllers/favoritesController.js:237-251; server/src/utils/eligibility.js:128-225,306-342', reviewed: '2026-09-29' },
    { id: 'offering-not-visible', title: 'A Programme or service is not visible',
        keywords: ['programme hidden from me', 'friend can see programme', 'cannot see restricted service', 'programme missing from discover'],
        message: 'I cannot determine from chat why a particular Programme/service is not visible to you. Public visibility, audience scope, profile criteria and active linked-Place membership are separate checks. Sign in and recheck Discover; if the listing is still missing, ask the provider or report the listing name without sharing private profile details.',
        route: '/discover', evidence: 'server/src/controllers/softAssetsController.js:1509-1756; server/src/utils/eligibility.js:306-342', reviewed: '2026-09-29' },
    { id: 'profile-update', title: 'Update your profile',
        keywords: ['update my profile', 'edit my profile', 'change my profile', 'save profile details', 'complete my profile'],
        message: 'Sign in, open Profile from the dashboard, update the fields you want to change, and choose Save Changes. Some details help CareAround evaluate restricted Programme/service criteria, but completing your profile does not guarantee eligibility or register you with a provider. Enter private details in Profile, not Guide chat.',
        route: '/dashboard/profile', evidence: 'client/src/App.jsx:224; client/src/pages/dashboard/ProfilePage.jsx:185-226,348-451; server/src/utils/eligibility.js:128-225', reviewed: '2026-09-29' },
    { id: 'embedded-map-notes', title: 'Notes in an embedded Shared Map',
        queryRequiresAny: ['map', 'embed', 'embedded', 'website', 'print'],
        keywords: ['notes in embedded map', 'private notes in embed', 'visitors see notes on website', 'embedded resource notes', 'embed print annotations'],
        message: 'The embedded Shared Map response omits My Map resource notes from its resource rows, including notes marked for sharing. Print annotations are a separate control: only annotations included in the published embed snapshot can appear as an overlay. Preview the actual embed before sharing it; the regular Shared Map page has different note controls.',
        route: '/my-directory', evidence: 'server/src/controllers/sharedMapsController.js:342-402; server/src/controllers/printAnnotationsController.js:143-160; client/src/pages/EmbeddedMapPage.jsx:258-276', reviewed: '2026-09-29' },
    { id: 'place-assignment-scope', title: 'Owner and Staff access is scoped to each Place',
        keywords: ['owner assignment on one place', 'staff role edit all places', 'owner manage another place', 'owner access every centre'],
        message: 'An active Owner or Staff assignment applies to the exact Place assigned. Being an Owner of one Place does not grant editing or management rights over every Place. Super Admin access is a separate exception; an organisation or Region Admin role alone is not a Place edit assignment. Open Manage My Resources and check Edit on the exact Place; the server checks current permission again before saving. This explains the rule, not whether your account currently has an assignment to a particular Place. The Guide cannot grant access or edit an existing listing for you.',
        route: '/dashboard/resources', evidence: 'server/src/utils/ownership.js:85-100; server/src/controllers/hardAssetsController.js:1945-1974; server/test/accessControlPrivacy.test.js:80-101,162-213', reviewed: '2026-10-01' },
    { id: 'place-staff-assignment', title: 'Assign staff to a Place',
        keywords: ['add staff to a place', 'assign place staff', 'invite staff to place', 'manage place access'],
        message: 'Open Manage My Resources, edit the saved Place, then open its Access step. Only a Super Admin or an Owner of that particular Place can add Staff or Owners; being able to edit as Staff is not enough. The server checks the target account’s organisation eligibility and existing access before saving. The Guide cannot add or remove staff.',
        route: '/dashboard/resources', evidence: 'client/src/components/AssetForm.jsx:1305-1316; client/src/components/AssetAccessPanel.jsx:39-115; server/src/utils/hardAssetStaff.js:53-73; server/src/controllers/hardAssetStaffController.js:247-292', reviewed: '2026-09-29' },
    { id: 'guide-create-scope', title: 'What the Guide can create',
        keywords: ['guide create place', 'guide create group', 'can you create a place', 'can you create a group', 'create resource for me'],
        message: 'The Guide’s direct Create action currently supports a Programme/service at a Place your account may manage: prepare a draft, review it, then choose Create. The Guide cannot submit a new public Place or Resource Group from chat. Those use the existing New Place or New Group forms in Manage My Resources when your account has permission.',
        route: '/dashboard/resources', evidence: 'server/src/routes/guideActions.js:75-224; client/src/features/support/GuidePanel.jsx:63-82; client/src/pages/dashboard/ResourcesPage.jsx:2385-2423', reviewed: '2026-09-29' },
    { id: 'guide-existing-resource-edit-scope', title: 'What the Guide can edit',
        keywords: ['can ai update an existing offering', 'can guide edit an existing place', 'can you change my programme listing', 'can you update a published service'],
        message: 'The Guide cannot edit an existing public Place or Offering, including its schedule. It can prepare a new Programme/service for your review and explicit Create when your account may manage its Place. To change an existing listing, open Manage My Resources, choose that exact resource and select Edit if available. Review and save the change there; the server checks permission for that listing.',
        route: '/dashboard/resources', evidence: 'server/src/routes/guideActions.js:75-224; client/src/pages/dashboard/ResourcesPage.jsx:1562-1600,2699-2812,3183-3295; server/src/controllers/softAssetsController.js:2045-2090', reviewed: '2026-09-29' },
    { id: 'volunteer-place-create-boundary', title: 'Can a volunteer create a Place',
        queryRequiresAny: ['volunteer'],
        keywords: ['volunteer create a place', 'volunteer add a centre', 'volunteer create resource for organisation'],
        message: '“Volunteer” is a person’s title; it does not establish their CareAround account’s permission to use New Place. Place creation depends on the signed-in account’s resource role or partner resource-staff access, and the selected location and scope are checked when saving. The person should use their own account to check New Place in Manage My Resources. The Guide cannot submit a public Place from chat.',
        route: '/dashboard/resources', evidence: 'server/src/controllers/hardAssetsController.js:952-955,1789-1815; server/src/utils/guideAccess.js:170-225; server/src/routes/guideActions.js:75-224', reviewed: '2026-09-29' },
    { id: 'regional-admin-place-edit-boundary', title: 'Region Admin and Place editing',
        keywords: ['region admin edit any place', 'regional admin edit every place', 'region admin role place edit'],
        message: 'A Region Admin role alone does not grant Edit on every Place. Current Place edit permission depends on Super Admin access or an active Owner or Staff assignment to that exact Place. Regional management visibility is separate from the listing’s Edit control; choose the exact Place in Manage My Resources to check its current permission. The server checks again before saving.',
        route: '/dashboard/resources', evidence: 'server/src/utils/resourceListScope.js:16-21,78-90; server/src/controllers/hardAssetsController.js:1085-1098,1945-1974; server/src/utils/ownership.js:85-100', reviewed: '2026-09-29' },
    { id: 'map-note-privacy', title: 'My Map note and annotation sharing',
        keywords: ['share this note', 'private map note', 'notes on shared map', 'can visitors see my notes', 'what notes can a visitor see', 'embed annotations'],
        message: 'Resource notes on your My Map stay private unless you enable Share this note for each note. An explicitly published or updated Shared Map snapshot includes the notes marked for sharing. Print annotations have a separate share setting, and a selected Map Studio view can hide annotations in an embedded presentation. Preview the published or embedded view before sharing its link.',
        route: '/my-directory', evidence: 'server/src/utils/myMapDirectory.js:649-704; client/src/components/SharedMapDirectoryList.jsx:748-785; server/src/controllers/myMapsController.js:757-841; server/src/controllers/printAnnotationsController.js:145-152; server/src/utils/embeddedMapPresentation.js:147-156', reviewed: '2026-09-28' },
    { id: 'my-map-note-edit', title: 'Add a note to a My Map resource',
        keywords: ['add a note to my map', 'write a note on my map', 'add notes to a resource in my map', 'edit a map resource note'],
        message: 'Open My Directory → My Maps and choose a map you own. Open Map Notes, choose the resource, then enter your note and check that it saves. Each note has its own Share this note switch, which is off by default. Review and explicitly update a published Shared Map before relying on a shared note there. The website embed omits resource notes from its resource rows.',
        route: '/my-directory', evidence: 'client/src/components/SharedMapDirectoryList.jsx:601-609,665-815,945-997; server/src/controllers/myMapsController.js:757-841; server/src/controllers/sharedMapsController.js:342-402', reviewed: '2026-09-29' },
    { id: 'discover-nearby', title: 'Find resources near you',
        keywords: ['support near me', 'resources near me', 'find nearby services', 'nearby programmes', 'search by postal code'],
        message: 'Open Discover and enter a 6-digit Singapore postal code, or choose Locate Me and allow browser location access. If your account has a home postal code, you can use Home as the search location. Browse the resulting Places and Programmes/services and open a listing for its current details; location is a search aid, not a confirmation of eligibility or availability.',
        route: '/discover', evidence: 'client/src/features/discover/DiscoveryFilterPanel.jsx:304-352,684-738; client/src/features/discover/useDiscoveryLocation.js:45-73,221-306; client/src/pages/DiscoverPage.jsx:2162-2183', reviewed: '2026-09-29' },
    { id: 'accessibility-search-boundary', title: 'Search for wheelchair-accessible resources',
        keywords: ['wheelchair accessible programme', 'wheelchair-accessible service', 'step free place near me', 'accessible programmes nearby', 'mobility accessible services'],
        message: 'In Discover, try a keyword such as “wheelchair” or “step-free” with a postal code or Locate Me. Search can match wording in a listing’s name, description or tags, but I cannot verify a dedicated wheelchair-accessibility filter or that every provider records this information. Open a result and confirm the exact access needs, route and facilities directly with the provider before visiting. A missing keyword result does not prove a resource is inaccessible.',
        route: '/discover', evidence: 'client/src/features/discover/DiscoveryFilterPanel.jsx:669-730,959-971; client/src/pages/DiscoverPage.jsx:220-250,648-689; reviewed Discover filters', reviewed: '2026-09-29' },
    { id: 'provider-contact', title: 'Contact a resource provider',
        keywords: ['contact a service provider', 'how to contact provider', 'phone number for a programme', 'email a provider', 'contact details on a listing'],
        message: 'Find the Place or Programme/service in Discover and open its details. If the provider supplied contact information, the details can show a phone number, email, WhatsApp, website or external link. Use the available provider channel to confirm current hours, fees, places and registration. The Guide cannot message or register with the provider or book a seat for you, and I cannot verify an in-app provider chat or booking here.',
        route: '/discover', evidence: 'client/src/components/ResourceDetailContent.jsx:315-322,709-790; client/src/pages/LegalPage.jsx:112-118', reviewed: '2026-09-29' },
    { id: 'provider-wait-time', title: 'Current provider wait time',
        keywords: ['current wait time', 'waiting time', 'queue length', 'queue time'],
        message: 'I cannot verify a Place or Programme/service’s current wait time from Guide chat. Open its listing in Discover and use any contact channel the provider has supplied to ask for a current estimate. A directory listing is not a live queue update.',
        route: '/discover', evidence: 'server/src/routes/guide.js:61-239; reviewed provider-contact fact; Guide has no live provider-queue lookup', reviewed: '2026-09-29' },
    { id: 'provider-availability', title: 'Confirm availability and fees',
        keywords: ['verified vacancies', 'programme vacancies', 'programme still has vacancies', 'verify programme vacancies', 'available slots', 'real time availability', 'current fees', 'confirm availability'],
        message: 'Some Programme/service details show an availability count when its manager enables that feature. Do not assume a listed service is free or that a remaining-seat count is live. A displayed count or fee is not a confirmed seat, price quote or provider booking. Resource details can change; contact the provider to confirm current availability, fees, eligibility and registration before relying on them.',
        route: '/discover', evidence: 'client/src/components/ResourceDetailContent.jsx:327-329,596-605; client/src/pages/dashboard/ResourcesPage.jsx:212-296,2064-2087; client/src/pages/LegalPage.jsx:112-118', reviewed: '2026-09-29' },
    { id: 'provider-usage-boundary', title: 'Provider usage information in the Guide',
        keywords: ['how many people saved my listing', 'who viewed my listing', 'provider listing views', 'provider save count'],
        message: 'The Guide cannot look up a provider report showing how many people viewed or saved a particular Place or Offering, or identify those people. Manage My Resources shows listing-management controls, which are different from usage analytics. I cannot verify a provider-facing usage report from Guide chat. If your organisation needs an official report, describe that need in a support report without putting other people’s details in chat.',
        route: '/help?tab=report', evidence: 'server/src/routes/guide.js:120-258; reviewed Guide account loaders; no provider usage read in the current Guide', reviewed: '2026-09-29' },
    { id: 'language-choice', title: 'Change the app language',
        keywords: ['change language to chinese', 'switch to mandarin', 'switch app language', 'change to malay', 'change to tamil'],
        message: 'Use the Language selector in the top navigation. The app offers English, Mandarin, Malay and Tamil; on a narrow screen the choices may appear as short labels such as 中文. This changes the app language. Check a particular provider listing directly if its own wording is missing or unclear.',
        route: '/discover', evidence: 'client/src/components/layout/Navbar.jsx:64-80; client/src/lib/i18n.js:1-17', reviewed: '2026-09-29' },
    { id: 'account-recovery-help', title: 'Help with account access',
        keywords: ['forgot my password', 'reset my password', 'recover my account', 'cannot sign in with password'],
        message: 'The Guide cannot reset a password or change sign-in details. Open Sign in and use a sign-in method already available to your account. If you still cannot access it, submit a support report describing the sign-in problem. Never put a password or verification code in Guide chat or a report.',
        route: '/help?tab=report', evidence: 'client/src/pages/AuthPage.jsx:216-331; client/src/App.jsx:196-221; server/src/utils/supportService.js:37-62', reviewed: '2026-09-29' },
    { id: 'account-deletion-help', title: 'Ask about deleting an account',
        keywords: ['delete my account', 'remove my account', 'erase my data', 'delete my personal data'],
        message: 'The Guide cannot delete your account or confirm that your personal data has been erased. I cannot verify a self-service deletion path here. Use Help to ask support for the current account-deletion process; describe your request without passwords, identity numbers or medical details. Sending a request is not confirmation that deletion has happened.',
        route: '/help?tab=report', evidence: 'server/src/controllers/userController.js:955-981; server/src/routes/guideActions.js:75-224; reviewed Report a problem topic', reviewed: '2026-09-29' },
    { id: 'website-embeds', title: 'Embed a Shared Map on a website',
        keywords: ['shared map on my website', 'embed a map', 'embed shared map', 'website embed', 'map on my website'],
        message: 'From the Share controls of a published My Map, add an approved website, enable Website Embed, save the embed settings, and copy the embed code. The embedded presentation uses the published snapshot rather than unsaved map changes. Preview it and review guest-visible content before placing it on a website.',
        route: '/my-directory', evidence: 'client/src/components/ShareMapModal.jsx:270-435; server/src/controllers/myMapsController.js:757-841; client/src/pages/EmbeddedMapPage.jsx:200-477', reviewed: '2026-09-29' },
    { id: 'public-browsing', title: 'Browse without an account',
        keywords: ['sign in to browse', 'account to browse', 'browse without signing in', 'browse as guest', 'need to sign in to browse'],
        message: 'You can browse public resources in Discover and open a published Shared Map without signing in. Sign in to save resources, create My Maps or copy someone else’s Shared Map into your own My Maps.',
        route: '/discover', evidence: 'client/src/App.jsx:196-221; docs/user-guide.md:320-328; server/src/controllers/sharedMapsController.js:404-471', reviewed: '2026-09-29' },
    { id: 'saved-resource-status', title: 'A saved resource is missing or unavailable',
        keywords: ['saved resource no longer available', 'saved resource missing', 'saved resource disappeared', 'why is my saved resource'],
        message: 'I cannot tell why a particular saved resource is missing or unavailable from a general question. Check My Directory for your saved item. If its listing has changed or disappeared, report the resource and what you expected to see. For current service availability or registration, confirm directly with the provider.',
        route: '/my-directory', evidence: 'My Directory; Report a problem; reviewed Save resources and Care Calendar topics', reviewed: '2026-09-29' },
];

const topicQueryRequirements = {
    maps: ['map'], sharing: ['map'],
    'detailed-map': ['map', 'detailed', 'zoom', 'block'],
    privacy: ['private', 'privacy', 'medical', 'password', 'identity', 'verification'],
};

export const GUIDE_ORACLE_FACTS = [
    ...GUIDE_TOPICS.map(({ id, title, keywords, message, route }) => ({
        id: `help-${id}`, title, keywords, message, route,
        evidence: `Reviewed Guide topic: ${id}`, reviewed: '2026-09-28',
        ...(topicQueryRequirements[id] ? { queryRequiresAny: topicQueryRequirements[id] } : {}),
    })),
    ...extraFacts,
];

const rankGuideFacts = createGuideFactIndex(GUIDE_ORACLE_FACTS);

export function guidePrivateResourceChangeIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:remove|delete|hide|unhide|unsave)\b/.test(query)
        || !/\b(?:resources?|places?|programmes?|programs?|services?|offerings?|sessions?|pins?|cards?)\b/.test(query)) return null;
    const removingFromOneMap = /\b(?:remove|delete)\b.{0,100}\b(?:from|off)\s+(?:one|a|my|the|this|that)\s+maps?\b/.test(query)
        || /\b(?:hide|unhide)\b.{0,100}\bon\s+(?:one|a|my|the|this|that)\s+maps?\b/.test(query);
    const removingFromDirectory = /\bunsave\b|\b(?:remove|delete)\b.{0,100}\b(?:from|out of)\s+my\s+directory\b/.test(query);
    // "Keep it saved/on my map" describes the desired result, not a second removal target.
    if (removingFromOneMap && !removingFromDirectory) return 'map';
    if (removingFromDirectory && !removingFromOneMap && !/\b(?:bulk|multiple|many|all)\b/.test(query)) return 'saved';
    const contexts = [
        /\bmy\s+maps?\b/.test(query) ? 'map' : null,
        /\bmy\s+plans?\b/.test(query) ? 'plans' : null,
        /\bmy\s+directory\b|\bsaved\b|\bunsave\b/.test(query) ? 'saved' : null,
    ].filter(Boolean);
    if (contexts.length > 1) return 'compound';
    // Keep bulk unsave on the established map-aware review and confirmation answer.
    if (contexts[0] === 'saved' && /\b(?:bulk|multiple|many|all)\b/.test(query)) return null;
    if (contexts[0] === 'saved' && /\b(?:remove|delete|unsave)\b/.test(query)) return 'saved';
    if (contexts[0] === 'map') return 'map';
    if (contexts[0] === 'plans' && /\b(?:remove|delete)\b/.test(query)) return 'plans';
    return null;
}

export function guideProviderUsageIntent(question = '') {
    return guideProviderUsageLookup(question);
}

function guideProviderPlanLifecycleIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    return /\b(?:hid(?:e|ing|den)|unpublish\w*|turn(?:ed|ing)?\s+off|switch(?:ed|ing)?\s+off)\b/.test(query)
        && /\b(?:plans?|planned)\b/.test(query)
        && /\b(?:people|members|users|others|their|someone|existing)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?|calendar|sessions?)\b/.test(query);
}

function guideProviderPlanPrivacyIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    return /\b(?:plans?|planned|planning)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?)\b/.test(query)
        && /\b(?:who|which\s+people|how\s+many|members|participants|attendees|users|visitors)\b/.test(query)
        && /\b(?:see|show|list|who|which|how\s+many|count)\b/.test(query)
        && !/\bwho\s+can\s+see\b/.test(query);
}

export function guideUnverifiedWorkflowIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (/\bmy\s+maps?\b/.test(query)
        && /\b(?:edit|change|update)\b/.test(query)
        && /\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b/.test(query)) return 'map-resource-edit';
    if (/\bmy\s+plans?\b/.test(query)
        && /\b(?:edit|change|update)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|sessions?)\b/.test(query)) return 'plan-resource-edit';
    if (/\b(?:my directory|saved)\b/.test(query)
        && /\b(?:hide|unhide)\b/.test(query)
        && /\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b/.test(query)) return 'saved-resource-hide';
    if (/\b(?:my maps?|map assets?|map notes?)\b/.test(query)
        && /\b(?:import|upload)\b/.test(query)
        && /\b(?:workbook|spreadsheet|excel|csv|xlsx)\b/.test(query)) return 'map-workbook';
    if (/\barchive\b/.test(query)
        && /\b(?:resources?|places?|programmes?|programs?|services?|offerings?|listings?|groups?)\b/.test(query)
        && !/\b(?:my maps?|my directory|my plans?|personal places?|saved)\b/.test(query)
        && !/\b(?:governance|coordination|org|region)\s+groups?\b/.test(query)) return 'resource-archive';
    return null;
}

export function answerGuideUnverifiedWorkflow(question = '') {
    const intent = guideUnverifiedWorkflowIntent(question);
    if (intent === 'map-resource-edit') return {
        topicId: 'unverified-workflow',
        message: 'Do you mean changing a resource’s place on your My Map, or editing the public Place or Offering listing? Those are separate controls. Open your My Map for map changes; public listing edits require access to that specific resource in Manage My Resources.',
        actions: [{ label: 'Open My Maps', route: '/my-directory' }],
    };
    if (intent === 'plan-resource-edit') return {
        topicId: 'unverified-workflow',
        message: 'Do you mean changing your own planned session or editing the provider’s Programme/service listing? Those are separate. Open Care Calendar → My Plans for your plan; public listing edits require access to that specific resource in Manage My Resources.',
        actions: [{ label: 'Open My Plans', route: '/dashboard/calendar?section=plans' }],
    };
    if (intent === 'saved-resource-hide') return {
        topicId: 'unverified-workflow',
        message: 'Do you mean removing a resource from your saved list in My Directory, or hiding the public listing from the app? Unsave affects your list only. Hide from app is a separate permission-checked control in Manage My Resources.',
        actions: [{ label: 'Open My Directory', route: '/my-directory' }],
    };
    if (intent === 'map-workbook') return {
        topicId: 'unverified-workflow',
        message: 'I cannot verify a workbook-upload workflow for My Maps. Asset Workbook Tools create or update directory resources in Admin Data Tools; they do not add a resource to one of your My Maps. Open My Maps to use its current resource controls, or ask about bulk directory import if that is what you mean.',
        actions: [{ label: 'Open My Maps', route: '/my-directory' }],
    };
    if (intent === 'resource-archive') return {
        topicId: 'unverified-workflow',
        message: 'I cannot verify an Archive control for a public Place, Offering or Resource Group. Manage My Resources has separate Hide from app and Delete controls when this account is allowed to use them. Hide changes visibility; Delete removes the listing after confirmation. Check the exact resource before choosing either; the Guide cannot perform that change.',
        actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }],
    };
    return null;
}

function eligibleGuideOracleFact(fact, query) {
    if (fact.id === 'offering-host-change'
        && !/\b(?:programmes?|programs?|services?|offerings?|activities?)\b.*\b(?:places?|centres?|centers?|hosts?)\b|\b(?:places?|centres?|centers?|hosts?)\b.*\b(?:programmes?|programs?|services?|offerings?|activities?)\b/.test(query)) return false;
    if (fact.id === 'offering-multi-host'
        && !/\b(?:programmes?|programs?|services?|offerings?|activities?)\b/.test(query)) return false;
    if (fact.id === 'place-owner-transfer-boundary' && !/\b(?:places?|centres?|centers?)\b/.test(query)) return false;
    if (fact.id === 'group-staff-visibility' && !/\b(?:resource|public)\s+groups?\b/.test(query)) return false;
    if (fact.id === 'saved-to-shared-map' && !/\bshared\s+maps?\b/.test(query)) return false;
    if (fact.id.startsWith('offering-template-') && /\b(?:workbook|spreadsheet|xlsx|csv|excel|boundary|metadata)\b/.test(query)) return false;
    if (fact.id === 'map-note-privacy' && !/\bmap\b|\bshare(?:d)?\s+link\b/i.test(query)) return false;
    if (fact.id === 'my-map-note-edit' && !/\bmap\b|\bmy\s+maps\b/i.test(query)) return false;
    return true;
}

export function guideOracleDiscoveryFacts(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!query || guideUnverifiedWorkflowIntent(query)) return [];
    // Discovery cannot widen an existing reviewed/private boundary.
    if (guideProviderPlanLifecycleIntent(query) || guideProviderPlanPrivacyIntent(query)
        || guidePrivateResourceChangeIntent(query) || guideReviewedRelationFact(query))
        return retrieveGuideOracleFacts(query);
    return GUIDE_ORACLE_FACTS.filter((fact) => eligibleGuideOracleFact(fact, query)
        && guideFactContextMatches(fact, query));
}

export function retrieveGuideOracleFacts(question = '', topicId = null, limit = 4) {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    // These actions are not covered by the reviewed Group or workbook facts.
    if (guideUnverifiedWorkflowIntent(query)) return [];
    if (guideProviderPlanLifecycleIntent(query)) return extraFacts.filter((fact) => fact.id === 'provider-plan-lifecycle');
    if (guideProviderPlanPrivacyIntent(query)) return extraFacts.filter((fact) => fact.id === 'provider-plan-privacy');
    const publicSaved = guideHiddenSavedResourceFact(query);
    if (publicSaved) return extraFacts.filter((fact) => fact.id === publicSaved);
    const privateChange = guidePrivateResourceChangeIntent(query);
    if (privateChange) {
        const id = ({ map: 'my-map-resource-removal', plans: 'remove-plan',
            saved: 'saved-resource-removal', compound: 'map-membership' })[privateChange];
        return extraFacts.filter((fact) => fact.id === id);
    }
    const relation = guideReviewedRelationFact(query);
    if (relation) return extraFacts.filter((fact) => fact.id === relation);
    return rankGuideFacts(query, { topicId, limit, eligible: (fact) => eligibleGuideOracleFact(fact, query) });
}

const factDestinationLabels = {
    '/discover': 'Open Discover',
    '/dashboard': 'Open dashboard',
    '/my-directory': 'Open My Directory',
    '/my-directory?section=my-places': 'Open My Places',
    '/dashboard/resources': 'Open Manage My Resources',
    '/dashboard/calendar': 'Open Care Calendar',
    '/dashboard/calendar?section=calendar': 'Open Care Calendar',
    '/dashboard/calendar?section=plans': 'Open My Plans',
    '/dashboard/calendar?section=updates': 'Open Care Calendar Updates',
    '/dashboard/profile': 'Open Profile',
    '/dashboard/admin': 'Open Admin Data Tools',
    '/dashboard/organization': 'Open Organisation Workspace',
    '/help?tab=inbox': 'Open Updates',
    '/help?tab=report': 'Draft a support report',
};
export const guideOracleFactAction = (fact) => ({ label: fact.actionLabel || factDestinationLabels[fact.route] || `Open ${fact.title}`, route: fact.route });
const factAction = guideOracleFactAction;

export function answerGuideOracleFact(question = '') {
    const groupQuery = String(question).toLowerCase().replace(/[’']/g, '');
    if (/\b(?:governance|coordination|org|organisation|organization|region)\s+groups?\b/.test(groupQuery)) {
        const id = /\bmembers?\b|\bgroup\s+access\b|\b(?:admin|staff)\s+roles?\b/.test(groupQuery) ? 'governance-group-membership'
            : /\bregion\s+groups?\b/.test(groupQuery) ? 'governance-region-group'
            : /\b(?:org|organisation|organization)\s+groups?\b/.test(groupQuery) ? 'governance-org-group'
                : 'governance-group-overview';
        const fact = extraFacts.find((item) => item.id === id);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    if (/\btemplates?\b/.test(groupQuery)
        && /\b(?:workbook|spreadsheet|xlsx|csv|excel|boundary|metadata)\b/.test(groupQuery)) {
        if (/^how\b/.test(groupQuery) && /\b(?:download|get|import|upload)\b/.test(groupQuery)) {
            const fact = extraFacts.find((item) => item.id === 'asset-workbook-import');
            return { topicId: fact.id, message: fact.message,
                actions: [factAction(fact)],
                sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
        }
        return null;
    }
    const templateQuestion = !/\b(?:workbook|spreadsheet|xlsx|csv|excel|boundary|metadata)\b/.test(groupQuery)
        && /\btemplates?\b|\bplace\s+versions?\b/.test(groupQuery);
    if (templateQuestion) {
        const id = /\b(?:delet\w*|remov\w*|recover\w*|restor\w*|undelet\w*)\b/.test(groupQuery) ? 'offering-template-delete'
            : /\b(?:edit\w*|chang\w*|updat\w*|overrid\w*|propagat\w*)\b/.test(groupQuery) ? 'offering-template-propagation'
                : 'offering-template-overview';
        const fact = extraFacts.find((item) => item.id === id);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const regionFactId = /\bregion\s+scope\b/.test(groupQuery)
        || /\b(?:which|what|show|see|view|my|assigned)\b.{0,50}\bsubregions?\b.{0,35}\b(?:assigned|administer|manage)\b/.test(groupQuery)
        ? 'admin-region-scope'
        : /\b(?:configur\w*\s+regions?|regions?\s+configur\w*|regions?\s+tab|regions?\s+boundar\w*|subregions?\s+boundar\w*|mapping\s+workbook|unmapped\s+postcodes?|creat\w*\s+(?:a\s+)?subregion|upload\s+boundar\w*)\b/.test(groupQuery)
            ? 'region-boundary-layers' : null;
    if (regionFactId) {
        const fact = extraFacts.find((item) => item.id === regionFactId);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const publicSaved = !guideProviderPlanLifecycleIntent(question) && !guideProviderPlanPrivacyIntent(question)
        && guideHiddenSavedResourceFact(question);
    if (publicSaved) {
        const fact = extraFacts.find((item) => item.id === publicSaved);
        return { topicId: fact.id, message: fact.message, actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const privateChange = guidePrivateResourceChangeIntent(question);
    if (privateChange) {
        const id = ({ map: 'my-map-resource-removal', plans: 'remove-plan',
            saved: 'saved-resource-removal', compound: 'map-membership' })[privateChange];
        const fact = extraFacts.find((item) => item.id === id);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const relation = guideProviderPlanLifecycleIntent(question) ? 'provider-plan-lifecycle'
        : guideProviderPlanPrivacyIntent(question) ? 'provider-plan-privacy' : guideReviewedRelationFact(question);
    if (relation) {
        const fact = extraFacts.find((item) => item.id === relation);
        return { topicId: fact.id, message: fact.message,
            actions: relation === 'saved-versus-managed'
                ? [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }] : [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const savedEffectQuestion = /\b(?:heart|bookmark|favou?rit(?:e|ed|ing)|sav(?:e|ed|ing))\b/i.test(question)
        && /\b(?:resource|place|programme|program|service|offering|activity|activities)s?\b/i.test(question)
        && /\b(?:edit|chang(?:e|ed|ing)|manag(?:e|ed|ing)|register(?:ed)?|enroll?(?:ed|ing|ment)?|book(?:ed|ing)?|sign(?:ed)?\s*up|confirmed?\s+(?:seat|place))\b/i.test(question);
    if (savedEffectQuestion && !/^how\b/i.test(String(question).trim())) {
        const fact = extraFacts.find((item) => item.id === 'saved-versus-managed');
        return { topicId: fact.id, message: fact.message,
            actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const mapRemovalQuestion = /\bremov(?:e|ed|ing)\b/i.test(question)
        && /\bmap\b/i.test(question) && /\b(?:directory|saved?)\b/i.test(question);
    const resourceTypeQuestion = /\bdifference\b/i.test(question)
        && /\bplaces?\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const savedListPrivacyQuestion = /\b(?:who|anyone|others?|other\s+people)\b.*\b(?:see|view|access)\b.*\b(?:saved|my\s+directory)\b/i.test(question)
        || /\b(?:staff|admins?)\b.*\b(?:see|view|access)\b.*\bmy\s+(?:saved\s+(?:resources?|list)|directory)\b/i.test(question)
        || /\b(?:saved\s+(?:resources?|list)|my\s+directory)\b.*\b(?:private|public|visible\s+to\s+others?)\b/i.test(question)
        || /\bsav(?:e|ing)\b.*\b(?:places?|programmes?|programs?|services?|resources?)\b.*\b(?:my\s+)?(?:whole\s+)?directory\b.*\bpublic\b/i.test(question)
        || /\b(?:colleague|co-?worker|team\s+member|friend)\b.*\b(?:see|view|access)\b.*\bmy\s+(?:saved\s+(?:resources?|list)|directory)\b/i.test(question);
    const otherAccountSavedQuestion = /\b(?:colleague|co-?worker|team\s+member|teammate|friend|another\s+(?:user|person)|someone\s+else)(?:['’]s)?\s+(?:sav(?:e|ed)|has\s+saved|favo(?:u)?rites?|directory)\b/i.test(question)
        && /\b(?:what|which|show|see|list|resources?|places?|programmes?|services?|directory)\b/i.test(question);
    const savePlaceSeparatelyQuestion = /\bsav(?:e|ing)\b.*\bplaces?\b.*\b(?:without|separately|not)\b.*\b(?:follow(?:ing)?|programmes?|programs?|services?|offerings?)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const otherPersonMapEditQuestion = /\b(?:someone\s+else|another\s+user|other\s+people|friends?|visitors?|invite|collaborat\w*)\b/i.test(question)
        && /\b(?:edit|change|modify|co-?edit)\b/i.test(question)
        && /\bmaps?\b/i.test(question);
    const otherPersonMapAdditionQuestion = /\b(?:someone\s+else|another\s+user|other\s+people|friends?|visitors?|colleagues?)\b/i.test(question)
        && /\b(?:add|insert|contribute)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|resources?)\b/i.test(question)
        && /\bmy\s+(?:private\s+)?maps?\b/i.test(question);
    const savedToSharedMapQuestion = /\b(?:sav(?:e|ed|ing)|bookmark|heart)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|resources?)\b/i.test(question)
        && /\bshared\s+maps?\b/i.test(question)
        && /\b(?:appear|show|visible|publish|automatic\w*)\b/i.test(question);
    const staffOnlyGroupQuestion = /\b(?:resource|public)\s+groups?\b/i.test(question)
        && /\bstaff[-\s]*only\b|\bonly\s+(?:to|for)\s+(?:my\s+)?staff\b/i.test(question);
    const providerRegistrationQuestion = /\b(?:register|enrol|enroll|sign\s+up|book)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?)\b/i.test(question)
        && /\b(?:carearound|through\s+(?:the\s+)?app|on\s+(?:this\s+)?site)\b|\b(?:can|could|would|will)\s+you\b/i.test(question);
    const providerSeatBookingQuestion = /\b(?:book|reserve|register)\b/i.test(question)
        && /\bseats?\b/i.test(question)
        && /\b(?:carearound|guide|you|through\s+(?:the\s+)?app)\b/i.test(question);
    const providerWaitTimeQuestion = /\b(?:wait(?:ing)?\s+time|queue\s+(?:length|time))\b/i.test(question)
        && /\b(?:current|today|now|right\s+now|how\s+long|places?|centres?|centers?|programmes?|programs?|services?|providers?)\b/i.test(question);
    const savedScheduleNotificationQuestion = (/\b(?:notify|notification|alert)\b|\b(?:get|receive|send|inbox)\b.{0,25}\bupdates?\b/i.test(question))
        && /\b(?:saved|programme|program|service|schedule|date)\b/i.test(question)
        && /\b(?:chang\w*|mov\w*|reschedul\w*|schedule)\b/i.test(question);
    const sharedMapViewerQuestion = /\b(?:shared\s+map|published\s+map)\b/i.test(question)
        && ((/\b(?:who|which\s+people|how\s+many)\b/i.test(question)
            && /\b(?:open\w*|view\w*|visit\w*)\b/i.test(question))
            || (/\b(?:any\s+visitors?|visitor\s+count|view\s+count)\b/i.test(question)
                && /\b(?:see|tell|know|track|count|check|show)\b/i.test(question)));
    const savedNotOnMapQuestion = /\b(?:saved|favo(?:u)?rit\w*)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|places?|resources?)\b/i.test(question)
        && /\b(?:not\s+showing|missing|not\s+on|doesn.t\s+appear)\b/i.test(question)
        && /\bmy\s+maps?\b/i.test(question);
    const savedToMyMapQuestion = /\b(?:save|saved|bookmark|heart)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|resources?)\b/i.test(question)
        && /\bmy\s+maps?\b/i.test(question)
        && /\b(?:appear|show|add|automatic\w*)\b/i.test(question);
    const savedResourceMissingQuestion = /\b(?:saved|favo(?:u)?rit\w*)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|offerings?|resources?|listings?)\b/i.test(question)
        && /\b(?:disappear\w*|missing|gone|unavailable)\b/i.test(question);
    const providerMessageQuestion = /\b(?:message|chat\s+with|dm)\b/i.test(question)
        && /\b(?:providers?|centres?|centers?)\b/i.test(question);
    const listedFreeQuestion = /\bfree\b/i.test(question)
        && /\b(?:services?|programmes?|programs?|offerings?|activities?|listings?|places?)\b/i.test(question)
        && !/\b(?:create|add|make|edit|change|update)\b/i.test(question);
    const remainingSeatsLiveQuestion = /\bremaining[-\s]*(?:seats?|spots?|places?)\b/i.test(question)
        && /\b(?:live|current|real[-\s]*time|up[-\s]*to[-\s]*date)\b/i.test(question);
    const otherProviderGroupEditQuestion = /\b(?:resource\s+groups?|groups?)\b/i.test(question)
        && /\b(?:another|other)\s+(?:providers?|organisations?|organizations?)\b/i.test(question)
        && /\b(?:edit|change|manage)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|offerings?|listings?)\b/i.test(question);
    const accountDeletionQuestion = /\b(?:delete|remove|erase)\b.*\bmy\s+(?:account|personal\s+data|data)\b/i.test(question)
        || /\bmy\s+(?:account|personal\s+data|data)\b.*\b(?:delete|remove|erase)\b/i.test(question);
    const personalAppointmentQuestion = /\b(?:add|create|put|schedule)\b.*\b(?:personal|own)\b.*\b(?:appointment|event|date)\b.*\b(?:care\s+calendar|calendar)\b/i.test(question)
        || /\b(?:care\s+calendar|calendar)\b.*\b(?:personal|own)\b.*\b(?:appointment|event)\b/i.test(question);
    const ownPlanDateQuestion = /\b(?:change|move|reschedule|edit)\b.*\b(?:date|time)\b.*\b(?:personal|own|my)\s+plans?\b/i.test(question)
        || /\b(?:personal|own|my)\s+plans?\b.*\b(?:change|move|reschedule|edit)\b.*\b(?:date|time)\b/i.test(question);
    const nearbyQuestion = /\b(?:near\s+(?:me|my\s+home)|nearby|postal\s*code|postcode)\b/i.test(question)
        && /\b(?:find|search|browse|look\s+for|show|support|resources?|places?|programmes?|services?)\b/i.test(question);
    const providerContactQuestion = /\b(?:contact|reach|call|email|whatsapp)\b/i.test(question)
        && /\b(?:providers?|services?|programmes?|programs?|places?|centres?|centers?|listings?)\b/i.test(question)
        && /\b(?:how|where|can i|could i|details?|number)\b/i.test(question)
        && !/\b(?:edit|change|update|set|remove)\b/i.test(question);
    const providerAvailabilityQuestion = /\b(?:vacanc(?:y|ies)|availability|available\s+(?:slots?|seats?|places?)|spots?\s+left|fees?|prices?|costs?)\b/i.test(question)
        && /\b(?:verify|confirm|guarantee|real\s*time|live|up\s*to\s*date|programmes?|services?|listings?|providers?)\b/i.test(question)
        && !/\b(?:edit|change|update|set|increase|decrease|adjust)\b/i.test(question);
    const languageChoiceQuestion = /\b(?:language|mandarin|chinese|malay|tamil)\b/i.test(question)
        && /\b(?:change|switch|set|choose|translate)\b/i.test(question);
    const offeringTranslationQuestion = (/\b(?:translate|translation)\b/i.test(question)
        || /\b(?:make|provide|get)\b.*\b(?:programmes?|programs?|services?|offerings?)\b.*\bavailable\s+in\s+(?:malay|mandarin|chinese|tamil)\b/i.test(question))
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question)
        && /\b(?:guide|ai|how|where|manage|edit|my|can i)\b/i.test(question);
    const accountRecoveryQuestion = /\b(?:forgot|forget|reset|recover)\b.*\bpassword\b|\bpassword\b.*\b(?:reset|forgot|recover)\b/i.test(question);
    const embeddedNoteQuestion = /\b(?:notes?|annotations?)\b/i.test(question)
        && /\b(?:embed(?:ded)?|website)\b/i.test(question);
    const mapNoteEditQuestion = /\b(?:add|write|create|edit)\b.*\bnotes?\b|\bnotes?\b.*\b(?:add|write|create|edit)\b/i.test(question)
        && /\b(?:my\s+map|map\s+resources?|resources?\s+(?:in|on)\s+(?:my\s+)?map)\b/i.test(question);
    const individualNoteShareQuestion = /\bshar(?:e|ed|ing)\b.*\b(?:one|single|individual|specific)\b.*\bnotes?\b|\b(?:one|single|individual|specific)\b.*\bnotes?\b.*\bshar(?:e|ed|ing)\b/i.test(question);
    const profileUpdateQuestion = /\b(?:update|edit|change|save|complete)\b/i.test(question)
        && /\b(?:my\s+)?profile\b/i.test(question);
    const mapExportQuestion = /\b(?:download|export|excel|pdf)\b/i.test(question)
        && /\b(?:my\s+)?maps?\b/i.test(question)
        && /\b(?:resources?|assets?|notes?|list|workbook)\b/i.test(question);
    const noteVisibilityQuestion = /\bnotes?\b/i.test(question)
        && /\b(?:share(?:d)?|visitors?|published|visible|seen|see)\b/i.test(question)
        && /\bmap\b|\bshare(?:d)?\s+(?:link|map)\b/i.test(question);
    const personalPlaceVisibilityQuestion = /\b(?:personal|private\s+planning)\s+(?:places?|locations?)\b|\bprivate\s+(?:address|planning)\s+pins?\b/i.test(question)
        && /\b(?:shar(?:e|ed|ing)|publish(?:ed)?|visitors?|public|exports?|downloads?|pdf|excel|spreadsheets?)\b/i.test(question);
    const fieldEditQuestion = /\b(?:edit|update|change|correct|replace)\b/i.test(question)
        && /\b(?:phone|email|whatsapp|contact\s+(?:details?|number|info)|hours?)\b/i.test(question);
    const offeringHostChangeQuestion = /\b(?:move|transfer|reassign|change|replace|switch)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?)\b/i.test(question)
        && /\b(?:places?|centres?|centers?|hosts?)\b/i.test(question)
        && /\b(?:another|different|new|other|from\s+one|linked|host)\b/i.test(question)
        && !/\b(?:my\s+maps?|my\s+plans?|care\s+calendar|saved)\b/i.test(question);
    const offeringMultiHostQuestion = /\b(?:create|make|link|add|run)\b/i.test(question)
        && /\b(?:one|single|same|a)\s+(?:programmes?|programs?|services?|offerings?|activities?)\b/i.test(question)
        && /\b(?:several|multiple|two|more\s+than\s+one|different)\s+(?:places?|centres?|centers?|hosts?)\b/i.test(question);
    const providerSaversQuestion = guideProviderUsageLookup(question)
        && /\b(?:sav(?:e|ed)|bookmark(?:ed)?|heart(?:ed)?)\b/i.test(question)
        && /\b(?:my|our)\b.{0,35}\b(?:programmes?|programs?|services?|offerings?|listings?|places?)\b/i.test(question);
    const placeOwnerTransferQuestion = /\b(?:transfer|reassign|move|change\s+(?:the\s+)?(?:owner(?:ship)?|owning\s+organi[sz]ation))\b/i.test(question)
        && /\b(?:places?|centres?|centers?)\b/i.test(question)
        && /\b(?:organisations?|organizations?|partners?|providers?|owners?|ownership)\b/i.test(question);
    const placeContactEditQuestion = fieldEditQuestion && /\b(?:places?|centres?|centers?)\b/i.test(question)
        && !/\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const offeringContactEditQuestion = fieldEditQuestion && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const offeringScheduleEditQuestion = /\b(?:edit|update|change|unpublish|switch\s+off|turn\s+off)\b/i.test(question)
        && /\b(?:schedules?|sessions?|dates?)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question)
        && !/\b(?:my\s+plans?|personal\s+plans?)\b/i.test(question);
    const listingPublicationQuestion = /\b(?:resource\s+claims?|directory\s+listings?|listing\s+approval)\b/i.test(question)
        && /\b(?:approv\w*|publish\w*|visib\w*)\b/i.test(question)
        || /\bapprov\w*\b.*\bpublish\w*\b.*\b(?:places?|programmes?|offerings?)\b/i.test(question);
    const otherProviderGroupQuestion = /\b(?:resource\s+groups?|groups?)\b/i.test(question)
        && /\b(?:another|other)\s+(?:providers?|organisations?|organizations?)\b/i.test(question)
        && /\b(?:add|adding|include|member)\b/i.test(question);
    const targetRegionGroupQuestion = /\b(?:resource\s+groups?|groups?)\b/i.test(question)
        && /\bregions?\b/i.test(question)
        && /\b(?:target|visible|shown|only|limit|restrict)\b/i.test(question);
    const plannedSessionShiftQuestion = /\b(?:planned|my\s+plans?)\b/i.test(question)
        && /\b(?:activity|session|programme|program|service|offering|timetable|entry)\b/i.test(question)
        && /\b(?:mov(?:e|es|ed|ing)|reschedul\w*|chang(?:e|es|ed|ing))\b/i.test(question)
        && /\b(?:date|time|schedule|day|timetable)\b/i.test(question)
        && /\b(?:what\s+(?:happens|if)|when|does|will)\b/i.test(question);
    const personalPlaceAddressEditQuestion = /\b(?:edit|update|change|correct)\b/i.test(question)
        && /\b(?:address|postal\s*code|location)\b/i.test(question)
        && /\b(?:my\s+places?|personal\s+places?|private\s+(?:planning\s+)?places?|planning\s+locations?)\b/i.test(question);
    const wholeDirectoryExportQuestion = /\b(?:download|export|excel|spreadsheet|csv)\b/i.test(question)
        && (/\b(?:my\s+directory|all\s+(?:my\s+)?saved\s+resources?|entire\s+(?:saved\s+)?list|whole\s+(?:saved\s+)?list)\b/i.test(question)
            || /\b(?:every|all)\b.{0,60}\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b.{0,40}\b(?:i\s+(?:have\s+)?saved|saved)\b/i.test(question))
        && !/\b(?:one|single|particular|specific)\s+(?:my\s+)?map\b|\b(?:on|in|from)\s+(?:one|a|my|the|this|that)\s+map\b/i.test(question);
    const guideExistingResourceEditQuestion = /\b(?:guide|ai|you)\b/i.test(question)
        && /\b(?:edit|update|change)\b/i.test(question)
        && /\b(?:existing|published)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|offerings?|listings?|schedules?)\b/i.test(question)
        && !/\bdraft\b/i.test(question);
    const privateMapExportQuestion = /\b(?:private|personal)\b/i.test(question)
        && /\bmy\s+maps?\b/i.test(question)
        && /\b(?:export|download|excel|spreadsheet)\b/i.test(question)
        && /\b(?:shar(?:e|ed|ing)|send|email|give)\b/i.test(question);
    const volunteerPlaceCreationQuestion = /\bvolunteers?\b/i.test(question)
        && /\b(?:create|add|make)\b/i.test(question)
        && /\b(?:places?|centres?|centers?)\b/i.test(question);
    const regionalAdminEditQuestion = /\b(?:region|regional)\s+admin\b/i.test(question)
        && /\b(?:edit|change|update|manage)\b/i.test(question)
        && /\b(?:any|all|every)\s+places?\b/i.test(question);
    const publishedStudioQuestion = /\b(?:map\s+)?studio\b/i.test(question)
        && /\b(?:shared\s+map|publish\w*|embed\w*)\b/i.test(question)
        && /\b(?:sav\w*|chang\w*|updat\w*|refresh\w*|live)\b/i.test(question);
    const accessibilityResourceQuestion = /\b(?:wheelchair|step[-\s]*free|mobility[-\s]*accessible)\b/i.test(question)
        && /\b(?:find|search|filter|nearby|near\s+me|resources?|places?|programmes?|programs?|services?|offerings?)\b/i.test(question);
    const forcedFact = guideProviderPlanLifecycleIntent(question) ? 'provider-plan-lifecycle'
        : guideProviderPlanPrivacyIntent(question) ? 'provider-plan-privacy'
        : mapRemovalQuestion ? 'map-membership' : resourceTypeQuestion ? 'resource-types'
        : providerSaversQuestion ? 'provider-usage-boundary'
        : offeringMultiHostQuestion ? 'offering-multi-host'
        : guideExistingResourceEditQuestion ? 'guide-existing-resource-edit-scope'
        : offeringHostChangeQuestion ? 'offering-host-change'
        : placeOwnerTransferQuestion ? 'place-owner-transfer-boundary'
        : savedToSharedMapQuestion ? 'saved-to-shared-map'
        : staffOnlyGroupQuestion ? 'group-staff-visibility'
        : otherAccountSavedQuestion ? 'other-account-saved-privacy'
        : savedListPrivacyQuestion ? 'saved-list-privacy' : savePlaceSeparatelyQuestion ? 'save-place-separately'
        : savedNotOnMapQuestion || savedToMyMapQuestion ? 'map-membership'
        : otherPersonMapEditQuestion || otherPersonMapAdditionQuestion ? 'shared-map-copy'
        : savedScheduleNotificationQuestion ? 'saved-schedule-notifications'
        : sharedMapViewerQuestion ? 'shared-map-viewer-boundary'
        : savedResourceMissingQuestion ? 'saved-resource-status'
        : providerRegistrationQuestion || providerSeatBookingQuestion || providerMessageQuestion ? 'provider-contact'
        : providerWaitTimeQuestion ? 'provider-wait-time'
        : listedFreeQuestion || remainingSeatsLiveQuestion ? 'provider-availability'
        : otherProviderGroupEditQuestion ? 'group-other-provider-members'
        : accountDeletionQuestion ? 'account-deletion-help'
        : personalAppointmentQuestion ? 'calendar-personal-entry'
        : ownPlanDateQuestion ? 'plan-date-change'
        : embeddedNoteQuestion ? 'embedded-map-notes'
        : regionalAdminEditQuestion ? 'regional-admin-place-edit-boundary'
        : publishedStudioQuestion ? 'map-studio'
        : volunteerPlaceCreationQuestion ? 'volunteer-place-create-boundary'
        : privateMapExportQuestion ? 'private-map-export-sharing'
        : personalPlaceAddressEditQuestion ? 'personal-place-address-edit'
        : wholeDirectoryExportQuestion ? 'directory-export-boundary'
        : accessibilityResourceQuestion ? 'accessibility-search-boundary'
        : nearbyQuestion ? 'discover-nearby' : providerContactQuestion ? 'provider-contact'
        : providerAvailabilityQuestion ? 'provider-availability'
        : offeringTranslationQuestion ? 'offering-translation-review'
        : languageChoiceQuestion ? 'language-choice'
        : accountRecoveryQuestion ? 'account-recovery-help'
        : mapNoteEditQuestion ? 'my-map-note-edit' : individualNoteShareQuestion ? 'map-note-privacy'
        : profileUpdateQuestion ? 'profile-update' : mapExportQuestion ? 'my-map-exports'
        : noteVisibilityQuestion ? 'map-note-privacy'
        : personalPlaceVisibilityQuestion ? 'personal-place-sharing'
        : placeContactEditQuestion ? 'place-contact-edit'
        : offeringContactEditQuestion ? 'offering-contact-edit'
        : offeringScheduleEditQuestion ? 'offering-schedule-edit'
        : listingPublicationQuestion ? 'listing-publication-boundary'
        : otherProviderGroupQuestion ? 'group-other-provider-members'
        : targetRegionGroupQuestion ? 'group-target-regions'
        : plannedSessionShiftQuestion ? 'plan-schedule-update'
        : guideProviderUsageIntent(question) ? 'provider-usage-boundary' : null;
    if (forcedFact) {
        const fact = extraFacts.find((item) => item.id === forcedFact);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const [fact] = retrieveGuideOracleFacts(question, null, 1);
    if (!fact || !extraFacts.includes(fact)) return null;
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!fact.keywords.some((keyword) => keyword.length >= 5 && query.includes(keyword))) return null;
    return { topicId: fact.id, message: fact.message,
        actions: [factAction(fact)],
        sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
}
