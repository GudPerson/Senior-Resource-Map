// Read-only Oracle acceptance against the disposable support fixture only.
// CAREAROUND_SUPPORT_FIXTURE=true CAREAROUND_SUPPORT_FIXTURE_PORT=8792 node scripts/guide-oracle-fixture-uat.mjs
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Explicit disposable fixture mode is required.');
const port = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8791' ? 8791 : 8792;
const origin = `http://127.0.0.1:${port}`;
const checks = [];
// Fictional accounts use separate TEST-NET client addresses so this broad
// fixture suite does not exhaust the production-style per-IP Guide limiter.
const testClientIp = (role) => ({ staff: '198.51.100.11', otherstaff: '198.51.100.12',
    member: '198.51.100.13', admin: '198.51.100.14', impersonating: '198.51.100.15' })[role] || '198.51.100.10';

async function ask(role, question, pageContext = 'My Directory') {
    const response = await fetch(`${origin}/api/guide/answer`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': testClientIp(role),
            ...(role ? { Cookie: `carearound_support_fixture=${role}` } : {}) },
        body: JSON.stringify({ question, pageContext, useAi: true }),
    });
    assert.equal(response.status, 200, `${role || 'guest'}: ${question}`);
    return response.json();
}

async function managedAccess(role, query = 'Group') {
    const response = await fetch(`${origin}/api/guide/managed-access?${new URLSearchParams({ q: query })}`, {
        headers: { Cookie: `carearound_support_fixture=${role}`, 'cf-connecting-ip': testClientIp(role) },
    });
    return { status: response.status, body: await response.json() };
}

async function check(name, run) {
    await run();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
}

await check('managed resources are account-scoped and distinct from saved resources', async () => {
    const staff = await ask('staff', 'what are the resources i manage?');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /Havelock Demo Centre/);
    assert.match(staff.message, /1 Resource Group.*Havelock Staff Group/s);
    assert.match(staff.message, /Manage My Resources/);
    assert.doesNotMatch(staff.message, /Out-of-scope Demo Centre/);
    assert.doesNotMatch(staff.message, /Other Staff Group/);
    assert.deepEqual(staff.actions, [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }]);
    const otherStaff = await ask('otherstaff', 'what are the resources i manage?');
    assert.match(otherStaff.message, /Out-of-scope Demo Centre/);
    assert.match(otherStaff.message, /Other Staff Group/);
    assert.doesNotMatch(otherStaff.message, /Havelock Demo Centre/);
    assert.doesNotMatch(otherStaff.message, /Havelock Staff Group/);
    const groupOnly = await ask('staff', 'What Resource Groups do I manage?', 'Manage resources');
    assert.equal(groupOnly.answerSource, 'account');
    assert.match(groupOnly.message, /1 Resource Group: Havelock Staff Group/);
    assert.doesNotMatch(groupOnly.message, /Havelock Demo Centre|Other Staff Group/);
    const member = await ask('member', 'what are the resources i manage?');
    assert.match(member.message, /does not currently have access to manage/);
    assert.doesNotMatch(member.message, /Havelock Demo Centre|Out-of-scope Demo Centre/);
});

await check('saved resources use the owner list and never appear for another account', async () => {
    const member = await ask('member', 'what resources have i saved?');
    assert.equal(member.answerSource, 'account');
    assert.match(member.message, /saved resources? in My Directory/);
    assert.match(member.message, /Havelock Demo Centre/);
    const staff = await ask('staff', 'what resources have i saved?');
    assert.match(staff.message, /no saved resources in this account/);
    assert.doesNotMatch(staff.message, /Havelock Demo Centre/);
    const guest = await ask(null, 'what resources have i saved?');
    assert.match(guest.message, /Sign in/);
    assert.doesNotMatch(guest.message, /Havelock Demo Centre/);
});

