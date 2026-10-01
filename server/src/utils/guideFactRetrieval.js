// A process-local index of reviewed product prose. It never indexes source
// code, evidence pointers, routes, account data, or conversation answers.
const stopWords = new Set('a an and are as at be been before between can could did do does for from get had has have how i if in is it its may me my of on or our same should that the their them then there these they this to using was we were what when where which who why will with would you your'.split(' '));
const wordForms = {
    saved: 'save', saving: 'save', bookings: 'book', booked: 'book', booking: 'book',
    removed: 'remove', removing: 'remove', edited: 'edit', editing: 'edit', registered: 'register',
    programmes: 'programme', programs: 'programme', program: 'programme', activities: 'activity',
    services: 'service', resources: 'resource', places: 'place', maps: 'map', plans: 'plan', groups: 'group',
    sessions: 'session', boundaries: 'boundary', dates: 'date', notes: 'note', annotations: 'annotation',
    templates: 'template', downloads: 'download', files: 'file', versions: 'version', changes: 'change',
    details: 'detail', locations: 'location', permissions: 'permission', organisations: 'organisation',
    organizations: 'organisation', organization: 'organisation', hidden: 'hide', hiding: 'hide',
    exports: 'export', exporting: 'export', included: 'include', including: 'include',
    generated: 'generate', generating: 'generate', planned: 'plan', planning: 'plan',
    confirmed: 'confirm', confirming: 'confirm', confirmation: 'confirm', confirmations: 'confirm',
    reservation: 'reserve', reservations: 'reserve', acknowledgements: 'acknowledge',
    acknowledgments: 'acknowledge', acknowledgement: 'acknowledge', acknowledgment: 'acknowledge',
    acknowledging: 'acknowledge', updates: 'update', updated: 'update', deleting: 'delete', deleted: 'delete',
    sharing: 'share', shared: 'share', restricted: 'restrict', restrictions: 'restrict',
    members: 'member', alerts: 'alert', owners: 'owner', owned: 'own',
    visitors: 'visitor', originals: 'original',
};

const wordForm = (word) => wordForms[word] || (word.length > 3 && /s$/.test(word)
    && !/(?:ss|us|is|ies)$/.test(word) ? word.slice(0, -1) : word);
const literalPhrase = (text) => (String(text).toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || []).join(' ');
const phrase = (text) => literalPhrase(text).split(' ').map(wordForm).join(' ');
const terms = (text) => new Set(phrase(text).split(' ')
    .filter((word) => (word.length > 2 || word === 'qr') && !stopWords.has(word)));

export function guideFactContextMatches(fact, question) {
    const required = new Set((fact.queryRequiresAny || []).flatMap((value) => [...terms(value)]));
    const query = terms(question);
    return !required.size || [...required].some((word) => query.has(word));
}

export function createGuideFactIndex(facts = []) {
    const entries = facts.map((fact) => ({ fact, title: terms(fact.title),
        keywords: terms(fact.keywords.join(' ')), body: terms(fact.message),
        required: new Set((fact.queryRequiresAny || []).flatMap((value) => [...terms(value)])),
        phrases: fact.keywords.filter((keyword) => keyword.length >= 5)
            .map((keyword) => ({ text: phrase(keyword), literal: literalPhrase(keyword),
                multipleWords: literalPhrase(keyword).includes(' '), termCount: terms(keyword).size })),
    }));
    const frequency = new Map();
    for (const entry of entries) {
        for (const word of new Set([...entry.title, ...entry.keywords, ...entry.body]))
            frequency.set(word, (frequency.get(word) || 0) + 1);
    }
    const importance = (word) => Math.log(1 + entries.length / (1 + (frequency.get(word) || 0)));
    return (question = '', { topicId = null, limit = 4, eligible = () => true } = {}) => {
        const query = ` ${phrase(question)} `;
        const literalQuery = ` ${literalPhrase(question)} `;
        const queryTerms = terms(question);
        if (!queryTerms.size) return topicId ? entries.filter(({ fact }) =>
            fact.id === `help-${topicId}` && eligible(fact)).map(({ fact }) => fact) : [];
        const queryWeight = [...queryTerms].reduce((sum, word) => sum + importance(word), 0);
        return entries.filter(({ fact, required }) => eligible(fact)
            && (!required.size || [...required].some((word) => queryTerms.has(word)))).map((entry) => {
            const matched = [...queryTerms].filter((word) =>
                entry.title.has(word) || entry.keywords.has(word) || entry.body.has(word));
            const coverage = matched.reduce((sum, word) => sum + importance(word), 0) / queryWeight;
            const anchors = entry.phrases.filter(({ text, literal, multipleWords }) => multipleWords
                ? query.includes(` ${text} `) : literalQuery.includes(` ${literal} `));
            const content = matched.reduce((sum, word) => sum + importance(word)
                * (entry.title.has(word) ? 3 : entry.keywords.has(word) ? 2 : 1), 0);
            // Literal reviewed phrases retain priority; rarer content words can
            // recover explanations absent from manually anticipated keywords.
            const score = (anchors.length * 50 + content
                + (matched.length && entry.fact.id === `help-${topicId}` ? 2 : 0)) * coverage;
            return { fact: entry.fact, score, matched: matched.length, coverage,
                anchored: anchors.some(({ termCount }) => termCount >= 2), anchorCount: anchors.length };
        }).filter((entry) => (entry.coverage >= 0.4 || (entry.anchored && entry.coverage >= 0.25))
            && (entry.matched >= 2 || entry.anchorCount > 0) && entry.score >= 3)
            .sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id))
            .slice(0, Number.isFinite(limit) ? Math.max(1, Math.min(4, Math.trunc(limit))) : 4)
            .map(({ fact }) => fact);
    };
}
