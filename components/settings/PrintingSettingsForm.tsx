"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { updatePrintSettings } from "@/lib/actions/settings";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const PAPER_SIZES = [
  { value: "58mm", label: "58mm (compact thermal)" },
  { value: "80mm", label: "80mm (standard thermal)" },
  { value: "a4", label: "A4 (full page)" },
];

interface Props {
  paperSize: string;
  autoPrint: boolean;
  receiptFooter: string;
}

export function PrintingSettingsForm({ paperSize, autoPrint, receiptFooter }: Props) {
  const router = useRouter();
  const flash = useToast();
  const [form, setForm] = useState({ paperSize, autoPrint, receiptFooter });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updatePrintSettings(form);
      flash("Printing settings saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4.5">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-1 text-[15px] font-bold">Receipt printing</div>
        <div className="mb-4 text-[12.5px] text-text-2">Controls how receipts print from the Sales page.</div>
        <div className="grid grid-cols-2 gap-3.5">
          <Select label="Paper size" value={form.paperSize} onChange={(e) => setForm((f) => ({ ...f, paperSize: e.target.value }))}>
            {PAPER_SIZES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-2">Auto-print on sale</label>
            <div
              onClick={() => setForm((f) => ({ ...f, autoPrint: !f.autoPrint }))}
              className="flex h-[42px] cursor-pointer items-center gap-2.5 rounded-[9px] border border-border bg-surface px-3"
            >
              <div
                className="relative h-[23px] w-10 flex-shrink-0 rounded-[20px] transition-colors"
                style={{ background: form.autoPrint ? "var(--accent)" : "var(--border)" }}
              >
                <div
                  className="absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all"
                  style={{ left: form.autoPrint ? "19px" : "2.5px" }}
                />
              </div>
              <span className="text-[13px] text-text-2">{form.autoPrint ? "Printing automatically" : "Off — print manually"}</span>
            </div>
          </div>
        </div>
        <div className="mt-3.5">
          <Field
            label="Receipt footer text"
            placeholder="e.g. Thank you for shopping with us!"
            value={form.receiptFooter}
            onChange={(e) => setForm((f) => ({ ...f, receiptFooter: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2.5">
        <Button
          variant="secondary"
          onClick={() => {
            setForm({ paperSize, autoPrint, receiptFooter });
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
