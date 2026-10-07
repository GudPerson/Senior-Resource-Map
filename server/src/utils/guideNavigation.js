export function answerGuideNavigationQuestion(question = '', pageContext = '', signedIn = false) {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\bmy directory\b/.test(query)
        || !/^(?:where\s+(?:is|can\s+i\s+(?:find|see|open|access)|do\s+i\s+(?:find|see|open|access))|how\s+(?:do|can)\s+i\s+(?:open|go\s+to|get\s+to|find|navigate\s+to|access)|open|go\s+to|navigate\s+to)\b/.test(query)) return null;
    if (!signedIn) return { topicId: 'my-directory-navigation',
        message: 'Sign in, then open My Directory to see resources you saved, Care Maps and My Places.',
        actions: [{ label: 'Sign in', route: '/login' }] };
    return { topicId: 'my-directory-navigation',
        message: pageContext === 'My Directory'
            ? 'You are already on My Directory. It contains resources you saved, Care Maps and My Places. To see resources assigned to you to manage, open Manage My Resources from the dashboard.'
            : 'Open My Directory from the dashboard to see resources you saved, Care Maps and My Places. Resources assigned to you to manage are in Manage My Resources.',
        actions: [{ label: 'Open My Directory', route: '/my-directory' }] };
}
