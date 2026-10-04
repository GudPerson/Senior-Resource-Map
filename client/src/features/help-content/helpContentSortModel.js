// Draft ordering only: identities, content and attachment ownership stay intact.
export function moveCmsId(ids, activeId, targetId) {
    const from = ids.indexOf(activeId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to || new Set(ids).size !== ids.length) return ids;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
}

export function placeCmsItem(items, activeId, targetId, visibleIds = items.map((item) => item.id)) {
    const ids = items.filter((item) => visibleIds.includes(item.id)).map((item) => item.id), next = moveCmsId(ids, activeId, targetId);
    if (next === ids) return items;
    let index = 0;
    const byId = new Map(items.map((item) => [item.id, item]));
    return items.map((item) => ids.includes(item.id) ? byId.get(next[index++]) : item);
}

export function placeCmsArticle(workspace, activeId, targetId, visibleIds = workspace.manifest.articleOrder) {
    const active = workspace.articles.find((item) => item.id === activeId);
    const target = workspace.articles.find((item) => item.id === targetId);
    if (!active || !target || active.category !== target.category) return workspace;
    const peers = workspace.manifest.articleOrder.filter((id) => visibleIds.includes(id) && workspace.articles.find((item) => item.id === id)?.category === active.category);
    const next = moveCmsId(peers, activeId, targetId);
    if (next === peers) return workspace;
    let index = 0;
    return { ...workspace, manifest: { ...workspace.manifest, articleOrder: workspace.manifest.articleOrder.map((id) => peers.includes(id) ? next[index++] : id) } };
}

export function placeCmsStep(section, activeId, targetId) {
    const ids = moveCmsId(section.stepIds, activeId, targetId);
    if (ids === section.stepIds) return section;
    return { ...section, stepIds: ids, steps: ids.map((id) => section.steps[section.stepIds.indexOf(id)]) };
}

export function cmsSortTarget(rows, y) {
    if (!rows.length || !Number.isFinite(y)) return null;
    const inside = rows.find((row) => y >= row.top && y <= row.bottom);
    if (inside) return inside.id;
    return rows.reduce((nearest, row) => Math.abs((row.top + row.bottom) / 2 - y) < Math.abs((nearest.top + nearest.bottom) / 2 - y) ? row : nearest).id;
}
