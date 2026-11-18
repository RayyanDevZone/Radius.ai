"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";

/**
 * Client-side search for list pages. The server renders the rows (cells are
 * ReactNodes) plus a plain-text `search` string per row; filtering happens here
 * so typing is instant and needs no round trip.
 */

type SearchLabels = { placeholder: string; clear: string; noResults: string; noResultsHint: string };

/** `srOnly`: the header is read by screen readers but not shown (e.g. the ⋮ actions column). */
export type TableColumn = { label: string; className?: string; srOnly?: boolean };
export type TableRow = { id: string; search: string; cells: ReactNode[] };
/** `node` is the full `<li>` rendered on the server. */
export type GridItem = { id: string; search: string; node: ReactNode };

/** Whitespace-insensitive, case-insensitive: "mh12" matches "MH 12 AB 1234", "98765 43210" matches "+919876543210". */
const compact = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function useFilter<T extends { search: string }>(items: T[]) {
  const [query, setQuery] = useState("");
  const index = useMemo(() => items.map((it) => compact(it.search)), [items]);
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = tokens.length === 0 ? items : items.filter((_, i) => tokens.every((tok) => index[i].includes(tok)));
  return { query, setQuery, filtered };
}

function SearchInput({ value, onChange, labels }: { value: string; onChange: (v: string) => void; labels: SearchLabels }) {
  return (
    <div className="relative w-full max-w-sm">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        data-testid="section-search"
        className="h-10 w-full rounded-full border border-accent-strong/60 bg-white/70 pl-10 pr-10 text-sm shadow-sm outline-none transition placeholder:text-muted focus:border-foreground/40 focus:ring-2 focus:ring-accent-strong/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={labels.clear}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-accent/60 hover:text-foreground"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        </button>
      )}
    </div>
  );
}

function NoResults({ labels }: { labels: SearchLabels }) {
  return (
    <div data-testid="search-no-results" className="rounded-2xl border border-dashed border-foreground/20 px-6 py-10 text-center">
      <p className="font-medium">{labels.noResults}</p>
      <p className="mt-1 text-sm text-muted">{labels.noResultsHint}</p>
    </div>
  );
}

export function SearchableTable({
  columns,
  rows,
  labels,
  testId,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  labels: SearchLabels;
  testId?: string;
}) {
  const { query, setQuery, filtered } = useFilter(rows);

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={query} onChange={setQuery} labels={labels} />
      {filtered.length === 0 ? (
        <NoResults labels={labels} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-accent-strong/60 bg-white/70 shadow-sm">
          <table className="w-full text-left text-sm" data-testid={testId}>
            <thead>
              <tr className="border-b border-foreground/10 bg-accent/40">
                {columns.map((c, i) => (
                  <th key={i} scope="col" className={`whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-[0.1em] text-muted ${c.className ?? ""}`}>
                    {c.srOnly ? <span className="sr-only">{c.label}</span> : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-foreground/10 transition-colors first:border-t-0 hover:bg-accent/25">
                  {row.cells.map((cell, i) => (
                    <td key={i} className={`px-4 py-3 align-middle ${columns[i]?.className ?? ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SearchableGrid({
  items,
  labels,
  testId,
  className,
}: {
  items: GridItem[];
  labels: SearchLabels;
  testId?: string;
  className: string;
}) {
  const { query, setQuery, filtered } = useFilter(items);

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={query} onChange={setQuery} labels={labels} />
      {filtered.length === 0 ? (
        <NoResults labels={labels} />
      ) : (
        <ul className={className} data-testid={testId}>
          {filtered.map((it) => (
            <Fragment key={it.id}>{it.node}</Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
