import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_ORACLE_FACTS, answerGuideOracleFact, answerGuideUnverifiedWorkflow, guidePrivateResourceChangeIntent, retrieveGuideOracleFacts } from '../src/utils/guideOracleKnowledge.js';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';
import { answerGuideQuestion } from '../src/utils/guideKnowledge.js';
import { createGuideRoutes } from '../src/routes/guide.js';

test('Reviewed Oracle facts have stable sources and retrieve product distinctions', () => {
    assert.equal(new Set(GUIDE_ORACLE_FACTS.map((fact) => fact.id)).size, GUIDE_ORACLE_FACTS.length);
    for (const fact of GUIDE_ORACLE_FACTS) {
        assert.ok(fact.title && fact.message && fact.route && fact.evidence && fact.reviewed, fact.id);
        assert.match(fact.route, /^\//);
    }
    for (const [question, expected] of [
        ['What is My Places?', 'my-places'],
        ['How does Organisation Workspace work?', 'organization-workspace'],
        ['What is a Resource Group?', 'resource-groups'],
        ['How do I create a Resource Group?', 'group-create'],
        ['How do I edit a Resource Group?', 'group-edit'],
        ['How do I import a workbook to create programmes?', 'asset-workbook-import'],
        ['How do I edit a Place?', 'resource-edit'],
        ['How do I move a Programme from one Place to another?', 'offering-host-change'],
        ['How do I switch the host Place for a service?', 'offering-host-change'],
        ['Can I create one service at several Places?', 'offering-multi-host'],
        ['Can I transfer a Place to another organisation?', 'place-owner-transfer-boundary'],
        ['Can I change the owner of our Place to another organisation?', 'place-owner-transfer-boundary'],
        ['How do I hide a Place?', 'resource-hide-delete'],
        ['What is the difference between hiding and deleting a resource?', 'resource-hide-delete'],
        ['Can I delete a Place from My Directory?', 'saved-resource-removal'],
        ['How do I hide a Place on My Map?', 'my-map-resource-removal'],
        ['Can I delete a Programme from My Plans?', 'remove-plan'],
        ['Can I publish a Map Studio view?', 'map-studio'],
        ['Are saving a programme and booking it the same?', 'plans-not-bookings'],
        ['What is the difference between saved and managed resources?', 'saved-versus-managed'],
        ['If I heart a programme, can I edit it or am I registered?', 'saved-versus-managed'],
        ['I removed a centre from my personal map. Why is it still in My Directory?', 'map-membership'],
        ['Does my calendar plan reserve a place?', 'plans-not-bookings'],
        ['If I hide my Programme, do people who planned it still see it in My Plans?', 'provider-plan-lifecycle'],
        ['If I unpublish the sessions, are people’s existing plans deleted?', 'provider-plan-lifecycle'],
        ['Can I see who planned my Programme?', 'provider-plan-privacy'],
        ['What is the difference between a planning location and a public Place?', 'my-places'],
        ['Can I copy a Shared Map and edit the original?', 'shared-map-copy'],
        ['What is Download Map Notes compared with Download Map Assets Excel?', 'my-map-exports'],
        ['Does linking Place membership register me for a programme?', 'place-membership'],
        ['Can visitors see my private map notes?', 'map-note-privacy'],
        ['How do I search for support near me?', 'discover-nearby'],
        ['How do I add notes to a resource in My Map?', 'my-map-note-edit'],
        ['How do I reset my password?', 'account-recovery-help'],
        ['How do I contact a service provider?', 'provider-contact'],
        ['Does CareAround verify that a programme still has vacancies?', 'provider-availability'],
        ['Can I change the language to Chinese?', 'language-choice'],
        ['Can I create a personal place?', 'my-places'],
        ['Can visitors see my personal places on a Shared Map?', 'personal-place-sharing'],
        ['How do I add a session to My Plans?', 'plan-a-session'],
        ['What if my planned session changes?', 'plan-schedule-update'],
        ['Does acknowledging a schedule update move my plan?', 'plan-schedule-update'],
        ['How do I create a calendar plan?', 'plan-a-session'],
    ]) {
        assert.equal(retrieveGuideOracleFacts(question)[0]?.id, expected, question);
    }
    assert.equal(retrieveGuideOracleFacts('Can I request lunch delivery?').length, 0);
    assert.equal(answerGuideOracleFact('How do I create a governance group?').topicId, 'governance-group-overview');
    assert.equal(answerGuideOracleFact('How do I create an Org Group?').topicId, 'governance-org-group');
    assert.equal(answerGuideOracleFact('How do I create a Region Group?').topicId, 'governance-region-group');
    assert.equal(answerGuideOracleFact('How do I add a member to an Org Group?').topicId, 'governance-group-membership');
    assert.equal(answerGuideOracleFact('How do I access Org Groups?').topicId, 'governance-org-group');
    assert.equal(answerGuideOracleFact('Can I archive a governance group?').topicId, 'governance-group-overview');
    assert.equal(answerGuideUnverifiedWorkflow('Can I archive a governance group?'), null);
    assert.equal(answerGuideOracleFact('How do I configure Regions?').topicId, 'region-boundary-layers');
    assert.equal(answerGuideOracleFact('How do I create a Subregion?').topicId, 'region-boundary-layers');
    assert.equal(answerGuideOracleFact('What is Region Scope?').topicId, 'admin-region-scope');
    assert.match(answerGuideOracleFact('Can I see my current assigned Region Scope?').message,
        /signed-in Admin can ask the Guide.*current assigned Subregions/);
    assert.equal(answerGuideOracleFact('Which Subregions am I assigned to administer?').topicId,
        'admin-region-scope');
    assert.match(answerGuideOracleFact('Can a Region Admin upload Subregion boundaries?').message,
        /assigned scope.*Replace listed subregions removes existing codes/s);
    assert.match(answerGuideOracleFact('Does Region Scope let me edit every Place?').message,
        /does not grant editing of a Place/);
    assert.notEqual(answerGuideOracleFact('Can I create a Place in my Subregion?')?.topicId, 'region-boundary-layers');
    assert.equal(answerGuideOracleFact('Can a Region Group change boundaries?').topicId, 'governance-region-group');
    assert.equal(answerGuideOracleFact('How do I create an Offering template?').topicId, 'offering-template-overview');
    assert.equal(answerGuideOracleFact('Can the Guide translate a Programme I manage?').topicId,
        'offering-translation-review');
    assert.match(answerGuideOracleFact('Can the Guide translate a Programme I manage?').message,
        /Guide cannot translate or edit.*Edit → Translate.*Save review/s);
    assert.equal(answerGuideOracleFact('How do I generate place versions from a template?').topicId, 'offering-template-overview');
    assert.match(answerGuideOracleFact('If I update a template, what happens to its place versions?').message,
        /unless a field has a local override.*does not automatically unhide/s);
    assert.equal(answerGuideOracleFact('Will changing a template publish every place version?').topicId,
        'offering-template-propagation');
    assert.match(answerGuideOracleFact('How do I delete a template?').message,
        /also deletes all of its generated place versions/);
    assert.match(answerGuideOracleFact('Can you recover a deleted Offering template and its generated versions?').message,
        /no reviewed restore workflow/i);
    assert.equal(answerGuideOracleFact('I deleted a template by mistake. Can I get it back?').topicId,
        'offering-template-delete');
    assert.equal(answerGuideOracleFact('Will CareAround notify me when a saved Programme changes date?').topicId,
        'saved-schedule-notifications');
    assert.match(answerGuideOracleFact('Will CareAround notify me when a saved Programme changes date?').message,
        /Inbox → Updates.*in-app notifications.*must not be muted/is);
    assert.equal(answerGuideOracleFact('Can I see who opened a Shared Map I published?').topicId,
        'shared-map-viewer-boundary');
    assert.equal(answerGuideOracleFact('Can I tell if my Shared Map has any visitors?').topicId,
        'shared-map-viewer-boundary');
    assert.notEqual(answerGuideOracleFact('Can I share my Shared Map with any visitors?')?.topicId,
        'shared-map-viewer-boundary');
    assert.equal(answerGuideOracleFact('Why is my saved Programme not showing on my map?').topicId,
        'map-membership');
    assert.match(answerGuideOracleFact('Why is my saved Programme not showing on my map?').message,
        /choose that map and use its resource controls to add/);
    assert.equal(answerGuideOracleFact('Can staff see my saved list?').topicId,
        'saved-list-privacy');
    assert.match(answerGuideOracleFact('Can staff see my saved list?').message,
        /staff role alone does not grant another person a view/);
    assert.notEqual(answerGuideOracleFact('How do I turn on notifications?')?.topicId,
        'saved-schedule-notifications');
    assert.match(answerGuideOracleFact('Can I book a seat for my parent through CareAround?').message,
        /cannot.*book a seat for you/i);
    assert.equal(answerGuideOracleFact('Can you tell me why a specific saved Programme disappeared?').topicId,
        'saved-resource-status');
    assert.equal(answerGuideOracleFact('Can I upload an Offering Templates workbook?'), null);
    assert.equal(answerGuideOracleFact('How do I download the Offering Templates workbook?').topicId,
        'asset-workbook-import');
    assert.ok(retrieveGuideOracleFacts('How do I upload an Offering Templates workbook?')
        .every((fact) => !fact.id.startsWith('offering-template-')));
    assert.equal(retrieveGuideOracleFacts('Can I import a workbook into My Map?').length, 0);
    assert.equal(retrieveGuideOracleFacts('Can I archive a Place?').length, 0);
    assert.equal(retrieveGuideOracleFacts('Can I edit a Place on My Map?').length, 0);
    assert.equal(retrieveGuideOracleFacts('Can staff share a note on a resource detail page?').length, 0);
    assert.equal(answerGuideOracleFact('What is My Places?').topicId, 'my-places');
    assert.match(answerGuideOracleFact('How does Organisation Workspace work?').message,
        /Staff can view.*Admin can manage.*does not give editing rights over a Place/is);
    assert.match(answerGuideOracleFact('If I heart a programme, can I edit it or am I registered?').message,
        /does not itself give you permission to edit.*does not register or book/is);
    assert.match(answerGuideOracleFact('If I tap the heart on a service, can I change it or does that sign me up?').message,
        /does not itself give you permission to edit.*does not register or book/is);
    assert.match(answerGuideOracleFact('Can I copy a Shared Map and edit the original?').message,
        /separate private map.*does not change the original/is);
    assert.match(answerGuideOracleFact('Does linking Place membership register me for a programme?').message,
        /does not register you.*or give you permission to edit/is);
    assert.match(answerGuideOracleFact('Can visitors see my private map notes?').message,
        /stay private unless.*Share this note.*snapshot includes the notes marked for sharing/is);
    assert.match(answerGuideOracleFact('Can visitors see my personal places on a Shared Map?').message,
        /excluded from a published Shared Map.*downloads can include them/is);
    assert.match(answerGuideOracleFact('How do I edit a Resource Group?').message,
        /Manage My Resources.*Groups.*Edit.*eligible public, non-hidden resources/is);
    assert.match(answerGuideOracleFact('How do I import a workbook to create programmes?').message,
        /Super Admin.*Stable external keys.*Upload Workbook starts the import immediately/is);
    assert.match(answerGuideOracleFact('How do I edit a Place?').message,
        /Manage My Resources.*Edit.*selected resource.*server/is);
    assert.match(answerGuideOracleFact('How do I move a Programme from one Place to another?').message,
        /standalone Programme\/service.*Host & coverage.*Host Locations.*permission for both the Offering and each new linked Place.*cannot move an existing Offering in chat/is);
    assert.match(answerGuideOracleFact('Can I create one service at several Places?').message,
        /multiple Host Locations.*same service area.*each linked Place.*Guide.*one Place/is);
    assert.equal(answerGuideOracleFact('Can I see which people saved my Programme?').topicId,
        'provider-usage-boundary');
    assert.equal(answerGuideOracleFact('How can I make my Programme available in Malay?').topicId,
        'offering-translation-review');
    assert.equal(answerGuideOracleFact('If I save a Place, does it appear on My Map?').topicId,
        'map-membership');
    assert.match(answerGuideOracleFact('Can I transfer a Place to another organisation?').message,
        /cannot verify a self-service control.*adding an Owner is not an organisation-ownership transfer.*Help/is);
    assert.notEqual(answerGuideOracleFact('Can I move a Programme in My Plans?')?.topicId,
        'offering-host-change');
    assert.notEqual(answerGuideOracleFact('Can I transfer my account to another organisation?')?.topicId,
        'place-owner-transfer-boundary');
    assert.match(answerGuideOracleFact('What is the difference between hiding and deleting a resource?').message,
        /Hide from app.*separate from Delete.*confirmation.*skip items.*UI does not offer an undo/is);
    assert.match(answerGuideOracleFact('Can I delete a Place from My Directory?').message,
        /saved list.*does not delete the public listing/is);
    assert.match(answerGuideOracleFact('How do I hide a Place on My Map?').message,
        /map’s membership.*does not unsave.*or delete the public listing/is);
    assert.match(answerGuideOracleFact('Can I delete a Programme from My Plans?').message,
        /Remove from My Plans.*does not delete the provider’s Programme\/service listing/is);
    assert.match(answerGuideOracleFact('How do I add a session to My Plans?').message,
        /Save the Offering first.*Add to My Plans.*not a provider booking/is);
    assert.match(answerGuideOracleFact('What if my planned session changes?').message,
        /not moved automatically.*Acknowledging the update removes the notice/is);
    assert.match(answerGuideOracleFact('How do I update my profile?').message,
        /Profile from the dashboard.*Save Changes.*does not guarantee eligibility/is);
    assert.match(answerGuideOracleFact('Can I download a list of resources on my map?').message,
        /Download Map Assets Excel creates a resource workbook/is);
    assert.match(answerGuideOracleFact('Can visitors see my private notes in an embedded map?').message,
        /omits My Map resource notes.*Print annotations are a separate control/is);
    assert.equal(answerGuideOracleFact('Can visitors see my private notes on a Shared Map?').topicId, 'map-note-privacy');
    assert.match(answerGuideOracleFact('How do I search for support near me?').message,
        /Open Discover.*6-digit Singapore postal code.*Locate Me/is);
    assert.match(answerGuideOracleFact('How do I add notes to a resource in My Map?').message,
        /Open Map Notes.*choose the resource.*Share this note/is);
    assert.equal(answerGuideOracleFact('Can I share one note without sharing all my notes?').topicId, 'map-note-privacy');
    assert.match(answerGuideOracleFact('How do I reset my password?').message,
        /cannot reset a password.*support report.*Never put a password/is);
    assert.match(answerGuideOracleFact('How do I contact a service provider?').message,
        /open its details.*phone number, email, WhatsApp, website.*confirm current hours/is);
    assert.match(answerGuideOracleFact('Does CareAround verify that a programme still has vacancies?').message,
        /availability count.*not a confirmed seat.*contact the provider/is);
    assert.match(answerGuideOracleFact('Can I change the language to Chinese?').message,
        /Language selector.*English, Mandarin, Malay and Tamil/is);
    assert.match(answerGuideOracleFact('How can I edit my private My Place address?').message,
        /My Directory.*My Places.*Edit.*postal code and address.*checks ownership/is);
    assert.match(answerGuideOracleFact('How do I find wheelchair-accessible programmes nearby?').message,
        /keyword.*postal code.*cannot verify a dedicated wheelchair-accessibility filter.*confirm.*provider/is);
    assert.match(answerGuideOracleFact('Can I export my whole My Directory as Excel?').message,
        /cannot verify a one-click export.*individual My Map.*not your whole saved list/is);
    assert.match(answerGuideOracleFact('Does saving a Place make my whole directory public?').message,
        /not a public list.*not your whole saved list/is);
    assert.equal(answerGuideOracleFact('Can my colleague see my saved resources?').topicId, 'saved-list-privacy');
    assert.match(answerGuideOracleFact('Can AI update an existing Offering schedule?').message,
        /Guide cannot edit an existing.*schedule.*Manage My Resources.*Edit/is);
    assert.match(answerGuideOracleFact('Does a Region admin role let me edit any Place?').message,
        /Region admin role alone.*does not grant.*Edit.*exact Place/is);
    assert.match(answerGuideOracleFact('Can a volunteer create a Place for our organisation?').message,
        /Volunteer.*does not establish.*New Place.*account.*scope/is);
    assert.match(answerGuideOracleFact('Can I export my private map and share the Excel file?').message,
        /owned My Map.*Download Map Assets Excel.*private planning places.*review.*sharing/is);
    assert.equal(answerGuideOracleFact('Can I download a resource list from my map?').topicId, 'my-map-exports');
    assert.notEqual(answerGuideOracleFact('How do I change text size for accessibility?')?.topicId,
        'accessibility-search-boundary');
    assert.notEqual(answerGuideOracleFact('How do I update a public Place address?')?.topicId,
        'personal-place-address-edit');
    assert.notEqual(answerGuideOracleFact('How do I change my Programme contact phone?')?.topicId, 'provider-contact');
    assert.notEqual(answerGuideOracleFact('How do I update a Programme availability count?')?.topicId, 'provider-availability');
});

test('Reviewed editor and access boundaries bypass AI', async () => {
    let modelCalls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => {
        c.set('user', { id: 19, role: 'staff' }); await next();
    } });
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        modelCalls++;
        return { response: '{"factIds":["discover-nearby"]}' };
    } } };
    for (const [question, topicId, expected] of [
        ['How do I find wheelchair-accessible programmes nearby?', 'accessibility-search-boundary', /cannot verify a dedicated wheelchair-accessibility filter/],
        ['How can I edit my private My Place address?', 'personal-place-address-edit', /checks ownership when saving/],
        ['Can I export my whole My Directory as Excel?', 'directory-export-boundary', /not your whole saved list/],
        ['Can I download a resource list from my map?', 'my-map-exports', /Download Map Assets Excel creates a resource workbook/],
        ['How do I move a Programme from one Place to another?', 'offering-host-change', /standalone Programme\/service.*Host & coverage.*Host Locations/s],
        ['Can I transfer a Place to another organisation?', 'place-owner-transfer-boundary', /adding an Owner is not an organisation-ownership transfer/],
        ['Can I change the owner of our Place to another organisation?', 'place-owner-transfer-boundary', /adding an Owner is not an organisation-ownership transfer/],
        ['Can I see which people saved my Programme?', 'provider-usage-boundary', /cannot.*identify those people/],
        ['Can I create one service at several Places?', 'offering-multi-host', /multiple Host Locations.*same service area/s],
        ['How can I make my Programme available in Malay?', 'offering-translation-review', /Edit → Translate.*Save review/s],
        ['If I save a Place, does it appear on My Map?', 'map-membership', /Saving a resource adds it to My Directory.*choose separately/s],
        ['If I hide my Programme, do people who planned it still see it in My Plans?', 'provider-plan-lifecycle', /does not automatically delete.*personal plan.*current sessions/s],
        ['Can I see a list of members who added my Programme to My Plans?', 'provider-plan-privacy', /cannot show.*who added.*My Plans/s],
    ]) {
        const response = await router.request('/answer', { method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, useAi: true }) }, env);
        const answer = await response.json();
        assert.equal(answer.answerSource, 'reviewed', question);
        assert.equal(answer.topicId, topicId, question);
        assert.match(answer.message, expected, question);
    }
    assert.equal(modelCalls, 0);
});

