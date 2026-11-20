import { useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { findSnapshotAddressesWithinArea } from '../lib/addressSnapshotClient.js';
import { createAreaAddressSearchIndex, filterAreaAddressSearchIndex, normalizeAreaAddressQuery } from '../lib/mapAreaAddressSearch.js';
import { createPinnedAreaAddressCompletion } from '../lib/pinnedAreaAddressCompletion.js';
import { getMatchingSelectionState, updateMatchingSelection } from '../lib/matchingSelection.js';

const EMPTY = [];
export const ADDRESS_PAGE_SIZE = 200;

export function useAreaAddressFilter({ area, scopeKey, tab, result, wholeArea, scanRows, ordinaryBusy }) {
    const [completion] = useState(() => createPinnedAreaAddressCompletion({ fetchPage: findSnapshotAddressesWithinArea }));
    const preparation = useSyncExternalStore(completion.subscribe, completion.getSnapshot);
    const [query, setQuery] = useState('');
    const [filteredLimit, setFilteredLimit] = useState(ADDRESS_PAGE_SIZE);
    const [unfilteredLimit, setUnfilteredLimit] = useState(ADDRESS_PAGE_SIZE);
    const [selected, setSelected] = useState(() => new Set());
    const [selectWhenReady, setSelectWhenReady] = useState(false);
    const normalized = normalizeAreaAddressQuery(query).join(' ');
    const filtering = Boolean(normalized);
    // Ordinary result.rows is a validated contiguous prefix beginning at zero.
    const complete = wholeArea ? scanRows : preparation.completedRows
        || (result && result.rows.length === result.total ? result.rows : null);
    const source = complete || result?.rows || EMPTY;
    const getIndex = useMemo(() => {
        let index;
        return () => index ??= createAreaAddressSearchIndex(source);
    }, [source]);
    const matches = useMemo(() => filtering
        ? (complete ? filterAreaAddressSearchIndex(getIndex(), normalized.split(' ')) : EMPTY)
        : source, [normalized, filtering, complete, getIndex, source]);
    const keys = useMemo(() => new Set(matches.map(row => row.id)), [matches]);
    const selection = useMemo(() => getMatchingSelectionState(selected, keys), [selected, keys]);
    const selectedRows = useMemo(() => selected.size ? source.filter(row => selected.has(row.id)) : EMPTY, [source, selected]);
    const limit = filtering ? filteredLimit : Math.max(unfilteredLimit, result?.rows.length || 0);
    const rows = useMemo(() => matches.length > limit ? matches.slice(0, limit) : matches, [matches, limit]);
    const needsPreparation = !wholeArea && result && !complete && (filtering || selectWhenReady);

    useLayoutEffect(() => {
        setQuery('');
        setFilteredLimit(ADDRESS_PAGE_SIZE);
        setUnfilteredLimit(ADDRESS_PAGE_SIZE);
        setSelected(new Set());
        setSelectWhenReady(false);
        return completion.reset;
    }, [area, scopeKey, completion]);

    useLayoutEffect(() => {
        if (tab !== 'addresses') {
            setSelectWhenReady(false);
            if (preparation.status !== 'ready') completion.reset();
        } else if (!needsPreparation && preparation.status === 'error') {
            // With no outstanding search or select-all intent, manual paging owns the verified prefix again.
            completion.reset();
        } else if (!ordinaryBusy && needsPreparation && preparation.status === 'idle') {
            void completion.start({ area, scopeKey, snapshot: result.snapshot, total: result.total, rows: result.rows });
        } else if (complete && selectWhenReady) {
            setSelectWhenReady(false);
            setSelected(current => updateMatchingSelection(current, keys, true));
        }
    }, [area, scopeKey, tab, result, ordinaryBusy, needsPreparation, preparation.status, completion, complete, keys, selectWhenReady]);

    function editQuery(value) {
        setSelectWhenReady(false);
        setFilteredLimit(ADDRESS_PAGE_SIZE);
        setQuery(value);
    }
    function resetSource() {
        completion.reset();
        setSelected(new Set());
        setSelectWhenReady(false);
        setFilteredLimit(ADDRESS_PAGE_SIZE);
        setUnfilteredLimit(ADDRESS_PAGE_SIZE);
    }
    function toggleAll() {
        if (!complete) setSelectWhenReady(true);
        else setSelected(current => updateMatchingSelection(current, keys, !selection.checked));
    }
    function toggleRow(id) {
        setSelectWhenReady(false);
        setSelected(current => updateMatchingSelection(current, [id], !current.has(id)));
    }
    function showMore() {
        if (filtering) setFilteredLimit(current => current + ADDRESS_PAGE_SIZE);
        else setUnfilteredLimit(limit + ADDRESS_PAGE_SIZE);
    }
    return { query, editQuery, filtering, complete, rows, matches, selectedRows, selected, selection,
        preparation, preparing: preparation.status === 'preparing' || (needsPreparation && preparation.status === 'idle'),
        resume: completion.resume, resetSource, toggleAll, toggleRow, showMore };
}
