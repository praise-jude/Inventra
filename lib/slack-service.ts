import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Real Slack integration replacing the cosmetic "Connect" toggle Settings ->
// Integrations used to have — posts to a per-org Incoming Webhook URL the
// admin creates in their own Slack workspace and pastes into
// lib/actions/slack.ts's saveSlackWebhook. Deliberately fire-and-forget
// (never throws) — a failed Slack post must never break the sale/
// adjustment/transfer that triggered it, same contract as
// createNotification/logAudit elsewhere in this app.
export async function postToSlack(supabase: SupabaseClient, orgId: string, text: string): Promise<void> {
  try {
    const { data: integration } = await supabase
      .from("integrations")
      .select("status, config")
      .eq("org_id", orgId)
      .eq("provider", "slack")
      .maybeSingle();
    if (integration?.status !== "connected") return;
    const webhookUrl = (integration.config as { webhook_url?: string } | null)?.webhook_url;
    if (!webhookUrl) return;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error("[Inventra] postToSlack failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[Inventra] postToSlack threw:", err);
  }
}

const STATUS_EMOJI: Record<string, string> = { out_of_stock: "🔴", low_stock: "🟡" };
const STATUS_LABEL: Record<string, string> = { out_of_stock: "is out of stock", low_stock: "is low on stock" };

// Called after any stock_movements insert succeeds (recordSale, adjustments,
// transfers — see call sites) with the product ids that just moved.
// last_alerted_status (20260804120000_slack_stock_alerts.sql) dedups so
// this only posts on a genuine transition into/out of low or out of
// stock, not on every subsequent sale of an already-low product.
export async function checkAndSendStockAlerts(supabase: SupabaseClient, orgId: string, productIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return;

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("low_stock, out_of_stock")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!settings?.low_stock && !settings?.out_of_stock) return;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, status, qty_on_hand, reorder_level, last_alerted_status")
    .in("id", uniqueIds)
    .is("archived_at", null);

  const lines: string[] = [];
  for (const p of products ?? []) {
    const alertableStatus = p.status === "out_of_stock" || p.status === "low_stock";
    const enabledForStatus = (p.status === "out_of_stock" && settings.out_of_stock) || (p.status === "low_stock" && settings.low_stock);

    if (alertableStatus && enabledForStatus && p.last_alerted_status !== p.status) {
      lines.push(
        p.status === "out_of_stock"
          ? `${STATUS_EMOJI.out_of_stock} *${p.name}* ${STATUS_LABEL.out_of_stock} (0 units on hand)`
          : `${STATUS_EMOJI.low_stock} *${p.name}* ${STATUS_LABEL.low_stock} (${p.qty_on_hand} left, reorder at ${p.reorder_level})`,
      );
      void supabase.from("products").update({ last_alerted_status: p.status }).eq("id", p.id);
    } else if (!alertableStatus && p.last_alerted_status) {
      // Restocked past the threshold — clear so a future dip alerts again.
      void supabase.from("products").update({ last_alerted_status: null }).eq("id", p.id);
    }
  }

  if (lines.length > 0) {
    await postToSlack(supabase, orgId, lines.length === 1 ? lines[0] : `Stock alerts:\n${lines.join("\n")}`);
  }
}
