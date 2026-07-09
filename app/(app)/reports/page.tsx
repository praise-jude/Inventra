import { requireManagerProfile } from "@/lib/queries/session";
import { getWarehouseOptions, getProductOptions } from "@/lib/queries/products";
import {
  getSalesSummary,
  getSalesByPeriod,
  getSalesByBranch,
  getSalesByProduct,
  getSalesByStaff,
  getInventoryValuation,
  getProfitLoss,
  type Granularity,
} from "@/lib/queries/reports";
import { ReportsClient } from "@/components/reports/ReportsClient";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const VALID_TABS = ["sales", "valuation", "pl"] as const;
const VALID_GRANULARITY: Granularity[] = ["day", "week", "month", "year"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireManagerProfile();
  const params = await searchParams;

  const tab = (VALID_TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as (typeof VALID_TABS)[number]) : "sales";
  const granularity = VALID_GRANULARITY.includes(params.granularity as Granularity) ? (params.granularity as Granularity) : "month";
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const from = params.from || isoDate(monthAgo);
  const to = params.to || isoDate(today);
  const branchId = params.branch || undefined;
  const productId = params.product || undefined;

  const [branches, products] = await Promise.all([getWarehouseOptions(), getProductOptions()]);

  let salesData = null;
  let valuationData = null;
  let plData = null;

  if (tab === "sales") {
    const [summary, byPeriod, byBranch, byProduct, byStaff] = await Promise.all([
      getSalesSummary(from, to, branchId),
      getSalesByPeriod(from, to, granularity, branchId),
      getSalesByBranch(from, to),
      getSalesByProduct(from, to, branchId),
      getSalesByStaff(from, to, branchId),
    ]);
    salesData = { summary, byPeriod, byBranch, byProduct, byStaff };
  } else if (tab === "valuation") {
    valuationData = await getInventoryValuation(branchId);
  } else {
    plData = await getProfitLoss(from, to, branchId, productId);
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight">Reports</div>
        <div className="mt-[3px] text-text-2">Exportable reports across sales, inventory, and profitability.</div>
      </div>
      <ReportsClient
        tab={tab}
        from={from}
        to={to}
        branchId={branchId ?? ""}
        productId={productId ?? ""}
        granularity={granularity}
        branches={branches}
        products={products}
        salesData={salesData}
        valuationData={valuationData}
        plData={plData}
      />
    </div>
  );
}