test('Common Oracle paraphrases land on the intended reviewed guidance', () => {
    const questions = [
        ['What can I do with CareAround SG?', 'help-overview'],
        ['Where can I find nearby programmes?', 'discover-nearby'],
        ['How do I save a resource?', 'help-save'],
        ['I saved an offering; am I signed up?', 'saved-versus-managed'],
        ['What is the difference between My Directory and Manage My Resources?', 'saved-versus-managed'],
        ['Can I make a map?', 'help-maps'],
        ['Can I make a copy of a public map and then edit the original?', 'shared-map-copy'],
        ['Why do I still see a resource in My Directory after removing it from a map?', 'map-membership'],
        ['If I save Studio changes are they live on Shared Map?', 'map-studio'],
        ['Does saving Studio changes update my published Shared Map?', 'map-studio'],
        ['Can you tell me the current wait time at Havelock Demo Centre?', 'provider-wait-time'],
        ['Can you book a seat for me in a programme?', 'provider-contact'],
        ['Where is Audit Trail?', 'audit-trail'],
        ['Does my plan reserve a seat?', 'plans-not-bookings'],
        ['Can my private notes be seen on a share link?', 'map-note-privacy'],
        ['What is a Resource Group?', 'resource-groups'],
        ['Can a membership QR make me a manager?', 'place-membership'],
        ['Where do I get high detail maps?', 'town-maps'],
        ['What is the difference between a Place and a service?', 'resource-types'],
        ['I want a map as an Excel file', 'my-map-exports'],
        ['Can I add a new centre?', 'help-add-resource'],
        ['Can I delete multiple saved resources safely?', 'help-unsave'],
        ['Can I have a Shared Map on my website?', 'website-embeds'],
        ['Do I need to sign in to browse?', 'public-browsing'],
    ];
    for (const [question, expected] of questions) {
        const direct = answerGuideOracleFact(question);
        const reviewed = answerGuideQuestion({ question });
        const result = direct?.topicId || retrieveGuideOracleFacts(question, reviewed.topicId)[0]?.id;
        assert.equal(result, expected, question);
    }
});