await check('My Places use the owner list and private Place questions stay distinct', async () => {
    const staff = await ask('staff', 'What personal places have I created?');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /Staff Planning Pin.*private planning locations/);
    assert.doesNotMatch(JSON.stringify(staff), /Other Private Pin|Private fixture staff address|Private fixture staff note/);
    const other = await ask('otherstaff', 'What personal places have I created?');
    assert.match(other.message, /Other Private Pin/);
    assert.doesNotMatch(other.message, /Staff Planning Pin/);
    const guest = await ask(null, 'What personal places have I created?');
    assert.match(guest.message, /Sign in/);
    assert.doesNotMatch(guest.message, /Staff Planning Pin|Other Private Pin/);
    const userView = await ask('impersonating', 'What personal places have I created?');
    assert.match(userView.message, /Exit User View/);
    const personalCreation = await ask('staff', 'Can I create a personal place?');
    assert.equal(personalCreation.answerSource, 'reviewed');
    assert.match(personalCreation.message, /Add personal place/);
    const publicCreation = await ask('staff', 'Can I create a new public Place?');
    assert.equal(publicCreation.topicId, 'resource-access');
    assert.match(publicCreation.message, /cannot create a new Place/);
    const sharing = await ask('staff', 'Can visitors see my personal places on a Shared Map?');
    assert.equal(sharing.answerSource, 'reviewed');
    assert.match(sharing.message, /excluded from a published Shared Map/);
});

await check('My Plans list only the authenticated account and Calendar how-to stays reviewed', async () => {
    const staff = await ask('staff', 'What plans do I have?', 'Care Calendar');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /Staff Future Session.*not a provider booking/s);
    assert.doesNotMatch(staff.message, /Other Private Session/);
    const other = await ask('otherstaff', 'What plans do I have?', 'Care Calendar');
    assert.match(other.message, /Other Private Session/);
    assert.doesNotMatch(other.message, /Staff Future Session/);
    const guest = await ask(null, 'What plans do I have?', 'Care Calendar');
    assert.match(guest.message, /Sign in/);
    const userView = await ask('impersonating', 'What plans do I have?', 'Care Calendar');
    assert.match(userView.message, /Exit User View/);
    const howTo = await ask('staff', 'How do I add a session to My Plans?', 'Care Calendar');
    assert.equal(howTo.answerSource, 'reviewed');
    assert.match(howTo.message, /Save the Offering first.*Add to My Plans.*not a provider booking/s);
    const update = await ask('staff', 'Does acknowledging a schedule update move my plan?', 'Care Calendar');
    assert.equal(update.answerSource, 'reviewed');
    assert.match(update.message, /Acknowledging the update removes the notice/);
});

await check('Resource Group guidance uses current role access and stays separate from governance groups', async () => {
    const concept = await ask('staff', 'What is a Resource Group?', 'Manage resources');
    assert.equal(concept.answerSource, 'reviewed');
    assert.match(concept.message, /public Places and offerings.*governance coordination group/s);
    const howTo = await ask('staff', 'How do I edit a Resource Group?', 'Manage resources');
    assert.equal(howTo.answerSource, 'reviewed');
    assert.match(howTo.message, /Groups.*Edit.*public, non-hidden resources/s);
    const staff = await ask('staff', 'Can I create a Resource Group?', 'Manage resources');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /cannot create a new Resource Group/);
    const admin = await ask('admin', 'Can I create a Resource Group?', 'Manage resources');
    assert.match(admin.message, /can open New Group/);
    const guest = await ask(null, 'Can I create a Resource Group?', 'Manage resources');
    assert.match(guest.message, /Sign in/);
    const userView = await ask('impersonating', 'Can I create a Resource Group?', 'Manage resources');
    assert.match(userView.message, /Exit User View/);
    const governance = await ask('staff', 'Can I create a governance group?', 'Manage resources');
    assert.equal(governance.topicId, 'unverified-workflow');
    assert.match(governance.message, /cannot verify.*do not use New Group instructions/s);
    const staffGroup = await managedAccess('staff');
    assert.equal(staffGroup.status, 200);
    assert.deepEqual(staffGroup.body.resources, [{ id: 203, type: 'group', name: 'Havelock Staff Group',
        permissions: { canEdit: true, canHide: false, canDelete: false } }]);
    const otherGroup = await managedAccess('otherstaff');
    assert.equal(otherGroup.status, 200);
    assert.deepEqual(otherGroup.body.resources, [{ id: 204, type: 'group', name: 'Other Staff Group',
        permissions: { canEdit: true, canHide: true, canDelete: true } }]);
    const memberGroup = await managedAccess('member');
    assert.deepEqual(memberGroup.body, { resources: [], hasMore: false, canManage: false });
    assert.equal((await managedAccess('impersonating')).status, 403);
});

