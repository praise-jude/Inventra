import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export interface PublicPlatformStats {
  businesses: number;
  productsManaged: number;
  salesProcessed: number;
  invoicesGenerated: number;
  warehousesConnected: number;
  countriesReached: number;
}

const FALLBACK: PublicPlatformStats = {
  businesses: 0,
  productsManaged: 0,
  salesProcessed: 0,
  invoicesGenerated: 0,
  warehousesConnected: 0,
  countriesReached: 0,
};

// Real, cross-org counts for the landing page's dynamic counters — the
// only Postgres function in this codebase meant to be called by a
// logged-out visitor (see get_public_platform_stats()'s security definer
// + `to anon` grant). Uses a plain anon-key client rather than the
// cookie-based lib/supabase/server.ts one, since unstable_cache doesn't
// allow calling cookies()/headers() inside the cached function — this
// call doesn't depend on who's asking anyway, it's the same number for
// every visitor. Cached for 10 minutes so every landing-page view doesn't
// hit the DB; the numbers still grow on their own as the platform grows,
// no landing-page code change ever needed.
export const getPublicPlatformStats = unstable_cache(
  async (): Promise<PublicPlatformStats> => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.rpc("get_public_platform_stats").single();
    if (error || !data) {
      console.error("[Inventra] getPublicPlatformStats failed:", error);
      return FALLBACK;
    }
    const row = data as unknown as {
      businesses: number;
      products_managed: number;
      sales_processed: number;
      invoices_generated: number;
      warehouses_connected: number;
      countries_reached: number;
    };
    return {
      businesses: Number(row.businesses),
      productsManaged: Number(row.products_managed),
      salesProcessed: Number(row.sales_processed),
      invoicesGenerated: Number(row.invoices_generated),
      warehousesConnected: Number(row.warehouses_connected),
      countriesReached: Number(row.countries_reached),
    };
  },
  ["public-platform-stats"],
  { revalidate: 600 },
);
