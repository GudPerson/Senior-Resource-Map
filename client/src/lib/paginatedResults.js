export const DEFAULT_RESOURCE_PAGE_TIMEOUT_MS = 45_000;

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function normalizePaginatedResponse(response, defaultPageSize = 500) {
    if (Array.isArray(response)) {
        return {
            data: response,
            pagination: {
                page: 1,
                pageSize: response.length || defaultPageSize,
                totalCount: response.length,
                totalPages: 1,
            },
        };
    }

    return {
        data: Array.isArray(response?.data) ? response.data : [],
        pagination: {
            page: Number(response?.pagination?.page || 1),
            pageSize: Number(response?.pagination?.pageSize || defaultPageSize),
            totalCount: Number(response?.pagination?.totalCount || 0),
            totalPages: Number(response?.pagination?.totalPages || 1),
        },
    };
}

export function withTimeoutOrThrow(promise, timeoutMs = DEFAULT_RESOURCE_PAGE_TIMEOUT_MS, message = 'Resource page timed out.') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
    ]);
}

export async function fetchPaginatedResultPage(fetchPage, params = {}, options = {}) {
    const {
        page = 1,
        pageSize = 500,
        maxAttempts = 3,
        pageTimeoutMs = DEFAULT_RESOURCE_PAGE_TIMEOUT_MS,
        waitMs = wait,
    } = options;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await withTimeoutOrThrow(
                fetchPage({ ...params, page, pageSize }),
                pageTimeoutMs,
                'Resource page timed out.',
            );
            return normalizePaginatedResponse(response, pageSize);
        } catch (err) {
            lastError = err;
            if (attempt < maxAttempts) {
                await waitMs(350 * attempt);
            }
        }
    }

    throw lastError || new Error('Resource page failed to load.');
}

function uniquePaginatedItems(items = []) {
    const seenIds = new Set();
    return items.filter((item) => {
        const id = item?.id;
        if (!Number.isInteger(id)) return true;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
    });
}

export async function fetchPaginatedResultsPartial(fetchPage, params = {}, options = {}) {
    const settings = typeof options === 'number' ? { pageSize: options } : options;
    const pageSize = settings.pageSize || 500;
    const maxConcurrentPages = Math.max(1, Number(settings.maxConcurrentPages || 2));
    const firstResponse = settings.firstResponse || await fetchPaginatedResultPage(fetchPage, params, {
        ...settings,
        page: 1,
        pageSize,
    });

    const totalPages = Math.max(1, firstResponse.pagination.totalPages || 1);
    const responses = [firstResponse];
    const failedPages = [];

    if (totalPages > 1) {
        const remainingResponses = new Array(totalPages - 1);
        let nextIndex = 0;

        async function runPageWorker() {
            while (nextIndex < remainingResponses.length) {
                const index = nextIndex;
                nextIndex += 1;
                const page = index + 2;

                try {
                    remainingResponses[index] = await fetchPaginatedResultPage(fetchPage, params, {
                        ...settings,
                        page,
                        pageSize,
                    });
                } catch (err) {
                    failedPages.push({
                        page,
                        error: err,
                    });
                }
            }
        }

        await Promise.all(
            Array.from(
                { length: Math.min(maxConcurrentPages, remainingResponses.length) },
                () => runPageWorker(),
            ),
        );
        responses.push(...remainingResponses.filter(Boolean));
    }

    const data = uniquePaginatedItems(responses.flatMap((response) => response.data));
    return {
        data,
        pagination: {
            ...firstResponse.pagination,
            page: 1,
            pageSize,
            totalPages,
            loadedPages: responses.length,
            failedPages: failedPages.map((failure) => failure.page).sort((left, right) => left - right),
            isPartial: failedPages.length > 0,
        },
        failedPages,
    };
}

export async function fetchAllPaginatedResults(fetchPage, params = {}, options = {}) {
    const settings = typeof options === 'number' ? { pageSize: options } : options;
    const pageSize = settings.pageSize || 500;
    const maxConcurrentPages = Math.max(1, Number(settings.maxConcurrentPages || 2));
    const firstResponse = await fetchPaginatedResultPage(fetchPage, params, {
        ...settings,
        page: 1,
        pageSize,
    });

    const totalPages = Math.max(1, firstResponse.pagination.totalPages || 1);
    if (totalPages === 1) {
        return firstResponse.data;
    }

    const remainingResponses = new Array(totalPages - 1);
    let nextIndex = 0;

    async function runPageWorker() {
        while (nextIndex < remainingResponses.length) {
            const index = nextIndex;
            nextIndex += 1;
            remainingResponses[index] = await fetchPaginatedResultPage(fetchPage, params, {
                ...settings,
                page: index + 2,
                pageSize,
            });
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(maxConcurrentPages, remainingResponses.length) },
            () => runPageWorker(),
        ),
    );

    const flattened = [
        ...firstResponse.data,
        ...remainingResponses.flatMap((response) => response.data),
    ];

    return uniquePaginatedItems(flattened);
}
