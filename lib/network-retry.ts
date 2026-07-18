// Small, isomorphic (client + server) helpers for the sign-in/sign-up entry
// points specifically — not a general-purpose fetch wrapper for the rest of
// the API surface. A transient connection blip (the browser or Node's fetch
// having a socket reset mid-request) shouldn't dead-end a user on "Failed to
// fetch" with no path forward; this retries a couple of times and, if it
// still fails, swaps the raw network error text for a message that actually
// tells them what to do.
const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /network\s*error/i,
  /network request failed/i,
  /econnreset/i,
  /econnrefused/i,
  /etimedout/i,
  /fetch failed/i,
  /socket hang up/i,
  /load failed/i, // Safari's equivalent of "Failed to fetch"
];

export function isNetworkErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return NETWORK_ERROR_PATTERNS.some((re) => re.test(message));
}

export function friendlyAuthErrorMessage(message: string | null | undefined): string {
  if (isNetworkErrorMessage(message)) {
    return "Could not reach the server. Check your internet connection and try again.";
  }
  return message || "Something went wrong. Please try again.";
}

// Retries only when the result's `error.message` looks like a transient
// network failure — never for a real auth rejection (wrong password,
// user exists, rate limited, etc.), which should surface immediately.
export async function withAuthRetry<T extends { error: { message: string } | null }>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 400;

  let result: T;
  for (let attempt = 0; attempt <= retries; attempt++) {
    result = await fn();
    if (!result.error || !isNetworkErrorMessage(result.error.message)) {
      return result;
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  return result!;
}