await check('compound questions keep account scopes and Group members distinct', async () => {
    const both = await ask('staff', 'What resources have I saved, and which can I manage?');
    assert.equal(both.answerSource, 'account');
    assert.match(both.message, /no saved resources.*Havelock Demo Centre/s);
    const groupRights = await ask('staff', 'What Resource Groups do I manage, and can I delete them?', 'Manage resources');
    assert.match(groupRights.message, /Havelock Staff Group.*does not prove you can edit, hide or delete it/s);
    assert.equal(groupRights.canCheckManagedListing, true);
    assert.doesNotMatch(groupRights.message, /Other Staff Group/);
    const visibility = await ask('staff', 'Can I hide a Group without hiding the Places in it?', 'Manage resources');
    assert.equal(visibility.answerSource, 'account');
    assert.match(visibility.message, /Group listing, not the visibility of its member Places/);
    assert.equal(visibility.canCheckManagedListing, true);
});

await check('eligibility, Place staff and Guide action limits do not become creation permissions', async () => {
    const memberOnly = await ask('staff', 'How do I know whether I can access a member-only Programme?');
    assert.equal(memberOnly.topicId, 'verified-boundary');
    assert.match(memberOnly.message, /active membership at a linked Place.*cannot confirm your eligibility/s);
    const saved = await ask('staff', 'Does saving a restricted Programme mean I am eligible?');
    assert.match(saved.message, /personal bookmark.*does not satisfy profile criteria/s);
    const profile = await ask('staff', 'My CHAS details are missing. Will a restricted Programme appear?');
    assert.match(profile.message, /access check unresolved/);
    assert.doesNotMatch(JSON.stringify(profile), /Havelock Restricted Activity/);
    const staff = await ask('staff', 'Can I add staff to a Place I manage?');
    assert.match(staff.message, /Only a Super Admin or an Owner of that particular Place/);
    const place = await ask('staff', 'Can you create a Place for me?');
    assert.equal(place.answerSource, 'account');
    assert.match(place.message, /Guide cannot submit a new public Place.*cannot create a new Place/s);
    const group = await ask('admin', 'Can you create a Group for me?');
    assert.match(group.message, /cannot submit.*can open New Group/s);
});

await check('profile, map export and embed-note questions reach exact reviewed guidance', async () => {
    const profile = await ask('staff', 'How do I update my profile?');
    assert.equal(profile.topicId, 'profile-update');
    assert.match(profile.message, /Save Changes.*not Guide chat/s);
    const exportList = await ask('staff', 'Can I download a list of resources on my map?');
    assert.equal(exportList.topicId, 'my-map-exports');
    assert.match(exportList.message, /Download Map Assets Excel creates a resource workbook/);
    const embed = await ask('staff', 'Can visitors see my private notes in an embedded map?');
    assert.equal(embed.topicId, 'embedded-map-notes');
    assert.match(embed.message, /omits My Map resource notes.*Print annotations are a separate control/s);
});

await check('nearby, creation, map-note and account-access questions avoid broad keyword detours', async () => {
    const nearby = await ask('staff', 'How do I search for support near me?', 'Discover');
    assert.equal(nearby.topicId, 'discover-nearby');
    assert.match(nearby.message, /Open Discover.*postal code.*Locate Me/s);
    assert.doesNotMatch(nearby.message, /Describe what happened/);
    const programme = await ask('staff', 'How do I add a Programme to a Place I manage?', 'Manage resources');
    assert.equal(programme.answerSource, 'account');
    assert.match(programme.message, /Ask the Guide to create a Programme\/service.*choose Create/s);
    assert.doesNotMatch(programme.message, /Programmes\/services:|cannot create a new Place/);
    const place = await ask('staff', 'How do I add a new Place?', 'Manage resources');
    assert.equal(place.answerSource, 'account');
    assert.match(place.message, /cannot create a new Place/);
    const note = await ask('staff', 'How do I add notes to a resource in My Map?', 'My Maps');
    assert.equal(note.topicId, 'my-map-note-edit');
    assert.match(note.message, /Open Map Notes.*Share this note/s);
    const oneNote = await ask('staff', 'Can I share one note without sharing all my notes?', 'My Maps');
    assert.equal(oneNote.topicId, 'map-note-privacy');
    assert.match(oneNote.message, /for each note/);
    const recovery = await ask(null, 'How do I reset my password?');
    assert.equal(recovery.topicId, 'account-recovery-help');
    assert.match(recovery.message, /cannot reset a password.*support report/s);
});

