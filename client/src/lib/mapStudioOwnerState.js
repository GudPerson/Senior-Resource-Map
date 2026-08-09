import {
    createMapStudioSession,
    createMapStudioView,
    deleteMapStudioView,
    duplicateMapStudioView,
    MAP_STUDIO_MODE_DESIGN,
    migrateMapStudioDocument,
    normalizeMapStudioDocument,
    patchMapStudioDraft,
    patchMapStudioExploration,
    renameMapStudioView,
    saveMapStudioView,
    selectMapStudioView,
    setMapStudioMode,
    setDefaultMapStudioView,
} from './mapStudioState.js';

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function rebuildSession(document, session, activeViewId = session?.activeViewId) {
    return createMapStudioSession(document, {
        activeViewId,
        mode: session?.mode,
        exploration: session?.exploration,
    });
}

function requireCleanDesignDraft(state) {
    if (state?.session?.dirty) {
        throw new Error('Save or discard the current Map Studio draft before changing view settings.');
    }
}

function replaceWorkingDocument(state, workingDocument, activeViewId = state?.session?.activeViewId) {
    const normalizedDocument = normalizeMapStudioDocument(workingDocument);
    return {
        ...state,
        workingDocument: normalizedDocument,
        session: rebuildSession(normalizedDocument, state?.session, activeViewId),
    };
}

export function createMapStudioOwnerState(serverDocument, defaults = {}) {
    const document = migrateMapStudioDocument(serverDocument, defaults);
    return {
        persistedDocument: clone(document),
        workingDocument: clone(document),
        session: createMapStudioSession(document),
    };
}

export function isMapStudioOwnerStateDirty(state) {
    if (!state?.persistedDocument || !state?.workingDocument || !state?.session) return false;
    return Boolean(state.session.dirty)
        || JSON.stringify(state.workingDocument) !== JSON.stringify(state.persistedDocument);
}

export function getMapStudioOwnerRuntimeSnapshot(state) {
    if (!state?.session || !state?.workingDocument || !state?.persistedDocument) {
        return null;
    }
    const activeView = state.workingDocument.views.find(
        (view) => view.id === state.session.activeViewId,
    );
    if (!activeView) return null;

    return {
        schemaVersion: state.session.schemaVersion,
        activeViewId: state.session.activeViewId,
        activeViewName: activeView.name,
        mode: state.session.mode,
        design: clone(state.session.draftDesign),
        exploration: clone(state.session.exploration),
        designDirty: Boolean(state.session.dirty),
        ownerDirty: isMapStudioOwnerStateDirty(state),
    };
}

export function setOwnerMapStudioMode(state, mode) {
    return {
        ...state,
        session: setMapStudioMode(state.session, mode),
    };
}

export function patchOwnerMapStudioDraft(state, patch = {}) {
    if (state?.session?.mode !== MAP_STUDIO_MODE_DESIGN) {
        throw new Error('Enter Map Studio Design mode before changing the view design.');
    }
    return {
        ...state,
        session: patchMapStudioDraft(state.session, patch),
    };
}

export function patchOwnerMapStudioExploration(state, patch = {}) {
    return {
        ...state,
        session: patchMapStudioExploration(state.session, patch),
    };
}

export function createUniqueMapStudioViewId(document, entropy = Date.now().toString(36)) {
    const normalizedDocument = normalizeMapStudioDocument(document);
    const suffix = String(entropy || 'new')
        .trim()
        .replace(/[^A-Za-z0-9:_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 68) || 'new';
    const existingIds = new Set(normalizedDocument.views.map((view) => view.id));
    let candidate = `view-${suffix}`;
    let sequence = 2;
    while (existingIds.has(candidate)) {
        const sequenceSuffix = `-${sequence}`;
        candidate = `view-${suffix.slice(0, 80 - sequenceSuffix.length - 5)}${sequenceSuffix}`;
        sequence += 1;
    }
    return candidate;
}

export function selectOwnerMapStudioView(state, viewId, options = {}) {
    return {
        ...state,
        session: selectMapStudioView(
            state.workingDocument,
            state.session,
            viewId,
            options,
        ),
    };
}

export function discardOwnerMapStudioDraft(state) {
    return {
        ...state,
        session: rebuildSession(state.workingDocument, state.session),
    };
}

export function createOwnerMapStudioView(state, options) {
    requireCleanDesignDraft(state);
    const workingDocument = createMapStudioView(state.workingDocument, options);
    return replaceWorkingDocument(state, workingDocument, options.id);
}

export function duplicateOwnerMapStudioView(state, sourceViewId, options) {
    requireCleanDesignDraft(state);
    const workingDocument = duplicateMapStudioView(
        state.workingDocument,
        sourceViewId,
        options,
    );
    return replaceWorkingDocument(state, workingDocument, options.id);
}

export function renameOwnerMapStudioView(state, viewId, name) {
    requireCleanDesignDraft(state);
    return replaceWorkingDocument(
        state,
        renameMapStudioView(state.workingDocument, viewId, name),
    );
}

export function setDefaultOwnerMapStudioView(state, viewId) {
    requireCleanDesignDraft(state);
    return replaceWorkingDocument(
        state,
        setDefaultMapStudioView(state.workingDocument, viewId),
    );
}

export function deleteOwnerMapStudioView(state, viewId) {
    requireCleanDesignDraft(state);
    const workingDocument = deleteMapStudioView(state.workingDocument, viewId);
    const activeViewId = state.session.activeViewId === viewId
        ? workingDocument.defaultViewId
        : state.session.activeViewId;
    return replaceWorkingDocument(state, workingDocument, activeViewId);
}

export function discardOwnerMapStudioChanges(state) {
    const activeViewStillExists = state.persistedDocument.views.some(
        (view) => view.id === state.session.activeViewId,
    );
    const activeViewId = activeViewStillExists
        ? state.session.activeViewId
        : state.persistedDocument.defaultViewId;
    const workingDocument = clone(state.persistedDocument);
    return {
        persistedDocument: clone(state.persistedDocument),
        workingDocument,
        session: rebuildSession(workingDocument, state.session, activeViewId),
    };
}

export function prepareMapStudioOwnerSave(state) {
    const persistedDocument = normalizeMapStudioDocument(state.persistedDocument);
    const workingDocument = normalizeMapStudioDocument(state.workingDocument);
    const staged = state.session.dirty
        ? saveMapStudioView(workingDocument, state.session).document
        : workingDocument;

    return {
        payload: {
            ...staged,
            revision: persistedDocument.revision,
        },
        activeViewId: state.session.activeViewId,
        mode: state.session.mode,
        exploration: clone(state.session.exploration),
    };
}

export function acknowledgeMapStudioOwnerSave(state, serverDocument, saveContext = {}) {
    const persistedDocument = normalizeMapStudioDocument(serverDocument);
    const activeViewId = persistedDocument.views.some(
        (view) => view.id === saveContext.activeViewId,
    )
        ? saveContext.activeViewId
        : persistedDocument.defaultViewId;
    return {
        persistedDocument: clone(persistedDocument),
        workingDocument: clone(persistedDocument),
        session: createMapStudioSession(persistedDocument, {
            activeViewId,
            mode: saveContext.mode ?? state?.session?.mode,
            exploration: saveContext.exploration ?? state?.session?.exploration,
        }),
    };
}
