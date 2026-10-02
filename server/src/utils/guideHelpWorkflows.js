import { GUIDE_ORACLE_FACTS, HELP_ARTICLES } from '../generated/helpKnowledge.js';
import { publicGuideFacts } from './helpArticleAccess.js';
import { guideOracleFactAction } from './guideOracleKnowledge.js';

const normalise = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();

export function guideHelpWorkflowIntent(question = '', pageContext = '', turns = []) {
    const query = normalise(question);
    if (/\b(?:ai|llm|model|guide)\b/.test(query)
        && /\b(?:unavailable|offline|disabled|off|expired|not (?:working|available|responding)|isnt (?:working|available|responding)|budget (?:limit|exhausted)|limit (?:reached|exceeded))\b/.test(query))
        return 'article-hc-29-read-help-without-ai';
    const otherPerson = /\b(?:colleagues?|co-?workers?|teammates?|friends?|another\s+(?:user|person|account)|someone\s+else|other\s+(?:user|person|account))s?\b/.test(query);
    if (otherPerson && /\b(?:show|list|count|read|see|which)\b/.test(query)
        && /\b(?:saved|favourites?|favorites?|directory)\b/.test(query)
        && (!/\b(?:my|our|your)\s+(?:private\s+)?(?:saved|directory|favourites?|favorites?)\b/.test(query)
            || /\b(?:colleagues|co-?workers|teammates|friends|another\s+(?:users|persons|accounts)|someone\s+elses|other\s+(?:users|persons|accounts))\b\s+(?:private\s+)?my\s+directory\b/.test(query))
        && /\b(?:colleagues?|co-?workers?|teammates?|friends?|another\s+(?:user|person|account)|someone\s+else|other\s+(?:user|person|account))s?\b.{0,50}\b(?:saved|favourites?|favorites?|directory)\b/.test(query))
        return 'other-account-saved-privacy';
    if (otherPerson && /\b(?:show|list|read|see|which|view|check)\b/.test(query)
        && /\b(?:colleagues|co-?workers|teammates|friends|another\s+(?:users|persons|accounts)|someone\s+elses|other\s+(?:users|persons|accounts))\b\s+(?:private\s+)?(?:places?|centres?|centers?)\s+memberships?\b/.test(query))
        return 'other-place-memberships';
    if (!otherPerson && /\b(?:save|saving)\b/.test(query)
        && /\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b/.test(query)
        && /\b(?:immediately|right now|now|for me|without\s+(?:review|confirmation))\b/.test(query)
        && !/\b(?:create|creating|make|new|personal\s+places?|private\s+(?:places?|planning\s+locations?))\b/.test(query))
        return 'article-hc-31-guide-review-resource-save-steps';
    if (/\b(?:create|make)\b.{0,30}\b(?:programme|program|service)\b/.test(query)
        && /\b(?:without\s+(?:review|confirmation)|immediately|right now|now)\b/.test(query)) return 'guide-create-scope';
    // General product rules and navigation do not assert a current account grant.
    if (!otherPerson && /^(?:where|how)\b/.test(query)
        && /\b(?:see|find|view|open|access)\b/.test(query)
        && /\blistings?\b/.test(query)
        && /\b(?:i|my account)\b.{0,25}\bmanage\b/.test(query)) return 'article-hc-06-manage-listings';
    if (!otherPerson && /\b(?:organisation|organization)\b/.test(query)
        && /\b(?:membership|members?|role|access)\b/.test(query)
        && /\b(?:edit|editing|manage|managing)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|places?|resources?|listings?)\b/.test(query)
        && !/\b(?:am i|do i have|can i|my account|this account)\b/.test(query)) return 'article-hc-33-organisation-edit-boundary';
    if (!otherPerson && /\b(?:plans?|calendar)\b/.test(query)
        && /\b(?:add|adding|save|saving|record|recording)\b/.test(query)
        && /\b(?:register|registration|book|booking|reserve|confirm|confirmation)\b/.test(query)
        && !/\b(?:edit|editing|manage|permission|access|delete|remove)\b/.test(query)) return 'plans-not-bookings';
    if (!otherPerson && (pageContext === 'My Maps' || /\bmaps?\b/.test(query))
        && /\bnotes?\b/.test(query) && /\bannotations?\b/.test(query)
        && /\b(?:share|shared|sharing|public|publish|published|privacy|visitors?)\b/.test(query)
        && !/\b(?:groups?|programmes?|programs?|services?|offerings?|events?)\b/.test(query)
        && !/\b(?:personal\s+places?|private\s+(?:places?|planning\s+locations?))\b/.test(query))
        return 'map-note-annotation-sharing';
    if (!otherPerson && /^how\b/.test(query) && /\b(?:map\s+)?studio\b/.test(query)
        && /\b(?:shared|published)\s+(?:map|link|snapshot)\b/.test(query)
        && /\b(?:changes?|edits?|updates?|view|presentation)\b/.test(query)
        && /\b(?:reach|publish|update|refresh|show|appear|apply|make|get|push|share|sync)\b/.test(query)
        && !/\b(?:notes?|annotations?|personal|permissions?|allowed|access|authori[sz]ed|roles?)\b/.test(query))
        return 'map-studio-share-update';
    if (!otherPerson && /\b(?:map|studio|view)\b/.test(query)
        && /\b(?:share|shared|public)\b/.test(query) && /\b(?:link|snapshot|layout|view)\b/.test(query)
        && /\b(?:old|outdated|stale|not updated|hasnt updated|unchanged)\b/.test(query)) return 'map-studio-share-update';
    if (/\b(?:personal\s+places?|private\s+(?:places?|planning\s+locations?))\b/.test(query)
        && /\b(?:shared\s+maps?|published\s+maps?|exports?|downloads?|visitors?)\b/.test(query)
        && !/\b(?:convert|conversion|turn into|make public)\b/.test(query)) return 'personal-place-sharing';
    if (/\bmaps?\b/.test(query) && /\b(?:saved|saving|save)\b/.test(query)
        && /\b(?:resources?|places?|centres?|centers?|listings?|programme|service)\b/.test(query)
        && /\b(?:automatically|every map|not on|not in|not inside|missing|same thing|put it on)\b/.test(query)
        && !/\b(?:eligibility|members.only|hidden|cancel|cancelled|close|shared|publish\w*)\b/.test(query)) return 'map-membership';
    if (/\bmap\b/.test(query) && /\b(?:cancel|cancelled|canceling|cancelling|close|abandon)\b/.test(query)
        && /\b(?:save|saved|saving)\b/.test(query)) return 'map-create-cancel-save-effects';
    if (/\b(?:map|pins?|markers?)\b/.test(query) && /\b(?:no pin|without a pin|missing pin|not pinned|pin missing|marker missing|marker is missing|map marker is missing|not shown on|not showing on|list.only)\b/.test(query))
        return 'map-missing-pin';
    const location = /\b(?:places?|locations?|address(?:es)?|points?|spots?|centres?|centers?|somewhere)\b/.test(query);
    const creation = /\b(?:add|adding|create|creating|put|mark|pin)\b/.test(query)
        || (/\b(?:save|saving)\b/.test(query) && /\b(?:new|missing|unlisted)\b/.test(query));
    // Group membership, someone else's map, and Programme hosts have their own
    // existing scoped paths; mentioning a Place does not make them Place creation.
    if (otherPerson || /\b(?:groups?|programmes?|programs?|services?|offerings?|events?)\b/.test(query)) return null;
    const personal = /\b(?:personal|private|planning)\s+(?:places?|locations?|points?|spots?)\b/.test(query);
    const missing = /\b(?:not found|not listed|unlisted|missing|doesnt exist|does not exist|isnt listed|not available|cant find|cannot find)\b|\bnot\b.{0,35}\b(?:carearound|care around|directory)\b/.test(query);
    if (!location || !creation) return null;
    // Explicit public creation is resolved by the existing permission path.
    if (!personal && /\bpublic\b|\b(?:directory|discover)\s+listing\b|\b(?:publish|list)\b.{0,25}\b(?:everyone|public|directory)\b/.test(query)) return 'public-place-create';
    const earlier = Array.isArray(turns) ? turns.slice(-1).map((turn) => normalise(turn?.question)).join(' ') : '';
    const map = pageContext === 'My Maps' || /\b(?:my|private|own|this)\s+maps?\b/.test(query)
        || (!pageContext && /\bmy map\b/.test(earlier));
    if (!personal && !missing && !map) return null;
    if (personal && !map) return null; // Preserve the separate My Places creation workflow.
    return map ? 'personal-place-map-create' : 'clarify-place-create';
}

