// Product relations use reviewed facts, never account data or inferred grants.
// Keep private-list removals and account checks separate from public effects.
export function guideProviderUsageLookup(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:listings?|places?|centres?|centers?|programmes?|programs?|services?|offerings?)\b/.test(query)
        || !/\b(?:sav(?:e|ed|es)|bookmark(?:ed)?|heart(?:ed)?|view(?:ed|s)?|opened|clicked)\b/.test(query)
        || /\bwho\s+(?:i|you|we)\s+(?:am|are)\b/.test(query)) return false;
    const marker = /\b(?:how\s+many|who|which\s+(?:people|users?|members))\b/.exec(query);
    if (!marker) return false;
    const prefix = query.slice(0, marker.index);
    const suffix = query.slice(marker.index + marker[0].length);
    // Counting one's resources is different from identifying/counting savers.
    if (marker[0].startsWith('how')
        && /^\s+(?:(?:my|saved|the)\s+)*(?:resources?|listings?|places?|programmes?|services?|offerings?|favo(?:u)?rites?)\b/.test(suffix)) return false;
    // A relative clause can describe people affected by a listing operation.
    // Explicit "show me people who saved" still requests a saver lookup.
    if (marker[0] === 'who' && /\b(?:people|users?|members|someone|everyone|anyone|person)\s+$/.test(prefix))
        return /\b(?:show|list|identify|see|view|find|count|check)\b/.test(prefix);
    return true;
}

export function guideSavedIdentityPrivacyFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    const save = /\b(?:sav(?:e|ed|ing)|bookmark(?:ed|ing)?|heart(?:ed|ing)?|favo(?:u)?rit(?:e|es|ed|ing))\b/.test(query);
    const resource = /\b(?:places?|programmes?|programs?|services?|offerings?|resources?|listings?|classes|class|activities|activity)\b/.test(query)
        || /\bmy\s+directory\b/.test(query);
    const identity = /\b(?:my|your|our)\s+(?:name|identity|profile|(?:personal\s+)?details|personal\s+information)\b|\bwho\s+i\s+am\b|\b(?:identify|recognise|recognize)\s+me\b/.test(query);
    const exposure = /\b(?:sees?|knows?|learn(?:s|ed|ing)?|receiv(?:e|es|ed|ing)|recognis(?:e|es|ed)|recogniz(?:e|es|ed)|identify|reveal(?:s|ed)?|show(?:s|n)?|shar(?:e|es|ed|ing)|send(?:s|ing)?|sent|tells?|told|notif(?:y|ies|ied)|public|visible|expos(?:e|es|ed|ing))\b/.test(query);
    // A sharing/export request or eligibility diagnosis has a separate boundary.
    if (!save || !resource || !identity || !exposure
        || /\b(?:maps?|exports?|downloads?|embeds?|print|eligib\w*|qualif\w*)\b/.test(query)
        || /^(?:(?:please|can\s+you|could\s+you|would\s+you|will\s+you)\s+)*(?:send|share|notify)\b/.test(query)) return null;
    return 'saved-identity-privacy';
}

export function guideProviderIdentityCheckFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '');
    const provider = /\b(?:providers?|centres?|centers?)\b|\b(?:listing|programme|service|offering)\s+owner\b/.test(query);
    const identity = /\bmy\s+(?:name|identity|profile|(?:personal\s+)?details|personal\s+information)\b/.test(query);
    const inspection = /\b(?:check|verify|confirm|find\s+out|tell\s+me)\b/.test(query);
    const pastDelivery = /\b(?:already|ever|previously|has|have|was|been)\b/.test(query)
        && /\b(?:sent|told|shared|received|exposed|disclosed|delivered|informed)\b/.test(query);
    if (!provider || !identity || !inspection || !pastDelivery
        || /\b(?:password|otp|sign[-\s]*in|log[-\s]*in|maps?|exports?|downloads?|eligib\w*|qualif\w*)\b/.test(query)) return null;
    return 'guide-provider-identity-check';
}

export function guideSavedMembershipRelationFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '');
    const saved = /\b(?:sav(?:e|ed|ing)|bookmark(?:ed|ing)?|heart(?:ed|ing)?|favo(?:u)?rit(?:e|es|ed|ing))\b/.test(query);
    const membership = /\b(?:membership|join|joined|joining)\b/.test(query);
    const comparison = /\b(?:same\s+(?:thing|as)|difference\s+between|different\s+from|versus|vs|equivalent|separate\s+from)\b/.test(query);
    const directoryEffect = /\bmy\s+directory\b/.test(query) && /\bautomatic(?:ally)?\b/.test(query)
        && /\b(?:listing|place|centre|center)s?\b/.test(query);
    if (!membership || (!(saved && comparison) && !directoryEffect)
        || /\b(?:hosts?|templates?|groups?|maps?|plans?|personal\s+places?|edit|editing|manage|remove|delete|unsave|eligib\w*|qualif\w*)\b/.test(query)) return null;
    return 'saved-versus-membership';
}

export function guideOtherPlaceMembershipFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    const place = /\b(?:places?|centres?|centers?)\b/.test(query);
    const membership = /\b(?:members?|memberships?|joined|joining|belongs?|belonging)\b/.test(query);
    const lookup = /\b(?:which|where|who|list|show|see|view|find|check|review|look\s*up|tell|confirm)\b/.test(query);
    const person = '(?:friends?|colleagues?|co-?workers?|teammates?|neighbours?|neighbors?|fathers?|mothers?|parents?|dads?|mums?|moms?|children|child|sons?|daughters?|spouses?|husbands?|wives|wife|siblings?|brothers?|sisters?|grandparents?|grandfathers?|grandmothers?|(?:another|other|different)\\s+(?:person|people|users?|accounts?)|someone\\s+else)';
    // The person must own or be the subject of the membership clause. A parent
    // mentioned only as someone to tell must not replace "my memberships".
    const otherMembership = new RegExp('\\b' + person + '\\b(?:s)?\\s+(?:(?!(?:my|our|i|we|me|this)\\b)[a-z]+\\s+){0,4}(?:members?|memberships?|joined|joining|belongs?|belonging)\\b').test(query)
        || new RegExp('\\bmemberships?\\s+(?:of|for|belonging\\s+to)\\s+(?:(?:my|our|your|the|a)\\s+)?' + person + '\\b').test(query);
    if (!place || !membership || !lookup || !otherMembership
        || /\b(?:organisation|organization|governance|coordination|region)\s+groups?\b/.test(query)) return null;
    return 'other-place-memberships';
}

export function guideMembershipNavigationFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    const own = /\b(?:i|my|me|this\s+account)\b/.test(query);
    const place = /\b(?:places?|centres?|centers?)\b/.test(query);
    const membership = /\b(?:memberships?|joined|joining)\b/.test(query);
    const navigation = /^(?:where|how)\b/.test(query)
        && /\b(?:see|find|view|check|review|open|access|where)\b/.test(query);
    if (guideOtherPlaceMembershipFact(query) || !own || !place || !membership || !navigation
        || /\b(?:colleagues?|friends?|co-?workers?|teammates?|(?:another|other)\s+(?:person|people|accounts?)|someone\s+else|organisations?|organizations?|governance|groups?|templates?|maps?|edit|change|remove|delete|eligib\w*|qualif\w*)\b/.test(query)) return null;
    return 'place-membership-navigation';
}

export function guideHostMembershipRelationFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '');
    const place = /\b(?:places?|centres?|centers?|venues?)\b/.test(query);
    const offering = /\b(?:programmes?|programs?|services?|offerings?)\b/.test(query);
    const host = /\b(?:hosts?|hosted|hosting|link|linked|linking)\b/.test(query);
    const membership = /\b(?:members?|membership|join|joined|joining)\b/.test(query);
    const comparison = /\b(?:same\s+(?:thing|as)|difference\s+between|different\s+from|versus|vs|equivalent|separate\s+(?:relationships?|things?|from))\b|\b(?:make|makes|made|turns?)\s+(?:me|you|us|someone)\s+(?:into\s+)?(?:a\s+)?(?:place\s+)?members?\b|\bbecome(?:s)?\s+(?:a\s+)?(?:place\s+)?members?\b/.test(query);
    const enrolmentEffect = /^(?:does|will|would)\b/.test(query.trim())
        && /\b(?:saved|bookmarked|savers)\b/.test(query)
        && /\b(?:enroll?(?:s|ed|ing|ment)?|register(?:s|ed|ing)?|sign\s+up)\b/.test(query);
    if (!place || !offering || !host || (!(membership && comparison) && !enrolmentEffect)
        || /\b(?:templates?|place\s+versions?|groups?|maps?|personal\s+places?)\b/.test(query)) return null;
    return 'offering-host-versus-membership';
}

export function guidePlaceAssignmentScopeFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '');
    const place = /\b(?:places?|centres?|centers?)\b/.test(query);
    const assignment = /\b(?:owners?|staff)\b/.test(query)
        && /\b(?:assignments?|access|roles?)\b|\b(?:as|an?|the|being|am|im)\s+(?:place\s+)?(?:owner|staff)\b|\bowner\s+(?:of|at)\b/.test(query);
    const scope = /\b(?:all|every|any|another|other|different)\s+(?:(?:the|public|other)\s+){0,2}(?:places?|centres?|centers?)\b/.test(query)
        && /\b(?:edit|change|update|manage)\b/.test(query);
    // Assigning people is a different question from the reach of an assignment.
    if (!place || !assignment || !scope
        || /\b(?:add|assign|invite|remove|revoke|grant)\b.{0,60}\b(?:staff|owners?)\b/.test(query)
        || /\b(?:transfer|reassign)\b|\b(?:change|replace)\s+(?:(?:the|its?|our)\s+)?owner(?:ship)?\b/.test(query)
        || /\b(?:groups?|templates?|place\s+versions?|maps?|personal\s+places?)\b/.test(query)) return null;
    return 'place-assignment-scope';
}

export function guideHiddenSavedResourceFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '');
    const resource = /\b(?:places?|programmes?|programs?|services?|offerings?|resources?|listings?)\b/.test(query);
    const hidden = /\bhid(?:e|es|den|ing)\b/.test(query);
    const saved = /\b(?:saved|bookmarked|favo(?:u)?rites?)\b|\bmy\s+directory\b/.test(query);
    const effect = /\b(?:remov\w*|delet\w*|disappear\w*|eras\w*|keep|remain|lose|happen\w*|gone|vanish|affect)\b/.test(query);
    // Hiding a pin or removing one's own saved item has different semantics.
    if (!resource || !hidden || !saved || !effect
        || /\b(?:maps?|plans?|personal\s+places?)\b/.test(query)
        || /\b(?:hide|remove|delete|unsave)\b.{0,70}\bfrom\s+(?:my\s+directory|my\s+saved\s+list)\b/.test(query)) return null;
    return 'hidden-saved-resources';
}

export function guideReviewedRelationFact(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '');
    const publicSaved = guideHiddenSavedResourceFact(query);
    if (publicSaved) return publicSaved;
    const providerIdentityCheck = guideProviderIdentityCheckFact(query);
    if (providerIdentityCheck) return providerIdentityCheck;
    const identityPrivacy = guideSavedIdentityPrivacyFact(query);
    if (identityPrivacy) return identityPrivacy;
    const otherMembership = guideOtherPlaceMembershipFact(query);
    if (otherMembership) return otherMembership;
    const savedMembership = guideSavedMembershipRelationFact(query);
    if (savedMembership) return savedMembership;
    const membershipNavigation = guideMembershipNavigationFact(query);
    if (membershipNavigation) return membershipNavigation;
    const hostMembership = guideHostMembershipRelationFact(query);
    if (hostMembership) return hostMembership;
    const placeScope = guidePlaceAssignmentScopeFact(query);
    if (placeScope) return placeScope;
    const guideRequest = /\b(?:guide|you|please|for\s+me)\b/.test(query)
        || /^(?:enable|disable|turn\s+(?:on|off)|mute|unmute)\b/.test(query.trim());
    if (guideRequest && /\b(?:enable|disable|turn\s+(?:on|off)|mute|unmute|change|set)\b/.test(query)
        && /\b(?:notifications?|alerts?|notification\s+preferences|saved\s+schedule\s+changes)\b/.test(query)
        && !/\b(?:sign[-\s]*in|log[-\s]*in|password|verify|verification|otp|recovery|provider|contact)\b/.test(query))
        return 'guide-notification-controls';
    const resource = /\b(?:places?|programmes?|programs?|services?|offerings?|resources?|listings?)\b/.test(query);
    const save = /\b(?:sav(?:e|ed|ing)|bookmark(?:ed|ing)?|heart(?:ed|ing)?)\b/.test(query);
    const rights = /\b(?:edit(?:or|ing)?|manag(?:e|er|ing)|permissions?|rights?)\b/.test(query);
    const effect = /\b(?:become|give|grant|allow|let|enough|able|permission|rights)\b|\bcan\s+i\b/.test(query);
    if (resource && save && rights && effect && !/^how\b/.test(query.trim())
        && !/\bsave\s+(?:the\s+)?changes\b|\b(?:maps?|my\s+plans?|personal\s+places?)\b/.test(query))
        return 'saved-versus-managed';
    if (/\bhid(?:e|den|ing)\b/.test(query)
        && /\b(?:erase|delet\w*|permanent\w*|undo)\b/.test(query)
        && (resource || /\bdirectory\s+entry\b/.test(query))
        && !/\b(?:my\s+(?:map|plans?|directory)|saved\s+list|personal\s+place)\b/.test(query))
        return 'resource-hide-delete';
    if (/\b(?:programmes?|programs?|services?|offerings?)\b/.test(query)
        && /\b(?:restrict\w*|member[-\s]*only|profile\s+criteria|eligibility)\b/.test(query)
        && /\b(?:everyone|anyone|same|different|friends?|shown|visible)\b/.test(query))
        return 'offering-eligibility';
    if (/\b(?:notifications?|alerts?|updates?)\b/.test(query)
        && /\b(?:whatsapp|email|sms)\b/.test(query)
        && /\bin[-\s]*app\b|\b(?:carearound|profile|saved|programmes?|services?|resources?|schedules?|updates?)\b/.test(query)
        && !/\b(?:sign[-\s]*in|log[-\s]*in|password|verify|verification|otp|recovery|provider|contact)\b/.test(query))
        return 'notification-delivery-channels';
    if (/\b(?:export\w*|download\w*)\b/.test(query)
        && /\b(?:workbooks?|spreadsheets?|excel|files?)\b/.test(query)
        && /\b(?:refresh\w*|automatic\w*|track\w*|sync\w*|up[-\s]*to[-\s]*date)\b/.test(query)
        && !/\b(?:import\w*|upload\w*|boundar\w*|regions?|templates?)\b/.test(query))
        return /\bmaps?\b/.test(query)
            ? /\b(?:private|personal)\b/.test(query) && /\b(?:share|sharing|send|email)\b/.test(query)
                ? 'private-map-export-sharing' : 'my-map-exports'
            : 'resource-export-context';
    return null;
}
