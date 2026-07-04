export interface MovementMeta {
  icon: string;
  bg: string;
  label: string;
  verb: string;
}

export const MOVEMENT_META: Record<string, MovementMeta> = {
  received: { icon: "📥", bg: "var(--green-weak)", label: "Received", verb: "received stock of" },
  sale: { icon: "🛒", bg: "var(--accent-weak)", label: "Sale", verb: "sold" },
  adjustment: { icon: "✏️", bg: "var(--amber-weak)", label: "Adjustment", verb: "adjusted" },
  transfer: { icon: "🔁", bg: "var(--sky-weak)", label: "Transfer", verb: "transferred" },
  return: { icon: "↩️", bg: "var(--red-weak)", label: "Return", verb: "processed a return of" },
  expired: { icon: "🗑️", bg: "var(--red-weak)", label: "Expired", verb: "expired" },
};
