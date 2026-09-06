// History and report handoffs carry explicit question inputs, never resource
// payloads, arbitrary answer HTML, private context, or recovery credentials.
export function guideHistoryInputs(messages) {
    return messages.slice(-20).flatMap(({ input }) => {
        if (typeof input?.topicId === 'string') return [{ topicId: input.topicId }];
        if (typeof input?.question === 'string') return [{ question: input.question }];
        return [];
    });
}

export function buildGuideReportDraft(message) {
    if (!message?.input) return null;
    const question = typeof message.input.question === 'string' ? message.input.question
        : typeof message.question === 'string' ? message.question : '';
    if (!question.trim()) return null;
    return { title: `Help with: ${question}`.slice(0, 120),
        description: `I asked the Guide:\n${question.slice(0, 600)}\n\nThe problem I need help with:\n` };
}
