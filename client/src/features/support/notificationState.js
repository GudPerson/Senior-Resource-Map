export function mergeNotificationPages(current, incoming) {
    const byId = new Map(current.map((item) => [item.id, item]));
    for (const item of incoming) {
        const previous = byId.get(item.id);
        if (!previous || item.revision >= previous.revision) byId.set(item.id, item);
    }
    return [...byId.values()];
}

export function notificationInboxPath(messages, updates) {
    if (updates > 0 && messages === 0) return '/help?tab=inbox&view=updates';
    return messages + updates > 0 ? '/help?tab=inbox' : '/help';
}
