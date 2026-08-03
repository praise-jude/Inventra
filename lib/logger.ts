import "server-only";

// Structured, leveled logging for server-side code (Server Actions, route
// handlers, query functions) — replaces ad hoc `console.error(...)` calls at
// the "key flow" call sites with a consistent shape: feature, action,
// timestamp, and (when available) who it happened to. DEBUG never emits in
// production; INFO/WARN/ERROR always do.
//
// This is intentionally NOT an events/analytics pipeline — business events
// (sale created, stock transferred, product updated, etc.) already have a
// mature, DB-backed home in lib/actions/audit.ts's logAudit()/audit_logs.
// This logger is for technical operational logging only.

type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** The module/screen this log belongs to, e.g. "Sales", "Invoices", "Auth". */
  feature: string;
  /** The specific operation, e.g. "recordSale", "createInvoice". */
  action?: string;
  userId?: string;
  orgId?: string;
}

function emit(level: LogLevel, context: LogContext, message: string, extra?: Record<string, unknown>) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    feature: context.feature,
    action: context.action,
    userId: context.userId,
    orgId: context.orgId,
    message,
    ...extra,
  };
  const prefix = `[Inventra][${level.toUpperCase()}][${context.feature}${context.action ? `:${context.action}` : ""}]`;
  if (level === "error") console.error(prefix, message, entry);
  else if (level === "warn") console.warn(prefix, message, entry);
  else console.log(prefix, message, entry);
}

export function logInfo(context: LogContext, message: string, extra?: Record<string, unknown>): void {
  emit("info", context, message, extra);
}

export function logWarn(context: LogContext, message: string, extra?: Record<string, unknown>): void {
  emit("warn", context, message, extra);
}

// Never emits in production — for local/dev-only diagnostic noise.
export function logDebug(context: LogContext, message: string, extra?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  emit("debug", context, message, extra);
}

export function logError(context: LogContext, message: string, error: unknown, extra?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  emit("error", context, message, {
    ...extra,
    errorMessage: err.message,
    // Stack traces can leak file paths/internals — dev-only, same tradeoff
    // next.config.ts's CSP comment already makes elsewhere in this codebase.
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
}