await check('provider contact, availability and language stay on reviewed product facts', async () => {
    const contact = await ask('staff', 'How do I contact a service provider?', 'Discover');
    assert.equal(contact.topicId, 'provider-contact');
    assert.match(contact.message, /open its details.*phone number, email, WhatsApp, website/s);
    const availability = await ask('staff', 'Does CareAround verify that a programme still has vacancies?', 'Discover');
    assert.equal(availability.topicId, 'provider-availability');
    assert.match(availability.message, /not a confirmed seat.*contact the provider/s);
    const language = await ask('staff', 'Can I change the language to Chinese?');
    assert.equal(language.topicId, 'language-choice');
    assert.match(language.message, /English, Mandarin, Malay and Tamil/);
    const support = await ask('staff', 'How do I contact support?');
    assert.notEqual(support.topicId, 'provider-contact');
});

await check('workbook import guidance reflects Super Admin access and does not invent My Map upload', async () => {
    const howTo = await ask('staff', 'How do I import a workbook?', 'Dashboard');
    assert.equal(howTo.answerSource, 'reviewed');
    assert.match(howTo.message, /Admin.*Data Tools.*Upload Workbook starts the import immediately/s);
    const staff = await ask('staff', 'Can I import a workbook to create programmes?', 'Dashboard');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /not available to this account/);
    const admin = await ask('admin', 'Can I import a workbook to create programmes?', 'Dashboard');
    assert.equal(admin.answerSource, 'account');
    assert.match(admin.message, /This account can open Admin.*Upload Workbook only when ready/s);
    const guest = await ask(null, 'Can I import a workbook to create programmes?', 'Dashboard');
    assert.match(guest.message, /Sign in/);
    const userView = await ask('impersonating', 'Can I import a workbook to create programmes?', 'Dashboard');
    assert.match(userView.message, /Exit User View/);
    const map = await ask('staff', 'Can I import workbook into My Map?', 'My Maps');
    assert.equal(map.topicId, 'unverified-workflow');
    assert.match(map.message, /cannot verify a workbook-upload workflow for My Maps/);
});

await check('resource edit, hide and delete guidance does not invent per-listing rights or Archive', async () => {
    const edit = await ask('staff', 'How do I edit a Place?', 'Manage resources');
    assert.equal(edit.topicId, 'resource-edit');
    assert.match(edit.message, /Edit.*selected resource.*server/s);
    const difference = await ask('staff', 'What is the difference between hiding and deleting a resource?', 'Manage resources');
    assert.equal(difference.topicId, 'resource-hide-delete');
    assert.match(difference.message, /Hide from app.*separate from Delete.*UI does not offer an undo/s);
    const staff = await ask('staff', 'Can I delete a Place?', 'Manage resources');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /does not confirm it may delete a particular Place or Offering/);
    const member = await ask('member', 'Can I edit a Place?', 'Manage resources');
    assert.match(member.message, /does not currently have Manage My Resources access/);
    const archive = await ask('staff', 'Can I archive a Place?', 'Manage resources');
    assert.equal(archive.topicId, 'unverified-workflow');
    assert.match(archive.message, /cannot verify an Archive control/);
});

await check('private saved, map and plan changes do not become public listing deletion', async () => {
    const saved = await ask('staff', 'Can I delete a Place from My Directory?', 'My Directory');
    assert.equal(saved.topicId, 'saved-resource-removal');
    assert.match(saved.message, /does not delete the public listing/);
    const map = await ask('staff', 'How do I hide a Place on My Map?', 'My Maps');
    assert.equal(map.topicId, 'my-map-resource-removal');
    assert.match(map.message, /does not unsave.*or delete the public listing/);
    const plan = await ask('staff', 'Can I delete a Programme from My Plans?', 'Care Calendar');
    assert.equal(plan.topicId, 'remove-plan');
    assert.match(plan.message, /does not delete the provider’s Programme\/service listing/);
});

