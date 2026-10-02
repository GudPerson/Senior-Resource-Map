# Initial Help Centre review and Guide refinements

Date: 2 October 2026 (Asia/Singapore). Candidate content: `2026-10-02.help-centre.2`.

The user said: “i have briefly reviewed the help centre and think its a very good first draft.” This is positive preliminary feedback. The final sixty-answer quality scores, named ownership and release approval remain pending.

The next check exercised ordinary questions through the actual local API as a fictional member with `useAi: false`. It found missed wording and one incorrect organisation-versus-Place membership answer. Narrow routing and two source-reviewed sections corrected them. Account permission checks and confirmed writes retain their existing paths.

All twelve local questions now return the expected domain. The original sixty cases are unchanged; thirteen supplementary tests include spelling and boundary exclusions. No live model calls or production data/writes were used. The before/after JSON records are in `output/help-centre/everyday-question-probe-before.json` and `everyday-question-probe-after.json`.

## Served answers for the next review

### 1. How can I save a new address onto my map?

Context: My Maps; topic: `personal-place-map-create`; source: reviewed.

Yes—you can add a missing location as a Personal place. You must be signed in and use a map you own.

1. Open My Directory → My Maps and open your map.

2. Select + Personal place.

3. Select Choose map location, then click or tap the spot on your map.

4. Enter the place’s name and category.

5. Enter its address or postal code in the lookup and select Find location to verify it.

6. Review the returned location and details, then select Save.

On a phone, open the map’s menu to find Personal place.

For a genuine point without a postal address, select This point has no postal address instead. Do not guess a postal code from a nearby building.

The place is kept in My Places and can be reused on your other maps. It remains private: it does not enter Discover or public Shared Maps, but can appear in your own printed/exported maps.

If location verification fails, check the address or six-digit Singapore postal code and try again. A failed save is not confirmation that the place was added.

To submit a public directory listing instead, use the authorised public Place workflow; a Personal place is for your own planning.

