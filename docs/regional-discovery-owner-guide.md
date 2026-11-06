# Regional directory owner guide

This guide describes the local software candidate. It has not activated a real regional directory. Software release, approval of public content and recipients, and confirmation of real service coverage are separate steps. See [operator guidance](regional-discovery-operations.md) and the [implementation review](regional-discovery-implementation-review.md) for evidence and release gates.

## Configure without publishing

Open your Care Map, choose **Share**, then expand **Regional directory (optional)**. This works in both existing owner map layouts.

1. Choose **Regional directory** as the embedded view.
2. Select the included local areas and the map extent.
3. Choose services already in your map. Existing selected-venue restrictions still apply.
4. Choose whether each service has approved public map locations or appears in the directory without a pin. Choose its distance source separately. Do not use a home address as a public point.
5. Choose email and phone independently: **Original**, **Hidden**, or **Replace with home-area enquiry contact**.
6. Choose **Save regional settings**. Saving changes the saved configuration, not the published directory.

The availability indicators report approval status without displaying unapproved destinations. If saving succeeds but approval availability cannot refresh, the saved revision remains acknowledged and available for Preview. A separate warning asks you to reload saved settings; unconfirmed availability is cleared. An owner cannot grant publication approval or edit the enquiry registry through this editor. Replacement contacts use the senior's confirmed home area, even when the provider is elsewhere. Original email needs the additional approval for its exact address; changing that address requires renewed approval and explicit publication.

## Preview the saved revision

Choose **Preview saved regional directory** after saving. Preview uses the current saved configuration and the same interface as the visitor view. It does not publish, send a message or create a referral. Unsaved changes disable Preview and explicit regional publication.

Enter a fictional six-digit postal code for local testing. Before real activation, an authorised steward must supply approved test scenarios and confirm actual routing. A recommendation is not confirmation of eligibility, capacity or admission.

The list includes services with no map pin. **View service** opens their details. Co-located services have a chooser. **Back** returns to the chooser or list; **Reset map** fits the currently plotted results, using the configured region when there are no pins, without clearing the postal context. Filtering, hover and Back do not automatically move the map. Escape clears a selected row’s map highlight without leaving the list. **Clear postal** removes location-dependent recommendations, distances and enquiry links. Every postal edit immediately retires the old location's links while the new location is being checked.

If settings changed in another session, your draft stays visible and a conflict message asks you to reload. **Reload saved settings (discard draft)** discards your local changes. Review the saved version before trying again.

## Publish explicitly

Choose **Publish saved regional directory** only when the saved choices and operational approvals are ready. The existing Studio and annotation save checks must finish before publication. A failed save leaves the previous publication in place. The ordinary **Update shared link** action does not promote a regional draft; it retains the existing published view intent. Choosing **Publish compact view** is the explicit way to change the published embedded view back to compact.

A regional URL and copy controls appear only after the server confirms an available regional publication. Saving or previewing cannot create that proof. The regional iframe uses 100% width and a 720-pixel height. The existing compact embed generator and preview are separate and retain their previous dimensions and behavior.

Enable website embedding and configure the exact authorised HTTPS host origins through the existing Share controls. Disabled embedding, unpublishing, failed publication readback or an outdated publication identity removes the regional copy controls. If those controls are missing, resolve the saved/published status instead of constructing a URL from a token.

## Visitor behavior and withdrawal

Visitors choose a service category and enter the senior's six-digit Singapore postal code. The regional route does not read saved Home, profile data, browser location or persistent preferences. Language selection is temporary. An explicitly confirmed outside-area result offers a clearly labelled new-tab link to ordinary Discovery using only the entered postal code. An uncertain or unresolved location does not become an outside-area claim.

The published catalogue and contact intent are frozen, while visibility, permission, effective coverage and recipient approvals are checked on each request. Withdrawal can remove a service, a venue or one contact channel. A withdrawn selected venue never falls back to another location. A missing enquiry channel never exposes an action link, and an older response cannot restore a previous location's recipient.

On a device with a coarse primary pointer, use **Tap to interact**, then **Done** or Escape to return to page scrolling. With a fine primary pointer, pins respond immediately to hover, click and keyboard input; no activation step is needed. Wheel scrolling continues to scroll the host page. The list and map have separate bounded scrolling. Keyboard users can reach View service and use Enter or Space on grouped markers. Browser emulation has been checked; physical-device acceptance remains a separate release exercise.
