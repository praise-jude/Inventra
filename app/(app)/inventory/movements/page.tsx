import { getStockMovements, MOVEMENT_META } from "@/lib/queries/inventory";
import { requireProfile } from "@/lib/queries/session";
import { relativeDayLabel } from "@/lib/datetime";

export default async function MovementsPage() {
  const [movements, { org }] = await Promise.all([getStockMovements(50), requireProfile()]);

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[var(--shadow-sm)]">
      <div className="scroll overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Type</th>
              <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Product</th>
              <th className="px-3.5 py-[11px] text-right text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Qty</th>
              <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">Reason</th>
              <th className="px-3.5 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">By</th>
              <th className="px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted">When</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const meta = MOVEMENT_META[m.type];
              return (
                <tr key={m.id} className="border-t border-border-2 hover:bg-hover">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[13px]" style={{ background: meta.bg }}>
                        {meta.icon}
                      </span>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-[13px] font-semibold">{m.product_name}</td>
                  <td
                    className="px-3.5 py-3 text-right font-mono text-[13.5px] font-bold"
                    style={{ color: m.qty_delta >= 0 ? "var(--green)" : "var(--red)" }}
                  >
                    {m.qty_delta >= 0 ? `+${m.qty_delta}` : m.qty_delta}
                  </td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">{m.reason ?? "—"}</td>
                  <td className="px-3.5 py-3 text-[12.5px] text-text-2">{m.who}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">{relativeDayLabel(m.created_at, org.timezone)}</td>
                </tr>
              );
            })}
            {movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-muted">
                  No stock movements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
