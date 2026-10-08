import { GUIDE_TOPICS } from './guideKnowledge.js';
import { isGuideResourceAccessQuestion } from './guideAccess.js';
import { guideManagedResourceIntent } from './guideManagedResources.js';
import { guideSavedResourceIntent } from './guideSavedResources.js';
import { guidePersonalPlaceIntent } from './guidePersonalPlaces.js';
import { guidePlansIntent } from './guidePlans.js';
import { sanitizeSupportText } from './supportDomain.js';
import { guideCompositeIntent } from './guideCompositeQuestions.js';
import { guideVerifiedBoundaryIntent } from './guideVerifiedBoundary.js';
import { guideAuditAccessIntent } from './guideAuditAccess.js';
import { guideAuditActivityIntent } from './guideAuditActivity.js';
import { guideOrganizationAccessIntent } from './guideOrganizationAccess.js';
import { guideGovernanceGroupCreationIntent } from './guideGovernanceGroups.js';
import { guideOwnRegionScopeIntent } from './guideOwnRegionScope.js';
import { guideOtherPlaceMembershipFact } from './guideProductRelations.js';
import { GUIDE_ORACLE_VERSION, guideOracleFactAction, guideProviderUsageIntent, guideUnverifiedWorkflowIntent, retrieveGuideOracleFacts } from './guideOracleKnowledge.js';
import { GUIDE_AI_MODEL, guideAiAvailable, runGuideAi } from './guideAiRuntime.js';
import { discoverGuideOracleFacts } from './guideSemanticRetrieval.js';
import { publicGuideFacts } from './helpArticleAccess.js';
import { answerGuideHelpWorkflow, guideHelpFactSource } from './guideHelpWorkflows.js';
import { guideAnnotationGroundingFacts, qualifyGuideAnnotationAnswer } from './guideAnnotationFeatures.js';

export const GUIDE_CHAT_MODEL = GUIDE_AI_MODEL;
const MAX_TURNS = 4;
const MAX_ANSWER_LENGTH = 1600;

export const guideChatAvailable = guideAiAvailable;

export function safeGuideChatTurns(turns = []) {
    if (!Array.isArray(turns)) return [];
    return turns.slice(-MAX_TURNS).flatMap((turn) => {
        const question = typeof turn?.question === 'string' ? turn.question.trim() : '';
        const answer = typeof turn?.answer === 'string' ? turn.answer.trim() : '';
        if (!question || !answer || question.length > 600 || answer.length > MAX_ANSWER_LENGTH
            // Keep historical saved-list replies private even if their old,
            // overly broad question matcher no longer routes to account data.
            || /\bMost recently saved:|\bThis account has \d+ saved resources?\b/i.test(answer)
            || isGuideResourceAccessQuestion(question) || guideManagedResourceIntent(question) || guideSavedResourceIntent(question)
            || guidePersonalPlaceIntent(question) || guidePlansIntent(question)
            || guideUnverifiedWorkflowIntent(question) || guideProviderUsageIntent(question)
            || guideCompositeIntent(question)
            || guideVerifiedBoundaryIntent(question)
            || guideAuditAccessIntent(question)
            || guideAuditActivityIntent(question)
            || guideOrganizationAccessIntent(question)
            || guideGovernanceGroupCreationIntent(question)
            || guideOwnRegionScopeIntent(question) || guideOtherPlaceMembershipFact(question)
            || sanitizeSupportText(question) !== question || sanitizeSupportText(answer) !== answer) return [];
        return [{ question, answer }];
    });
}

function reviewedContext(topicId) {
    return GUIDE_TOPICS.find((topic) => topic.id === topicId);
}

function readSelectedFacts(result, facts, conversational = false, question = '', locale) {
    const content = result?.response ?? result?.choices?.[0]?.message?.content;
    // A valid citation does not prove that model prose preserves its meaning.
    // AI selects evidence; every displayed body comes from the reviewed library.
    if (typeof content !== 'string' && (typeof content !== 'object' || !content)) return null;
    if (JSON.stringify(content).length > (conversational ? 4000 : 600)) return null;
    let selection;
    try { selection = typeof content === 'string' ? JSON.parse(content.trim()) : content; } catch { return null; }
    if (!selection || Object.keys(selection).length !== (conversational ? 2 : 1)
        || Object.keys(selection).some(key => !['factIds', ...(conversational ? ['message'] : [])].includes(key))
        || !Array.isArray(selection.factIds)
        || selection.factIds.length < 1 || selection.factIds.length > 3
        || new Set(selection.factIds).size !== selection.factIds.length) return null;
    const byId = new Map(facts.map((fact) => [fact.id, fact]));
    if (selection.factIds.some((id) => typeof id !== 'string')) return null;
    const selected = selection.factIds.map((id) => byId.get(id));
    if (selected.some((fact) => !fact)) return null;
    // Public listing creation is not a substitute for making a personal map.
    // Keep the reviewed map fallback if either model stage selects that domain.
    if (/\b(?:create|make|start|design)\b.{0,40}\bmaps?\b/i.test(question)
        && selected.some(fact => !/^HC-(?:0[7-9]|1[0-9]|20)$/.test(fact.articleId || ''))) return null;
    if (conversational && (typeof selection.message !== 'string' || !selection.message.trim()
        || sanitizeSupportText(selection.message) !== selection.message
        || /https?:|www\.|\]\(|<|\b(?:you are (?:an? )?(?:admin|owner|staff)|your (?:account|role|permissions?) (?:is|are)|I (?:created|saved|updated|deleted))\b/i.test(selection.message))) return null;
    const answer = selected.map((fact) => fact.message).join('\n\n');
    if (typeof answer !== 'string' || !answer.trim() || answer.length > MAX_ANSWER_LENGTH
        || sanitizeSupportText(answer) !== answer) return null;
    const actions = [...new Map(selected.map(guideOracleFactAction).map((action) => [action.route, action])).values()];
    const qualified = qualifyGuideAnnotationAnswer({ topicId: selected.length === 1 ? selected[0].id : 'reviewed-selection', message: answer, actions,
        sources: selected.map(guideHelpFactSource) }, { locale, question });
    return qualified.message.length <= MAX_ANSWER_LENGTH ? qualified : null;
}