test('Privacy and access distinctions use reviewed answers before model inference', async () => {
    let calls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => {
        c.set('user', { id: 19, role: 'standard' }); await next();
    } });
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: 'Everyone can see your notes and manage your resources.' };
    } } };
    for (const [question, expected] of [
        ['I saved an offering; am I signed up?', /does not register or book/],
        ['If I favourite an activity am I enrolled?', /does not register or book/],
        ['What happens when an activity I planned moves to another date?', /not moved automatically.*Acknowledging the update removes the notice/s],
        ['Can my private notes be seen on a share link?', /stay private unless/],
        ['Can I make a copy of a public map and then edit the original?', /does not change the original/],
        ['Are private sharing links safe to paste into the Guide?', /Do not include.*private sharing links/s],
        ['Do I need to sign in to browse?', /without signing in/],
        ['How do I contact a service provider?', /If the provider supplied contact information/],
        ['Does CareAround verify that a programme still has vacancies?', /not a confirmed seat/],
        ['Can I change the language to Chinese?', /English, Mandarin, Malay and Tamil/],
    ]) {
        const response = await router.request('/answer', { method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, useAi: true }) }, env);
        const answer = await response.json();
        assert.equal(answer.answerSource, 'reviewed', question);
        assert.match(answer.message, expected, question);
    }
    assert.equal(calls, 0);
});

