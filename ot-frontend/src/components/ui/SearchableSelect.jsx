import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select…",
  disabled = false,
  loading = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const lower = query.toLowerCase();
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(lower))
    : options;

  const selected = options.find((o) => String(o.value) === String(value));

  const pick = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div ref={containerRef} className="u-relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        className="z-select searchable-select-trigger"
      >
        <span className={selected ? "u-text-strong" : "u-text-subtle"}>
          {loading ? "Loading…" : (selected?.label ?? placeholder)}
        </span>
        <span className="searchable-select-actions">
          {value && !disabled && (
            <X className="searchable-select-clear" onClick={clear} />
          )}
          <ChevronDown className={`searchable-select-chevron${open ? " is-open" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="z-dropdown searchable-select-menu">
          <div className="searchable-select-search">
            <Search />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
            />
          </div>
          <ul className="searchable-select-list">
            {filtered.length === 0 && (
              <li className="searchable-select-empty">No results</li>
            )}
            {filtered.map((opt) => (
              <li
                key={opt.value}
                onClick={() => pick(opt)}
                className={`z-dropdown-item${String(value) === String(opt.value) ? " is-selected" : ""}`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
