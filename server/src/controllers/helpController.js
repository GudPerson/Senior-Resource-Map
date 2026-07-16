import { z } from 'zod';

import { answerHelpQuestion } from '../utils/helpAssistant.js';

const helpRequestSchema = z.object({
    question: z.string().trim().max(500).optional().default(''),
    topicId: z.string().trim().max(80).optional().default(''),
    context: z.object({
        pathname: z.string().trim().max(240).optional().default(''),
        locale: z.string().trim().max(12).optional().default('en'),
    }).optional().default({}),
}).refine((value) => Boolean(value.question || value.topicId), {
    message: 'Enter a question or select a help topic.',
});

export async function askHelpQuestion(c) {
    let body;
    try {
        body = helpRequestSchema.parse(await c.req.json());
    } catch (error) {
        return c.json({
            error: error?.issues?.[0]?.message || 'Invalid help request.',
        }, 400);
    }

    const result = await answerHelpQuestion(c.env, {
        user: c.get('user'),
        question: body.question,
        topicId: body.topicId,
        pathname: body.context.pathname,
        locale: body.context.locale,
    });

    return c.json(result);
}
