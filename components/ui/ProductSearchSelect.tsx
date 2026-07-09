"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchProductsForPicker, type ProductPickerRow } from "@/lib/actions/inventory";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

function productLabel(p: ProductPickerRow): string {
  return `${p.name} · ${p.sku}`;
}

// Type-ahead replacement for a native <select> over the full product
// catalog — searches by name/SKU/barcode server-side (debounced) instead of
// shipping every product to the browser, so it stays fast as the catalog
// grows. Single-value, required-field semantics: `value` is the currently
// chosen product (or null), `onChange` fires when the user picks a result.
export function ProductSearchSelect({
  value,
  onChange,
  placeholder = "Search by product name, SKU, or barcode…",
  autoFocus,
}: {
  value: ProductPickerRow | null;
  onChange: (product: ProductPickerRow) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const listboxId = useId();
  const [inputValue, setInputValue] = useState(value ? productLabel(value) : "");
  // Adjusted during render (not an effect) when `value` changes from outside
  // — e.g. the modal resets after submit — per React's guidance for
  // resetting state in response to a prop change.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value ? productLabel(value) : "");
  }

  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProductPickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debouncedQuery = useDebouncedValue(inputValue, 250);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = debouncedQuery.trim();
  const searchable = open && trimmedQuery.length > 0 && !(value && productLabel(value) === trimmedQuery);

  useEffect(() => {
    if (!searchable) return;
    const requestId = ++requestIdRef.current;
    async function run() {
      setLoading(true);
      try {
        const rows = await searchProductsForPicker(trimmedQuery);
        if (requestIdRef.current !== requestId) return;
        setResults(rows);
        setHighlighted(0);
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }
    run();
  }, [searchable, trimmedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setInputValue(value ? productLabel(value) : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  // Nothing to show once the query no longer matches what `results` was
  // fetched for — covers the cleared-input case without clearing state
  // synchronously inside the search effect above.
  const visibleResults = searchable || loading ? results : [];

  function selectProduct(product: ProductPickerRow) {
    onChange(product);
    setInputValue(productLabel(product));
    setResults([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || visibleResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, visibleResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectProduct(visibleResults[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setInputValue(value ? productLabel(value) : "");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={inputValue}
        autoFocus={autoFocus}
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        className="h-[42px] w-full rounded-[9px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-accent"
      />
      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-[9px] border border-border bg-surface shadow-[var(--shadow-lg)]"
        >
          {loading && <div className="px-3.5 py-2.5 text-[13px] text-muted">Searching…</div>}
          {!loading && inputValue.trim() && visibleResults.length === 0 && (
            <div className="px-3.5 py-2.5 text-[13px] text-muted">No products found.</div>
          )}
          {!loading &&
            visibleResults.map((p, i) => (
              <button
                type="button"
                key={p.id}
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => selectProduct(p)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px]"
                style={i === highlighted ? { background: "var(--hover)" } : undefined}
              >
                <span>
                  {p.name} <span className="text-muted">({p.sku})</span>
                </span>
                <span className="font-mono text-[12px] text-muted">{p.qty} on hand</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
