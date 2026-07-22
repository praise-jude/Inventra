"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { updateApprovalSettings, type ApprovalSettingsInput } from "@/lib/actions/settings";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

function Toggle({ checked, onChange, onLabel, offLabel }: { checked: boolean; onChange: () => void; onLabel: string; offLabel: string }) {
  return (
    <div onClick={onChange} className="flex h-[42px] cursor-pointer items-center gap-2.5 rounded-[9px] border border-border bg-surface px-3">
      <div
        className="relative h-[23px] w-10 flex-shrink-0 rounded-[20px] transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--border)" }}
      >
        <div
          className="absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all"
          style={{ left: checked ? "19px" : "2.5px" }}
        />
      </div>
      <span className="text-[13px] text-text-2">{checked ? onLabel : offLabel}</span>
    </div>
  );
}

export function ApprovalSettingsForm(props: {
  discountApprovalEnabled: boolean;
  discountThresholdPct: number;
  voidApprovalEnabled: boolean;
  voidThresholdAmount: number;
  priceChangeApprovalEnabled: boolean;
  priceChangeThresholdPct: number;
}) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState<ApprovalSettingsInput>({
    discountApprovalEnabled: props.discountApprovalEnabled,
    discountThresholdPct: props.discountThresholdPct,
    voidApprovalEnabled: props.voidApprovalEnabled,
    voidThresholdAmount: props.voidThresholdAmount,
    priceChangeApprovalEnabled: props.priceChangeApprovalEnabled,
    priceChangeThresholdPct: props.priceChangeThresholdPct,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateApprovalSettings(form);
      flash("Approval settings saved");
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not save approval settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4.5">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-1 text-[15px] font-bold">Discount approval</div>
        <div className="mb-4 text-[12.5px] text-text-2">
          Require manager/admin approval before a sale with a discount above this percentage is recorded.
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Require approval</label>
            <Toggle
              checked={form.discountApprovalEnabled}
              onChange={() => setForm((f) => ({ ...f, discountApprovalEnabled: !f.discountApprovalEnabled }))}
              onLabel="Enabled"
              offLabel="Off"
            />
          </div>
          <Field
            label="Threshold (%)"
            type="number"
            min={0}
            max={100}
            disabled={!form.discountApprovalEnabled}
            value={form.discountThresholdPct}
            onChange={(e) => setForm((f) => ({ ...f, discountThresholdPct: Number(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-1 text-[15px] font-bold">Void approval</div>
        <div className="mb-4 text-[12.5px] text-text-2">
          Require manager/admin approval before voiding a sale worth more than this amount. Owners and admins can always void
          without approval.
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Require approval</label>
            <Toggle
              checked={form.voidApprovalEnabled}
              onChange={() => setForm((f) => ({ ...f, voidApprovalEnabled: !f.voidApprovalEnabled }))}
              onLabel="Enabled"
              offLabel="Off"
            />
          </div>
          <Field
            label="Threshold (amount)"
            type="number"
            min={0}
            disabled={!form.voidApprovalEnabled}
            value={form.voidThresholdAmount}
            onChange={(e) => setForm((f) => ({ ...f, voidThresholdAmount: Number(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-1 text-[15px] font-bold">Price change approval</div>
        <div className="mb-4 text-[12.5px] text-text-2">
          Require manager/admin approval before a cost or sell price changes by more than this percentage. Owners and admins
          can always change prices without approval.
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Require approval</label>
            <Toggle
              checked={form.priceChangeApprovalEnabled}
              onChange={() => setForm((f) => ({ ...f, priceChangeApprovalEnabled: !f.priceChangeApprovalEnabled }))}
              onLabel="Enabled"
              offLabel="Off"
            />
          </div>
          <Field
            label="Threshold (%)"
            type="number"
            min={0}
            disabled={!form.priceChangeApprovalEnabled}
            value={form.priceChangeThresholdPct}
            onChange={(e) => setForm((f) => ({ ...f, priceChangeThresholdPct: Number(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2.5">
        <Button
          variant="secondary"
          onClick={() => {
            setForm({
              discountApprovalEnabled: props.discountApprovalEnabled,
              discountThresholdPct: props.discountThresholdPct,
              voidApprovalEnabled: props.voidApprovalEnabled,
              voidThresholdAmount: props.voidThresholdAmount,
              priceChangeApprovalEnabled: props.priceChangeApprovalEnabled,
              priceChangeThresholdPct: props.priceChangeThresholdPct,
            });
            flash("Changes discarded");
          }}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
