"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSlackWebhook } from "@/lib/actions/settings";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

// Slack Incoming Webhooks, not a full OAuth App — the org admin creates one
// in their own workspace (Slack → Apps → Incoming Webhooks → Add New
// Webhook) and pastes the URL here. No app review/approval needed, and it
// posts stock alerts (lib/slack-service.ts) into exactly the channel they
// picked when creating it.
export function SlackConnectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await saveSlackWebhook(webhookUrl);
      if (!result.ok) {
        setError(result.error ?? "Could not connect Slack.");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="animate-scale-in w-full max-w-[460px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">Connect Slack</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <p className="text-[13px] leading-relaxed text-text-2">
            Create an{" "}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent-text underline"
            >
              Incoming Webhook
            </a>{" "}
            in your Slack workspace, pick the channel you want stock alerts posted to, then paste the webhook URL below.
            We&apos;ll send a test message to confirm it works.
          </p>
          <Field
            label="Webhook URL"
            placeholder="https://hooks.slack.com/services/…"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            autoFocus
          />
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !webhookUrl.trim()}>
            {saving ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </form>
    </div>
  );
}