test('Everyday account and sharing questions keep distinct reviewed boundaries', async () => {
    let modelCalls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => {
        c.set('user', { id: 19, role: 'standard' }); await next();
    } });
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        modelCalls++;
        return { response: '{"factIds":["help-maps"]}' };
    } } };
    for (const [question, topicId, expected, actionLabel] of [
        ['How do I remove a Programme from one map but keep it saved?', 'my-map-resource-removal', /does not unsave the resource/, 'Open My Directory'],
        ['How do I remove a Programme from My Directory?', 'saved-resource-removal', /saved list.*does not delete the public listing/s],
        ['How do I remove a saved Place from My Directory but leave it on My Map?', 'saved-resource-removal', /does not.*remove that resource from a My Map/s],
        ['Can I delete a Programme from My Plans?', 'remove-plan', /does not delete the provider/],
        ['What is the difference between a Place and a Programme?', 'resource-types', /physical resource.*activity or support offering/s],
        ['Can I register for a Programme through CareAround?', 'provider-contact', /cannot message or register/],
        ['Can I message a provider inside CareAround?', 'provider-contact', /phone number, email, WhatsApp.*in-app provider chat/s, 'Open Discover'],
        ['Are the services listed here free?', 'provider-availability', /Do not assume a listed service is free/],
        ['Is the remaining-seat number live?', 'provider-availability', /remaining-seat count is live/],
        ['Can I save a Place without following its Programme?', 'save-place-separately', /save the Place without saving each Programme/],
        ['Who can see the resources I saved to My Directory?', 'saved-list-privacy', /not a public list.*not your whole saved list/s, 'Open My Directory'],
        ['Can someone else edit my private My Map?', 'shared-map-copy', /Only the owner.*view-only snapshot.*does not change the original map/s],
        ['Can someone else add a Place to my private My Map?', 'shared-map-copy', /Only the owner can add.*does not let a visitor add/s],
        ['If I save a Place, will it appear on my Shared Map automatically?', 'saved-to-shared-map', /not automatically.*explicitly update the shared version/s],
        ['Can I make a Resource Group visible only to staff?', 'group-staff-visibility', /Public or Target region\/s, not a staff-only audience/],
        ['Will CareAround tell me if a provider has free places tomorrow?', 'provider-availability', /not a confirmed seat/],
        ['How do I correct a centre opening hour on its public listing?', 'place-contact-edit', /Location.*Guide cannot change/s],
        ['Can another provider edit a Place I added to my Resource Group?', 'group-other-provider-members', /does not transfer its ownership.*permission to edit/s],
        ['How do I delete my account and personal data?', 'account-deletion-help', /cannot delete your account.*request is not confirmation/s, 'Draft a support report'],
        ['Can I add a personal appointment to Care Calendar?', 'calendar-personal-entry', /dated notes from your own My Maps.*general appointment-entry button/s],
        ['How do I change the date of a personal plan?', 'plan-date-change', /follows that provider’s schedule.*dated My Map note/s],
    ]) {
        const response = await router.request('/answer', { method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, useAi: true }) }, env);
        const answer = await response.json();
        assert.equal(response.status, 200, question);
        assert.equal(answer.topicId, topicId, question);
        assert.equal(answer.answerSource, 'reviewed', question);
        assert.match(answer.message, expected, question);
        if (actionLabel) assert.equal(answer.actions[0]?.label, actionLabel, question);
    }
    assert.equal(modelCalls, 0);
    assert.equal(guidePrivateResourceChangeIntent('How do I remove a saved Place from My Directory but leave it on My Map?'), 'saved');
    assert.notEqual(answerGuideOracleFact('How do I update a provider fee?')?.topicId, 'provider-availability');
    assert.notEqual(answerGuideOracleFact('How do I edit my private My Map?')?.topicId, 'shared-map-copy');
});

