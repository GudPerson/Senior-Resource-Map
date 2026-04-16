import React from 'react';

const Pagination = ({ totalCount, pageSize, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    return (
        <div className="mt-8 flex items-center justify-center gap-2">
            <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="btn-ghost px-3 py-2 disabled:opacity-40"
            >
                Previous
            </button>
            {startPage > 1 && (
                <>
                    <button onClick={() => onPageChange(1)} className={`h-10 w-10 rounded-xl transition ${currentPage === 1 ? 'bg-brand-600 font-bold text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>1</button>
                    {startPage > 2 && <span className="text-slate-400">...</span>}
                </>
            )}
            {pages.map(p => (
                <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`h-10 w-10 rounded-xl transition ${currentPage === p ? 'bg-brand-600 font-bold text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                >
                    {p}
                </button>
            ))}
            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && <span className="text-slate-400">...</span>}
                    <button onClick={() => onPageChange(totalPages)} className={`h-10 w-10 rounded-xl transition ${currentPage === totalPages ? 'bg-brand-600 font-bold text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>{totalPages}</button>
                </>
            )}
            <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="btn-ghost px-3 py-2 disabled:opacity-40"
            >
                Next
            </button>
        </div>
    );
};

export default Pagination;
