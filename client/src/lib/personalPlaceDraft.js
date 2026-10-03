export function isGenericPersonalPlaceDraft(draft) {
    const label = String(draft?.legacyCategoryLabel || draft?.categoryLabel || '').trim().toLowerCase();
    return Boolean(draft?.id && draft.categoryId === null && !draft.category?.id
        && (!label || label === 'personal place'));
}

export function getPersonalPlaceDraftCategoryId(draft, activeCategories = []) {
    if (isGenericPersonalPlaceDraft(draft)) return '';
    const fallbackCategory = activeCategories.find(category => category.name === draft?.categoryLabel);
    return String(draft?.categoryId || draft?.category?.id || fallbackCategory?.id || activeCategories[0]?.id || '');
}