export function guideHelpFactSource(fact) {
    return { id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed,
        ...(fact.articleId ? { articleId: fact.articleId } : {}),
        ...(fact.sectionId ? { sectionId: fact.sectionId } : {}),
        ...(fact.articleRoute ? { articleRoute: fact.articleRoute } : {}),
    };
}

function publicHelpSection(factId, facts) {
    const fact = publicGuideFacts(facts).find((item) => item.id === factId);
    if (!fact) return null;
    const section = HELP_ARTICLES.find((article) => article.id === fact.articleId
        && article.visibility === 'public')?.sections.find((item) => item.id === fact.sectionId);
    return section ? { fact, section } : null;
}

// Compose the two reviewed sharing procedures without re-authoring their
// instructions or changing the original migration facts. The short prerequisites
// are also taken from the same approved public reader sections.
function answerGuideMapNoteAnnotationSharing(facts) {
    const ids = ['article-hc-15-private-map-note-steps', 'article-hc-16-draw-annotation-steps',
        'article-hc-15-shared-map-note-steps', 'article-hc-16-share-annotation-steps'];
    const publicFacts = publicGuideFacts(facts);
    const selected = ids.map((id) => publicFacts.find((fact) => fact.id === id));
    if (selected.some((fact) => !fact)) return null;
    const sections = selected.map((fact) => HELP_ARTICLES.find((article) => article.id === fact.articleId
        && article.visibility === 'public')?.sections.find((section) => section.id === fact.sectionId));
    const [noteDefaults, annotationDefaults, noteSharing, annotationSharing] = sections;
    if (!noteDefaults?.paragraphs?.[0] || !annotationDefaults?.notes?.[0]
        || !noteSharing?.title || !annotationSharing?.title) return null;
    return { topicId: 'map-note-annotation-sharing', answerKind: 'procedure',
        message: [noteDefaults.paragraphs[0], annotationDefaults.notes[0],
            noteSharing.title + '\n\n' + selected[2].message,
            annotationSharing.title + '\n\n' + selected[3].message].join('\n\n'),
        actions: [{ label: 'Open My Maps', route: '/my-directory?section=my-maps' }],
        sources: selected.map(guideHelpFactSource) };
}

