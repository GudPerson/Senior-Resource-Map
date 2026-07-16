import {
    assertHelpAssistantAiAllowed,
    getCachedAiResult,
    readBooleanEnv,
    readEnvValue,
    setCachedAiResult,
} from './aiCostControls.js';
import {
    getHelpCapabilities,
    getHelpSuggestions,
    HELP_KNOWLEDGE,
    HELP_KNOWLEDGE_VERSION,
    materializeHelpEntry,
    normalizeHelpRouteContext,
} from './helpKnowledge.js';

const DEFAULT_HELP_MODEL = '@cf/meta/llama-3.2-1b-instruct';
const MAX_QUESTION_LENGTH = 500;
const MIN_MATCH_SCORE = 4;
const AI_REWRITE_STOP_WORDS = new Set([
    'about',
    'after',
    'again',
    'before',
    'being',
    'could',
    'current',
    'does',
    'from',
    'have',
    'into',
    'once',
    'only',
    'return',
    'that',
    'their',
    'there',
    'these',
    'this',
    'until',
    'when',
    'where',
    'which',
    'with',
    'your',
]);

function normalizeText(value = '') {
    return String(value || '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^a-z0-9\s-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function redactHelpQuestion(value = '') {
    return String(value || '')
        .slice(0, MAX_QUESTION_LENGTH)
        .replace(/https?:\/\/\S+/gi, '[link removed]')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
        .replace(/\b(?:\+?\d[\d\s()-]{5,}\d)\b/g, '[number removed]')
        .replace(/\b(?:token|password|passcode|otp|nric)\s*[:=]\s*\S+/gi, '$1 [removed]')
        .trim();
}

function scoreEntry(entry, normalizedQuestion, routeContext) {
    let score = 0;
    const title = normalizeText(entry.title);
    if (normalizedQuestion === title) score += 12;
    if (normalizedQuestion.includes(title) || title.includes(normalizedQuestion)) score += 6;

    for (const keyword of entry.keywords || []) {
        const normalizedKeyword = normalizeText(keyword);
        if (!normalizedKeyword) continue;
        if (normalizedQuestion.includes(normalizedKeyword)) {
            score += normalizedKeyword.includes(' ') ? 6 : 3;
        }
    }

    if ((entry.routeContexts || []).includes(routeContext)) score += 2;
    return score;
}

export function findHelpEntry({ question, topicId, routeContext } = {}) {
    if (topicId) {
        const exact = HELP_KNOWLEDGE.find((entry) => entry.id === topicId);
        if (exact) return { entry: exact, score: 100, exact: true };
    }

    const normalizedQuestion = normalizeText(question);
    if (!normalizedQuestion) return null;

    const matches = HELP_KNOWLEDGE
        .map((entry) => ({
            entry,
            score: scoreEntry(entry, normalizedQuestion, routeContext),
        }))
        .sort((a, b) => b.score - a.score);

    return matches[0]?.score >= MIN_MATCH_SCORE
        ? { ...matches[0], exact: false }
        : null;
}

function extractAiText(result) {
    if (typeof result === 'string') return result.trim();
    if (typeof result?.response === 'string') return result.response.trim();
    if (typeof result?.result?.response === 'string') return result.result.response.trim();
    return '';
}

function significantWords(value = '') {
    return new Set(normalizeText(value)
        .split(' ')
        .filter((word) => word.length >= 5 && !AI_REWRITE_STOP_WORDS.has(word)));
}

export function isAcceptableAiRewrite(message, verifiedMessage) {
    const normalizedMessage = normalizeText(message);
    if (normalizedMessage.length < 45) return false;

    const verifiedWords = significantWords(verifiedMessage);
    const messageWords = significantWords(message);
    let overlap = 0;
    for (const word of verifiedWords) {
        if (messageWords.has(word)) overlap += 1;
    }

    return overlap >= Math.min(2, verifiedWords.size);
}

function buildAiPrompt({ question, verifiedMessage, locale }) {
    return [
        'You are CareAround Guide, a concise in-app navigation and troubleshooting assistant.',
        'Rewrite only the verified guidance below in clear, calm language.',
        'Do not add facts, routes, buttons, promises, medical advice, eligibility advice, or actions.',
        'Do not ask for or repeat personal information.',
        'Use no more than 90 words. If the selected locale is not English, keep the answer in English because translated help has not been human-reviewed.',
        `Selected locale: ${locale || 'en'}`,
        `User question: ${question}`,
        `Verified guidance: ${verifiedMessage}`,
    ].join('\n');
}

async function rewriteWithWorkersAi(runtimeEnv, {
    question,
    routeContext,
    locale,
    entry,
    response,
    capabilities,
}) {
    if (!readBooleanEnv(runtimeEnv, 'HELP_ASSISTANT_AI_ENABLED', false)) return null;
    if (!runtimeEnv?.AI || typeof runtimeEnv.AI.run !== 'function') return null;

    const redactedQuestion = redactHelpQuestion(question);
    if (!redactedQuestion) return null;

    const cachePayload = {
        knowledgeVersion: HELP_KNOWLEDGE_VERSION,
        question: normalizeText(redactedQuestion),
        routeContext,
        locale: locale || 'en',
        entryId: entry.id,
        capabilityKeys: Object.keys(capabilities).filter((key) => capabilities[key]).sort(),
    };
    const cached = await getCachedAiResult(runtimeEnv, 'help-assistant', cachePayload);
    if (cached?.message && isAcceptableAiRewrite(cached.message, response.message)) {
        return cached.message;
    }

    await assertHelpAssistantAiAllowed(runtimeEnv);
    const model = readEnvValue(runtimeEnv, 'HELP_ASSISTANT_AI_MODEL') || DEFAULT_HELP_MODEL;
    const gatewayId = readEnvValue(runtimeEnv, 'HELP_ASSISTANT_AI_GATEWAY_ID') || 'default';
    const result = await runtimeEnv.AI.run(model, {
        messages: [
            {
                role: 'user',
                content: buildAiPrompt({
                    question: redactedQuestion,
                    verifiedMessage: response.message,
                    locale,
                }),
            },
        ],
        max_tokens: 180,
        temperature: 0.1,
    }, {
        gateway: {
            id: gatewayId,
            cacheTtl: 24 * 60 * 60,
            collectLog: false,
            metadata: {
                feature: 'carearound-help',
                knowledge_version: HELP_KNOWLEDGE_VERSION,
            },
        },
    });

    const message = extractAiText(result).slice(0, 1200);
    if (!message || !isAcceptableAiRewrite(message, response.message)) return null;
    await setCachedAiResult(runtimeEnv, 'help-assistant', cachePayload, { message });
    return message;
}

export async function answerHelpQuestion(runtimeEnv, {
    user,
    question = '',
    topicId = '',
    pathname = '',
    locale = 'en',
} = {}) {
    const routeContext = normalizeHelpRouteContext(pathname);
    const capabilities = getHelpCapabilities(user);
    const suggestions = getHelpSuggestions({ routeContext, capabilities });
    const match = findHelpEntry({ question, topicId, routeContext });

    if (!match) {
        return {
            message: 'I could not verify that workflow yet. Try one of the help topics below, or describe the screen and the exact error message without including personal information.',
            actions: [],
            suggestions,
            source: 'fallback',
            knowledgeVersion: HELP_KNOWLEDGE_VERSION,
        };
    }

    const response = materializeHelpEntry(match.entry, capabilities);
    let message = response.message;
    let source = 'verified';

    if (!match.exact && question) {
        try {
            const rewritten = await rewriteWithWorkersAi(runtimeEnv, {
                question,
                routeContext,
                locale,
                entry: match.entry,
                response,
                capabilities,
            });
            if (rewritten) {
                message = rewritten;
                source = 'ai-assisted';
            }
        } catch {
            // The verified response remains available when AI is disabled, over quota, or unavailable.
        }
    }

    return {
        id: response.id,
        title: response.title,
        message,
        actions: response.actions,
        suggestions,
        source,
        knowledgeVersion: HELP_KNOWLEDGE_VERSION,
    };
}
