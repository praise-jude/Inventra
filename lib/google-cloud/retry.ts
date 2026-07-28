// Retries only transient failures (rate limiting, GCS-side 5xx) — never
// auth/permission errors (401/403) or not-found (404), which won't
// succeed on retry and should surface immediately so misconfiguration
// (wrong bucket, wrong IAM role) is obvious rather than masked by 3
// silent retries.
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isRetryable(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  return typeof code === "number" && RETRYABLE_STATUS_CODES.has(code);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 300;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
