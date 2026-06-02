import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("…");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  return (
    <div className="z-pagination">
      <p className="z-pagination-info">
        Showing <strong>{from}–{to}</strong> of <strong>{totalItems}</strong>
      </p>
      <div className="z-pagination-controls">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="z-pagination-btn"
          aria-label="Previous page"
        >
          <ChevronLeft className="u-w-4 u-h-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="z-pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`z-pagination-btn${currentPage === p ? " is-active" : ""}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="z-pagination-btn"
          aria-label="Next page"
        >
          <ChevronRight className="u-w-4 u-h-4" />
        </button>
      </div>
    </div>
  );
}