test('Cloudflare sees only a small retrieved context and coarse page section', async () => {
    let prompt = '';
    const answer = await answerGuideWithCloudflare({ question: 'What is My Places?', pageContext: 'My Directory',
        env: { GUIDE_CHAT_ENABLED: 'true', AI: { run: async (_, request) => {
            prompt = request.messages[0].content;
            return { response: '{"factIds":["my-places"]}' };
        } } } });
    assert.match(answer.message, /My Places in My Directory are private planning locations/);
    assert.deepEqual(answer.sources.map(({ id }) => id), ['my-places']);
    assert.match(prompt, /Current app section: My Directory/);
    assert.match(prompt, /My Places in My Directory are private planning locations/);
    assert.doesNotMatch(prompt, /Review a sign-in problem|Keep private information out of chat|resource ID|private page contents/);
});

test('Guide gives reviewed concept answers without model invention and lists related sources for AI', async () => {
    let calls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => {
        c.set('user', { id: 10, role: 'standard' }); await next();
    } });
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: '{"factIds":["help-maps"]}' };
    } } };
    const post = (question) => router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, useAi: true }) }, env);
    const concept = await (await post('What is My Places?')).json();
    assert.equal(concept.answerSource, 'reviewed');
    assert.match(concept.message, /private planning locations/);
    assert.equal(concept.sources[0].title, 'My Places');
    assert.equal(calls, 0);
    const ai = await (await post('How do I create a map?')).json();
    assert.equal(ai.answerSource, 'ai');
    assert.ok(ai.sources.some((source) => source.title === 'Create and manage My Maps'));
    assert.equal(calls, 1);
});