export function answerGuideHelpWorkflow({ question = '', pageContext = '', turns = [], facts = GUIDE_ORACLE_FACTS } = {}) {
    const intent = guideHelpWorkflowIntent(question, pageContext, turns);
    if (!intent || intent === 'public-place-create') return null;
    if (intent === 'clarify-place-create') return {
        topicId: 'place-create-clarification', answerKind: 'clarification',
        message: 'Do you want to add a private Personal place to your own map, or create a public Place listing in CareAround?',
        actions: [], sources: [],
    };
    if (intent === 'map-note-annotation-sharing') {
        const answer = answerGuideMapNoteAnnotationSharing(facts);
        if (answer) return answer;
    }
    const factId = intent === 'map-membership' ? 'map-resource-update-procedure' : intent;
    const fact = publicGuideFacts(facts).find((item) => item.id === factId);
    const cancellationNote = intent === 'map-create-cancel-save-effects'
        ? publicHelpSection(factId, facts)?.section.notes?.[1] : null;
    if (!fact || (intent === 'map-create-cancel-save-effects' && !cancellationNote)) {
        return { topicId: 'place-create-clarification', answerKind: 'clarification',
            message: intent === 'personal-place-map-create'
                ? 'Do you mean a private Personal place on your map? Open your map to review its Personal place controls, or use Help Centre for the reviewed instructions.'
                : 'The complete reviewed instructions for this map task are not available yet. Browse Help Centre or report the problem without including private map details.',
            actions: [{ label: 'Browse help', route: '/help-centre' }], sources: [] };
    }
    let message = cancellationNote || fact.message;
    const sources = [guideHelpFactSource(fact)];
    if (intent === 'guide-create-scope') {
        const confirmation = publicHelpSection('article-hc-31-guide-programme-confirmation-steps', facts);
        if (confirmation?.section.notes?.[0]) {
            message += '\n\n' + confirmation.section.notes[0];
            sources.push(guideHelpFactSource(confirmation.fact));
        }
    } else if (intent === 'personal-place-sharing') {
        const personalPlaces = publicGuideFacts(facts).find((item) => item.id === 'my-places');
        if (personalPlaces) {
            message += '\n\n' + personalPlaces.message;
            sources.push(guideHelpFactSource(personalPlaces));
        }
    }
    return { topicId: intent, answerKind: cancellationNote ? 'reviewed' : fact.answerKind || 'reviewed', message,
        actions: [cancellationNote || fact.route.startsWith('/help-centre/')
            ? { label: 'Read instructions', route: fact.articleRoute || fact.route }
            : fact.route === '/my-directory?section=my-maps'
                ? { label: fact.actionLabel || 'Open My Maps', route: fact.route }
                : guideOracleFactAction(fact)],
        sources };
}

export function guideAnswerHelpFacts(answer, facts = GUIDE_ORACLE_FACTS) {
    const ids = new Set([answer?.topicId, `help-${answer?.topicId}`, ...(answer?.sources || []).map((source) => source.id)]);
    return facts.filter((fact) => ids.has(fact.id));
}

export function addGuideHelpCitations(answer, facts = GUIDE_ORACLE_FACTS) {
    if (!answer) return answer;
    let result = answer;
    // The existing account answer remains authoritative. A denied public Place
    // request can still offer the approved access-review next step, without
    // creating a write action or implying that the instructions grant access.
    if (answer.topicId === 'resource-access' && answer.answerSource === 'account'
        && !answer.actions?.length
        && guideHelpWorkflowIntent(answer.input?.question, answer.input?.pageContext) === 'public-place-create') {
        const creation = publicHelpSection('article-hc-34-create-public-place', facts);
        if (creation?.section.notes?.[0]) result = { ...answer,
            message: answer.message + '\n\n' + creation.section.notes[0],
            sources: [...(answer.sources || []), guideHelpFactSource(creation.fact)] };
    }
    const basic = publicGuideFacts(facts).find((fact) => fact.id === `help-${result.topicId}`
        && fact.message === result.message);
    if (!result.sources?.length && basic) result = { ...result, sources: [guideHelpFactSource(basic)] };
    if (!Array.isArray(result.sources)) return result;
    const byId = new Map(facts.map((fact) => [fact.id, fact]));
    return { ...result, sources: result.sources.map((source) => {
        const fact = byId.get(source.id);
        return fact ? { ...source, ...guideHelpFactSource(fact) } : source;
    }) };
}
