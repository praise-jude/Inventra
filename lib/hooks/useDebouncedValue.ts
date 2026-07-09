import { useEffect, useState } from "react";

// Returns `value`, but only after it hasn't changed for `delayMs` — used to
// throttle re-filtering/re-querying on every keystroke in search inputs.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