await check('navigation and product facts are reviewed, not inferred by the model', async () => {
    const navigation = await ask('staff', 'how do i go to my directory?');
    assert.equal(navigation.answerSource, 'reviewed');
    assert.match(navigation.message, /already on My Directory/);
    const where = await ask('staff', 'where do i see if i manage any resources?');
    assert.equal(where.answerSource, 'account');
    assert.match(where.message, /Manage My Resources.*My Directory/s);
    const concept = await ask('staff', 'What is My Places?');
    assert.equal(concept.answerSource, 'reviewed');
    assert.match(concept.message, /private planning locations/);
});

await check('saving does not imply editing rights or registration', async () => {
    const answer = await ask('member', 'If I tap the heart on a service, can I change it or does that sign me up?');
    assert.equal(answer.answerSource, 'reviewed');
    assert.match(answer.message, /does not itself give you permission to edit/);
    assert.match(answer.message, /does not register or book you/);
    assert.match(answer.message, /separate management rights/);
});

await check('shared copies, map exports and membership retain distinct meanings', async () => {
    const shared = await ask('member', 'Can I copy a Shared Map and edit the original?');
    assert.equal(shared.answerSource, 'reviewed');
    assert.match(shared.message, /separate private map.*does not change the original/s);
    const exports = await ask('staff', 'What is Download Map Notes compared with Download Map Assets Excel?');
    assert.equal(exports.answerSource, 'reviewed');
    assert.match(exports.message, /PDF ledger.*resource workbook/s);
    const membership = await ask('member', 'Does linking Place membership register me for a programme?');
    assert.equal(membership.answerSource, 'reviewed');
    assert.match(membership.message, /does not register you.*or give you permission to edit/s);
    const notes = await ask('member', 'Can visitors see my private map notes?');
    assert.equal(notes.answerSource, 'reviewed');
    assert.match(notes.message, /stay private unless.*Share this note.*snapshot includes the notes marked for sharing/s);
});

await check('paraphrased safety and discovery questions stay on reviewed guidance', async () => {
    const signup = await ask('member', 'I saved an offering; am I signed up?');
    assert.equal(signup.answerSource, 'reviewed');
    assert.match(signup.message, /does not register or book/);
    const studio = await ask('staff', 'If I save Studio changes are they live on Shared Map?');
    assert.equal(studio.answerSource, 'reviewed');
    assert.match(studio.message, /does not by itself refresh the published Shared Map/);
    const embed = await ask('staff', 'Can I have a Shared Map on my website?');
    assert.equal(embed.answerSource, 'reviewed');
    assert.match(embed.message, /approved website.*Website Embed.*embed code/s);
    const publicBrowse = await ask(null, 'Do I need to sign in to browse?', 'CareAround');
    assert.equal(publicBrowse.answerSource, 'reviewed');
    assert.match(publicBrowse.message, /without signing in/);
    const bulkUnsave = await ask('member', 'Can I delete multiple saved resources safely?');
    assert.equal(bulkUnsave.answerSource, 'reviewed');
    assert.match(bulkUnsave.message, /Not used in My Maps.*review the removal confirmation/s);
});

await check('programme action remains separately permission-scoped', async () => {
    const response = await fetch(`${origin}/api/guide/actions/programmes/places`, {
        headers: { Cookie: 'carearound_support_fixture=staff' },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.canCreate, true);
    assert.ok(data.places.some((place) => place.name === 'Havelock Demo Centre'));
    assert.ok(data.places.every((place) => place.name !== 'Out-of-scope Demo Centre'));
});

const evidence = { fixture: true, port, checkedAt: new Date().toISOString(),
    note: 'Fictional accounts and resources; local behavior only. No production or live-model claim.', checks };
await writeFile(new URL('../docs/evidence/guide-oracle-fixture-20260928.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