test('Oracle routes risky product distinctions to reviewed wording before model inference', () => {
    for (const [question, id, expected] of [
        ['Where can I see my planning locations?', 'my-places', /private planning locations/],
        ['Can I download a resource list from my map?', 'my-map-exports', /Download Map Assets Excel/],
        ['If I change a Studio view, does the embedded map update?', 'map-studio', /does not by itself refresh/],
        ['Why is my saved resource no longer available?', 'saved-resource-status', /cannot tell why/],
        ['If I bookmark an activity, does that mean I have a confirmed seat?', 'saved-versus-managed', /does not register or book/],
        ['If I favorite an activity, am I enrolled?', 'saved-versus-managed', /does not register or book/],
        ['What happens when an activity I planned moves to another date?', 'plan-schedule-update', /not moved automatically.*Acknowledging the update removes the notice/s],
        ['Can my private planning locations appear in a spreadsheet I download?', 'personal-place-sharing', /downloads can include them/],
        ['If a required personal detail is blank, does that prove I am ineligible?', 'offering-profile-missing', /access check unresolved.*does not prove you qualify/s],
        ['Does an address saved for private planning become a public directory listing?', 'my-places', /does not make it a public directory Place/],
        ['Is a collection of directory listings the same as a coordination team?', 'resource-groups', /governance coordination group is a different kind/],
        ['How do I change the phone number on a programme I manage?', 'offering-contact-edit', /Profile.*Public contact.*server checks your permission/s],
        ['How do I update the contact email on a Place I manage?', 'place-contact-edit', /Location.*Contact email.*Guide cannot change/s],
        ['If I switch off an Offering schedule, what happens to upcoming sessions?', 'offering-schedule-edit', /confirmation.*upcoming sessions.*Care Calendar/s],
        ['Can the Guide edit the schedule of my existing Programme?', 'guide-existing-resource-edit-scope', /Guide cannot edit an existing.*schedule.*Manage My Resources/s],
        ['Do I need Super Admin approval to publish a Place in Discover?', 'listing-publication-boundary', /separate governed-pilot workflow.*not the general create step/s],
        ['Is Resource Claims publication approval needed for every directory listing?', 'listing-publication-boundary', /not the general create step for every Discover listing/],
        ['Can a Resource Group include another organisation’s public Place?', 'group-other-provider-members', /another provider.*does not transfer its ownership/s],
        ['Does adding another provider’s Place to my Group let me edit it?', 'group-other-provider-members', /does not transfer its ownership.*permission to edit/s],
        ['Can I target my Resource Group to certain Regions?', 'group-target-regions', /Target region\/s.*selected Region boundary/s],
        ['Can I make a Resource Group visible only to staff?', 'group-staff-visibility', /Public or Target region\/s, not a staff-only audience/s],
        ['If I save a Place, will it appear on my Shared Map automatically?', 'saved-to-shared-map', /not automatically.*update the shared version/s],
        ['Can someone else add a Place to my private My Map?', 'shared-map-copy', /Only the owner can add.*view-only snapshot/s],
        ['Can providers see how many people saved their listing?', 'provider-usage-boundary', /cannot look up a provider report.*cannot verify a provider-facing usage report/s],
        ['Can a provider see who viewed its listing?', 'provider-usage-boundary', /cannot.*identify those people/s],
        ['Will hiding my Programme delete people’s existing plans?', 'provider-plan-lifecycle', /does not automatically delete.*personal plan/s],
        ['If I turn off its calendar sessions, what happens to people who planned them?', 'provider-plan-lifecycle', /turning off.*sessions.*personal plan/s],
        ['Can I see who planned my Programme?', 'provider-plan-privacy', /cannot show.*who added.*My Plans/s],
    ]) {
        const answer = answerGuideOracleFact(question);
        assert.equal(answer?.topicId, id, question);
        assert.match(answer.message, expected, question);
    }
    assert.notEqual(answerGuideOracleFact('How do I contact a service provider?')?.topicId, 'offering-contact-edit');
    assert.notEqual(answerGuideOracleFact('How do I change a session in My Plans?')?.topicId, 'offering-schedule-edit');
    assert.notEqual(answerGuideOracleFact('How do I publish my Shared Map?')?.topicId, 'listing-publication-boundary');
});