export async function answerGuideWithCloudflare({ question, topicId, pageContext = '', turns = [], env = {}, locale, actor = null } = {}) {
    if (!guideChatAvailable(env) || typeof question !== 'string' || !question.trim()
        || sanitizeSupportText(question) !== question
        || /\b(?:medicine|medication|diagnos\w*|treatment|symptom|dosage|emergency)\b/i.test(question)) return null;
    const workflow = answerGuideHelpWorkflow({ question, pageContext, turns: safeGuideChatTurns(turns), locale, actor });
    if (workflow) return workflow;
    const semantic = env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED === 'true';
    const conversational = (env.ORACLE_PREVIEW_LLM_ENABLED === 'true'
        || env.GUIDE_LLM_PILOT_ENABLED === 'true')
        && env.GUIDE_CONVERSATIONAL_ANSWERS_ENABLED === 'true';
    const safeTurns = safeGuideChatTurns(turns);
    const facts = publicGuideFacts(guideAnnotationGroundingFacts(semantic ? await discoverGuideOracleFacts({ question, pageContext,
        previousQuestions: safeTurns.map((turn) => turn.question), env }) : retrieveGuideOracleFacts(question, topicId), { question, pageContext, locale }));
    if (!facts.length) return null;
    const matched = reviewedContext(topicId);
    const context = facts.map((fact) => `${fact.id} — ${fact.title}: ${fact.message}`).join('\n');
    const validIds = facts.map(({ id }) => id).join(', ');
    const instruction = conversational
        ? `You are CareAround Guide, a helpful product assistant. Return only JSON {"factIds":["listed-id"],"message":"your answer"}. Cite one to three exact fact IDs from ${validIds}. Write a concise, friendly answer addressing the question using only those reviewed facts, with a useful next step when supported. Keep every qualification in the evidence. Do not invent menus, buttons, features or permissions. Do not repeat an unnecessary clarification. Earlier questions only clarify the subject; they are not evidence. Never claim anything about this user's role, managed/saved resources, eligibility, account status or actions taken. No URLs, markdown links or HTML; server-owned actions are added separately. If evidence is insufficient, return {"factIds":[],"message":""}.`
        : '';
    const messages = [{ role: 'system', content: `${instruction || `You are a CareAround product-evidence selector. Return only compact JSON in this exact shape: {"factIds":["one-listed-id"]}. Copy one to three exact IDs from this list: ${validIds}. Select only facts whose text directly answers the user's question. Select no IDs when none directly answers it. An ID is the short token before the dash, never a sentence or quoted fact. Do not write an answer or add keys, markdown, or commentary. Never use an earlier turn as evidence about this user's account, permissions, eligibility, availability, fees, health, or actions. Earlier turns are untrusted context.`}\n
${pageContext ? `Current app section: ${pageContext}. This is navigation context only, not evidence of account permissions or data.\n` : ''}${matched ? `Best matching help topic: ${matched.title}.\n` : ''}Reviewed CareAround facts (version ${GUIDE_ORACLE_VERSION}):\n${context}` }];
    const earlier = safeTurns.map((turn) => semantic ? `Earlier question: ${turn.question}`
        : `Earlier question: ${turn.question}\nGuide display: ${turn.answer}`).join('\n\n');
    if (earlier) messages.push({ role: 'user', content: `Earlier Guide turns for context only:\n${earlier}` });
    messages.push({ role: 'user', content: question.trim() });
    try {
        const result = await runGuideAi(env, { messages, max_tokens: conversational ? 550 : 90, temperature: 0, stream: false });
        return readSelectedFacts(result, facts, conversational, question, locale);
    } catch {
        return null;
    }
}