Reviewed section: [Add the missing location to your own map](http://127.0.0.1:5181/help-centre/add-a-personal-place-to-your-map#create-personal-place).

### 2. Add somewhere that is not listed to this map.

Context: My Maps; topic: `personal-place-map-create`; source: reviewed.

Yes—you can add a missing location as a Personal place. You must be signed in and use a map you own.

1. Open My Directory → My Maps and open your map.

2. Select + Personal place.

3. Select Choose map location, then click or tap the spot on your map.

4. Enter the place’s name and category.

5. Enter its address or postal code in the lookup and select Find location to verify it.

6. Review the returned location and details, then select Save.

On a phone, open the map’s menu to find Personal place.

For a genuine point without a postal address, select This point has no postal address instead. Do not guess a postal code from a nearby building.

The place is kept in My Places and can be reused on your other maps. It remains private: it does not enter Discover or public Shared Maps, but can appear in your own printed/exported maps.

If location verification fails, check the address or six-digit Singapore postal code and try again. A failed save is not confirmation that the place was added.

To submit a public directory listing instead, use the authorised public Place workflow; a Personal place is for your own planning.

Reviewed section: [Add the missing location to your own map](http://127.0.0.1:5181/help-centre/add-a-personal-place-to-your-map#create-personal-place).

### 3. Can I put a meeting point on my map without a postal address?

Context: My Maps; topic: `personal-place-map-create`; source: reviewed.

Yes—you can add a missing location as a Personal place. You must be signed in and use a map you own.

1. Open My Directory → My Maps and open your map.

2. Select + Personal place.

3. Select Choose map location, then click or tap the spot on your map.

4. Enter the place’s name and category.

5. Enter its address or postal code in the lookup and select Find location to verify it.

6. Review the returned location and details, then select Save.

On a phone, open the map’s menu to find Personal place.

For a genuine point without a postal address, select This point has no postal address instead. Do not guess a postal code from a nearby building.

The place is kept in My Places and can be reused on your other maps. It remains private: it does not enter Discover or public Shared Maps, but can appear in your own printed/exported maps.

If location verification fails, check the address or six-digit Singapore postal code and try again. A failed save is not confirmation that the place was added.

To submit a public directory listing instead, use the authorised public Place workflow; a Personal place is for your own planning.

Reviewed section: [Add the missing location to your own map](http://127.0.0.1:5181/help-centre/add-a-personal-place-to-your-map#create-personal-place).

### 4. I saved the map view but the share link still has the old layout. What now?

Context: My Maps; topic: `map-studio-share-update`; source: reviewed.

A Shared Map keeps the version explicitly published through Share. Editing the private map or saving its Studio presentation does not automatically change that snapshot.

1. Open your own map and select the Studio view you intend to share.

2. Check that the design has saved, then open Share.

3. Review the notes and annotation settings intended for recipients.

4. Choose Publish share link for a first publication, or Update shared link to replace the published snapshot.

5. Preview the public version before sending its link. Use Unpublish if you want to stop sharing.

Copying the existing link alone does not update its content.

Personal places are excluded from public Shared Maps. Owner prints and exports can include private planning content; check files separately.

An embedded presentation uses its published snapshot and omits resource-note rows. Preview the actual embed separately.

Reviewed section: [Publish the intended saved view](http://127.0.0.1:5181/help-centre/publish-update-or-stop-sharing-a-map#update-shared-version).

### 5. Will publishing my map show my personal places to visitors?

Context: My Maps; topic: `personal-place-sharing`; source: reviewed.

Personal places are excluded from a published Shared Map. Your owner map and its resource-ledger downloads can include them, so review an export before sharing it with anyone. A personal place is not a public directory Place.

Reviewed section: [Personal places and sharing](http://127.0.0.1:5181/help-centre/publish-update-or-stop-sharing-a-map#personal-place-sharing).

### 6. If I export my own map, will my private places be included?

Context: My Maps; topic: `personal-place-sharing`; source: reviewed.

Personal places are excluded from a published Shared Map. Your owner map and its resource-ledger downloads can include them, so review an export before sharing it with anyone. A personal place is not a public directory Place.

Reviewed section: [Personal places and sharing](http://127.0.0.1:5181/help-centre/publish-update-or-stop-sharing-a-map#personal-place-sharing).

### 7. I saved this centre. Why is it not inside my map?

Context: My Maps; topic: `map-membership`; source: reviewed.

Saving a resource adds it to My Directory. You choose separately whether to add it to a particular My Map. If a saved Programme/service is missing from a map, open My Directory → My Maps, choose that map and use its resource controls to add the Programme/service. Removing it from a map does not automatically unsave it from My Directory.

Reviewed section: [Saved resources and map membership](http://127.0.0.1:5181/help-centre/add-or-remove-resources-in-an-existing-map#map-membership).

### 8. Am I allowed to add a public resource?

Context: My Directory; topic: `resource-access`; source: account.

This account does not currently have resource-management access. This account cannot create a new Place. It cannot create a Programme/service through the Guide without access to a manageable Place.

### 9. Where can I see the listings I actually manage?

Context: My Directory; topic: `article-hc-06-manage-listings`; source: reviewed.

Sign in and open the dashboard, then choose Manage My Resources when that control is available to your account. Choose Places, Offerings or Groups to review the listings you can manage. My Directory is a separate page for resources you saved for your own use.

If Manage My Resources is missing, this account may not currently have resource-management access. Saving a listing or belonging to an organisation does not grant editing permission. Check the exact listing’s current controls or ask the responsible Owner or administrator to review your assignment; the Guide cannot grant access.

Reviewed section: [Understand Saved Resources, My Maps, My Places and managed resources: Where to find listings assigned to you](http://127.0.0.1:5181/help-centre/understand-saved-resources-my-maps-my-places-and-managed-resources#manage-listings).

### 10. Does organisation membership let me edit its programmes?

Context: Dashboard; topic: `article-hc-33-organisation-edit-boundary`; source: reviewed.

No. Organisation membership or a governance role alone does not grant permission to edit its Place or Programme/service listings. Organisation workspace access and resource-editing assignments are separate.

Editing depends on an active Owner or Staff assignment to the exact resource, or Super Admin access. Open Manage My Resources and check Edit on the selected listing; the server checks current permission again before saving. This is the general rule, not confirmation of your account’s assignments. The Guide cannot grant access.

Reviewed section: [Understand assigned resource permissions and missing controls: Organisation membership and listing editing are separate](http://127.0.0.1:5181/help-centre/understand-assigned-resource-permissions-and-missing-controls#organisation-edit-boundary).

### 11. Does adding an event to my plans register me for it?

Context: Care Calendar; topic: `plans-not-bookings`; source: reviewed.

A personal plan records intended attendance. It is not a booking, registration, or confirmation from the provider. Check the provider’s current details and contact them when registration is needed.

Reviewed section: [Plans are not bookings](http://127.0.0.1:5181/help-centre/add-a-session-to-my-plans-and-arrange-booking-with-the-provider#plans-not-bookings).

### 12. The Guide is unavailable. How can I still read the instructions?

Context: Help Centre; topic: `article-hc-29-ask-guide`; source: reviewed.

Yes. You can still read the public Help Centre without AI. Open Browse help to search for your task and read its complete reviewed instructions. Use the app’s normal controls to carry out the task; an unanswered Guide request has not created, saved or changed anything. Sign in for account-specific guidance and checks.

1. Open Help and choose Guide. Ask which CareAround task or control you need.

2. Read the response and open the reviewed source article to check the complete instructions.

3. If the question concerns this account, sign in and use the supported current-account checks. A general help answer has not inspected your records.

4. If AI is unavailable, browse the Help Centre or use the app’s manual controls. Do not assume an unanswered request changed anything.

The Guide supports CareAround product help. Confirm provider eligibility, fees and availability with the provider.

Use Report a problem for a reproducible app issue; keep passwords, verification codes and sensitive personal information out of chat.

Reviewed section: [Ask the Guide, read its sources and use help when AI is unavailable: Ask a product question and use its sources](http://127.0.0.1:5181/help-centre/ask-the-guide-read-its-sources-and-use-help-when-ai-is-unavailable#ask-guide).
