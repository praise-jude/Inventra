import { getStockMovements, MOVEMENT_META, type MovementRow } from "@/lib/queries/inventory";
import { requireProfile } from "@/lib/queries/session";
import { relativeDayLabel } from "@/lib/datetime";
import { Table, type TableColumn } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function MovementsPage() {
  const [movements, { org }] = await Promise.all([getStockMovements(50), requireProfile()]);

  const columns: TableColumn<MovementRow>[] = [
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortValue: (m) => MOVEMENT_META[m.type].label,
      render: (m) => {
        const meta = MOVEMENT_META[m.type];
        return (
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[13px]" style={{ background: meta.bg }}>
              {meta.icon}
            </span>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "product",
      header: "Product",
      sortable: true,
      sortValue: (m) => m.product_name,
      render: (m) => <span className="text-[13px] font-semibold">{m.product_name}</span>,
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      sortable: true,
      sortValue: (m) => m.qty_delta,
      render: (m) => (
        <span
          className="font-mono text-[13.5px] font-bold"
          style={{ color: m.qty_delta === 0 ? "var(--muted)" : m.qty_delta > 0 ? "var(--green)" : "var(--red)" }}
        >
          {m.qty_delta === 0 ? "—" : m.qty_delta > 0 ? `+${m.qty_delta}` : m.qty_delta}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (m) => <span className="text-[12.5px] text-text-2">{m.reason ?? "—"}</span>,
    },
    {
      key: "by",
      header: "By",
      render: (m) => <span className="text-[12.5px] text-text-2">{m.who}</span>,
    },
    {
      key: "when",
      header: "When",
      sortable: true,
      sortValue: (m) => m.created_at,
      render: (m) => <span className="font-mono text-[12px] text-muted">{relativeDayLabel(m.created_at, org.timezone)}</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={movements}
      rowKey={(m) => m.id}
      pageSize={20}
      emptyState={<EmptyState compact icon="🗃️" title="No stock movements yet" description="Sales, adjustments, and transfers will show up here." />}
    />
  );
}
